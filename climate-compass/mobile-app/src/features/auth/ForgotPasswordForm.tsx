import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  AuthTextField,
  Banner,
  PrimaryButton,
} from "@/features/auth/FormFields";
import {
  forgotPasswordConfirmSchema,
  forgotPasswordRequestSchema,
  type ForgotPasswordConfirmFormValues,
  type ForgotPasswordRequestFormValues,
} from "@/features/auth/schemas";
import {
  confirmPasswordReset,
  requestPasswordReset,
} from "@/services/api/auth";
import { toApiError } from "@/services/api/client";
import { toastError, toastSuccess } from "@/utils/toast";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [codeSent, setCodeSent] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState("");

  const requestForm = useForm<ForgotPasswordRequestFormValues>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: "" },
  });

  const confirmForm = useForm<ForgotPasswordConfirmFormValues>({
    resolver: zodResolver(forgotPasswordConfirmSchema),
    defaultValues: {
      email: "",
      code: "",
      new_password: "",
      new_password_confirm: "",
    },
  });

  const requestMutation = useMutation({
    mutationFn: (values: ForgotPasswordRequestFormValues) =>
      requestPasswordReset(values.email.trim().toLowerCase()),
    onSuccess: (data, values) => {
      const message =
        data.message ||
        "If this email has a password login, a reset code was sent.";
      setNotice(message);
      setCodeSent(true);
      confirmForm.setValue("email", values.email.trim().toLowerCase());
      toastSuccess(message);
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  const confirmMutation = useMutation({
    mutationFn: (values: ForgotPasswordConfirmFormValues) =>
      confirmPasswordReset({
        email: values.email.trim().toLowerCase(),
        code: values.code.trim(),
        new_password: values.new_password,
      }),
    onSuccess: (data) => {
      const message =
        data.message ||
        "Password updated. You can sign in with your new password.";
      setNotice(message);
      setDone(true);
      toastSuccess(message);
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  if (done) {
    return (
      <View className="gap-4">
        <Banner message={notice || "Password updated."} tone="success" />
        <PrimaryButton
          label="Back to sign in"
          variant="action"
          onPress={() => router.replace("/account")}
        />
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="rounded-2xl border border-border bg-white p-4">
        <Text className="mb-1 text-xl font-extrabold text-ink">
          1. Request a reset code
        </Text>
        <Text className="mb-3 text-sm leading-5 text-muted">
          We email a one-time code to your registered address only.
        </Text>
        <Controller
          control={requestForm.control}
          name="email"
          render={({ field: { value, onChange }, fieldState }) => (
            <AuthTextField
              label="Registered email"
              value={value}
              onChangeText={onChange}
              error={fieldState.error?.message}
              keyboardType="email-address"
              placeholder="you@example.com"
            />
          )}
        />
        <PrimaryButton
          label={
            requestMutation.isPending
              ? "Sending…"
              : codeSent
                ? "Resend code"
                : "Send reset code"
          }
          variant="action"
          disabled={requestMutation.isPending}
          onPress={requestForm.handleSubmit((values) =>
            requestMutation.mutate(values),
          )}
        />
      </View>

      {codeSent ? (
        <View className="rounded-2xl border border-border bg-white p-4">
          <Text className="mb-1 text-xl font-extrabold text-ink">
            2. Choose a new password
          </Text>
          <Text className="mb-3 text-sm leading-5 text-muted">
            Check the inbox for{" "}
            <Text className="font-extrabold text-ink">
              {confirmForm.watch("email")}
            </Text>
            , enter the code, then set a new password (at least 8 characters).
          </Text>
          <Controller
            control={confirmForm.control}
            name="code"
            render={({ field: { value, onChange }, fieldState }) => (
              <AuthTextField
                label="Reset code from email"
                value={value}
                onChangeText={onChange}
                error={fieldState.error?.message}
                keyboardType="number-pad"
              />
            )}
          />
          <Controller
            control={confirmForm.control}
            name="new_password"
            render={({ field: { value, onChange }, fieldState }) => (
              <AuthTextField
                label="New password"
                value={value}
                onChangeText={onChange}
                error={fieldState.error?.message}
                secureTextEntry
                showSecureToggle
              />
            )}
          />
          <Controller
            control={confirmForm.control}
            name="new_password_confirm"
            render={({ field: { value, onChange }, fieldState }) => (
              <AuthTextField
                label="Confirm new password"
                value={value}
                onChangeText={onChange}
                error={fieldState.error?.message}
                secureTextEntry
                showSecureToggle
              />
            )}
          />
          <PrimaryButton
            label={
              confirmMutation.isPending ? "Updating…" : "Update password"
            }
            variant="action"
            disabled={confirmMutation.isPending}
            onPress={confirmForm.handleSubmit((values) =>
              confirmMutation.mutate(values),
            )}
          />
        </View>
      ) : null}

      {notice ? <Banner message={notice} tone="success" /> : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace("/account")}
        className="min-h-11 items-center justify-center active:opacity-80">
        <Text className="font-extrabold text-forest">Back to sign in</Text>
      </Pressable>
    </View>
  );
}
