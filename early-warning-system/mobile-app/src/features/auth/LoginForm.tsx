import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  AuthModeTabs,
  AuthTextField,
  Banner,
  PrimaryButton,
} from "@/features/auth/FormFields";
import {
  loginSchema,
  otpExchangeSchema,
  signupVerifySchema,
  type LoginFormValues,
  type OtpExchangeFormValues,
  type SignupVerifyFormValues,
} from "@/features/auth/schemas";
import {
  exchangeFacilityOtp,
  loginWithPassword,
  requestFacilityOtp,
} from "@/services/api/auth";
import { verifyWithEmail } from "@/services/api/contacts";
import { toApiError } from "@/services/api/client";
import { useAuthStore } from "@/store/authStore";
import { toastError, toastInfo, toastSuccess } from "@/utils/toast";

interface LoginFormProps {
  onLoggedIn?: () => void;
}

export function LoginForm({ onLoggedIn }: LoginFormProps) {
  const setSession = useAuthStore((s) => s.setSession);
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const otpForm = useForm<OtpExchangeFormValues>({
    resolver: zodResolver(otpExchangeSchema),
    defaultValues: { email: "", code: "" },
  });

  const signupForm = useForm<SignupVerifyFormValues>({
    resolver: zodResolver(signupVerifySchema),
    defaultValues: { email: "", verification_code: "" },
  });

  const passwordMutation = useMutation({
    mutationFn: (values: LoginFormValues) =>
      loginWithPassword(values.email.trim().toLowerCase(), values.password),
    onSuccess: async (data) => {
      await setSession({
        accessToken: data.access_token,
        facilityReportingReady: data.facility_reporting_ready === true,
        claims: {
          facility_id: data.facility_id,
          facility_name: data.facility_name,
          city: data.city,
          scopes: data.scopes,
        },
      });
      setNotice("Signed in securely.");
      toastSuccess("Signed in successfully.");
      onLoggedIn?.();
    },
    onError: (error) => {
      const apiErr = toApiError(error);
      toastError(apiErr.message);
      if (
        apiErr.status === 403 &&
        typeof apiErr.message === "string" &&
        apiErr.message.toLowerCase().includes("verify")
      ) {
        setVerifyOpen(true);
        signupForm.setValue("email", loginForm.getValues("email"));
      }
    },
  });

  const otpRequestMutation = useMutation({
    mutationFn: async (email: string) =>
      requestFacilityOtp(email.trim().toLowerCase()),
    onSuccess: (data, email) => {
      otpForm.setValue("email", email.trim().toLowerCase());
      const message = data.message || "If eligible, a code was sent.";
      setNotice(message);
      if (data.code_ttl_minutes != null) {
        toastSuccess(
          `OTP sent (valid ~${data.code_ttl_minutes} min). Check your channels.`,
        );
      } else {
        toastInfo(message);
      }
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  const otpExchangeMutation = useMutation({
    mutationFn: (values: OtpExchangeFormValues) =>
      exchangeFacilityOtp(values.email.trim().toLowerCase(), values.code.trim()),
    onSuccess: async (data) => {
      await setSession({
        accessToken: data.access_token,
        facilityReportingReady: true,
        claims: {
          facility_id: data.facility_id,
          facility_name: data.facility_name,
          city: data.city,
          scopes: data.scope ? [data.scope] : [],
        },
      });
      setNotice("OTP accepted. Your secure session is ready.");
      toastSuccess("Signed in with facility OTP.");
      onLoggedIn?.();
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  const signupVerifyMutation = useMutation({
    mutationFn: (values: SignupVerifyFormValues) =>
      verifyWithEmail({
        email: values.email.trim().toLowerCase(),
        verification_code: values.verification_code.trim(),
      }),
    onSuccess: (data) => {
      const message =
        data.message || "Registration verified. You can sign in now.";
      setNotice(message);
      toastSuccess(message);
      setVerifyOpen(false);
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  const syncEmail = (email: string) => {
    loginForm.setValue("email", email);
    otpForm.setValue("email", email);
    signupForm.setValue("email", email);
  };

  return (
    <View className="gap-4">
      <AuthModeTabs mode={mode} onChange={setMode} />

      <View className="rounded-2xl border border-border bg-white p-4">
        {mode === "password" ? (
          <View className="gap-1">
            <Text className="mb-2 text-xl font-extrabold text-ink">
              Account login
            </Text>
            <Controller
              control={loginForm.control}
              name="email"
              render={({ field: { value, onChange }, fieldState }) => (
                <AuthTextField
                  label="Email"
                  value={value}
                  onChangeText={(t) => {
                    onChange(t);
                    syncEmail(t);
                  }}
                  error={fieldState.error?.message}
                  keyboardType="email-address"
                  placeholder="you@example.com"
                />
              )}
            />
            <Controller
              control={loginForm.control}
              name="password"
              render={({ field: { value, onChange }, fieldState }) => (
                <AuthTextField
                  label="Current password"
                  value={value}
                  onChangeText={onChange}
                  error={fieldState.error?.message}
                  secureTextEntry
                  showSecureToggle
                  placeholder="••••••••"
                />
              )}
            />
            <PrimaryButton
              label={
                passwordMutation.isPending ? "Signing in…" : "Sign in"
              }
              variant="action"
              disabled={passwordMutation.isPending}
              onPress={loginForm.handleSubmit((values) =>
                passwordMutation.mutate(values),
              )}
            />
          </View>
        ) : (
          <View className="gap-4">
            <View className="gap-1">
              <Text className="mb-2 text-xl font-extrabold text-ink">
                Request a facility code
              </Text>
              <Controller
                control={otpForm.control}
                name="email"
                render={({ field: { value, onChange }, fieldState }) => (
                  <AuthTextField
                    label="Registration email"
                    value={value}
                    onChangeText={(t) => {
                      onChange(t);
                      syncEmail(t);
                    }}
                    error={fieldState.error?.message}
                    keyboardType="email-address"
                    placeholder="you@example.com"
                  />
                )}
              />
              <PrimaryButton
                label={
                  otpRequestMutation.isPending ? "Requesting…" : "Send OTP"
                }
                variant="action"
                disabled={otpRequestMutation.isPending}
                onPress={() => {
                  const email =
                    otpForm.getValues("email") ||
                    loginForm.getValues("email");
                  if (!email.trim()) {
                    otpForm.setError("email", {
                      message: "Valid email is required",
                    });
                    return;
                  }
                  otpRequestMutation.mutate(email);
                }}
              />
            </View>

            <View className="border-t border-border pt-4">
              <Text className="mb-2 font-extrabold text-ink">Exchange OTP</Text>
              <Controller
                control={otpForm.control}
                name="email"
                render={({ field: { value, onChange }, fieldState }) => (
                  <AuthTextField
                    label="Email"
                    value={value}
                    onChangeText={(t) => {
                      onChange(t);
                      syncEmail(t);
                    }}
                    error={fieldState.error?.message}
                    keyboardType="email-address"
                  />
                )}
              />
              <Controller
                control={otpForm.control}
                name="code"
                render={({ field: { value, onChange }, fieldState }) => (
                  <AuthTextField
                    label="One-time code"
                    value={value}
                    onChangeText={onChange}
                    error={fieldState.error?.message}
                    keyboardType="number-pad"
                  />
                )}
              />
              <PrimaryButton
                label={
                  otpExchangeMutation.isPending
                    ? "Checking…"
                    : "Sign in with OTP"
                }
                variant="action"
                disabled={otpExchangeMutation.isPending}
                onPress={otpForm.handleSubmit((values) =>
                  otpExchangeMutation.mutate(values),
                )}
              />
            </View>
          </View>
        )}
      </View>

      <View className="overflow-hidden rounded-2xl border border-border bg-white">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: verifyOpen }}
          onPress={() => setVerifyOpen((v) => !v)}
          className="min-h-11 flex-row items-center justify-between px-4 py-3.5 active:opacity-80">
          <Text className="font-extrabold text-ink">
            Verify a new registration
          </Text>
          <Text className="text-lg text-muted">{verifyOpen ? "▾" : "▸"}</Text>
        </Pressable>
        {verifyOpen ? (
          <View className="border-t border-border px-4 pb-4 pt-3">
            <Controller
              control={signupForm.control}
              name="email"
              render={({ field: { value, onChange }, fieldState }) => (
                <AuthTextField
                  label="Registration email"
                  value={value}
                  onChangeText={(t) => {
                    onChange(t);
                    syncEmail(t);
                  }}
                  error={fieldState.error?.message}
                  keyboardType="email-address"
                />
              )}
            />
            <Controller
              control={signupForm.control}
              name="verification_code"
              render={({ field: { value, onChange }, fieldState }) => (
                <AuthTextField
                  label="Signup verification code"
                  value={value}
                  onChangeText={onChange}
                  error={fieldState.error?.message}
                  keyboardType="number-pad"
                />
              )}
            />
            <PrimaryButton
              label={
                signupVerifyMutation.isPending
                  ? "Verifying…"
                  : "Verify registration"
              }
              variant="action"
              disabled={signupVerifyMutation.isPending}
              onPress={signupForm.handleSubmit((values) =>
                signupVerifyMutation.mutate(values),
              )}
            />
          </View>
        ) : null}
      </View>

      {notice ? <Banner message={notice} tone="success" /> : null}
    </View>
  );
}
