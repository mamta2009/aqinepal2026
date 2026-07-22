import { useState } from 'react';
import { View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  Banner,
  AuthTextField,
  PrimaryButton,
} from '@/features/auth/FormFields';
import {
  loginSchema,
  otpExchangeSchema,
  signupVerifySchema,
  type LoginFormValues,
  type OtpExchangeFormValues,
  type SignupVerifyFormValues,
} from '@/features/auth/schemas';
import {
  exchangeFacilityOtp,
  loginWithPassword,
  requestFacilityOtp,
} from '@/services/api/auth';
import { verifyWithEmail } from '@/services/api/contacts';
import { toApiError } from '@/services/api/client';
import { useAuthStore } from '@/store/authStore';
import { toastError, toastInfo, toastSuccess } from '@/utils/toast';

interface LoginFormProps {
  onLoggedIn?: () => void;
}

export function LoginForm({ onLoggedIn }: LoginFormProps) {
  const setSession = useAuthStore((s) => s.setSession);
  const [showSignupVerify, setShowSignupVerify] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const otpForm = useForm<OtpExchangeFormValues>({
    resolver: zodResolver(otpExchangeSchema),
    defaultValues: { email: '', code: '' },
  });

  const signupForm = useForm<SignupVerifyFormValues>({
    resolver: zodResolver(signupVerifySchema),
    defaultValues: { email: '', verification_code: '' },
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
      toastSuccess('Signed in successfully.');
      setShowSignupVerify(false);
      onLoggedIn?.();
    },
    onError: (error) => {
      const apiErr = toApiError(error);
      toastError(apiErr.message);
      if (
        apiErr.status === 403 &&
        typeof apiErr.message === 'string' &&
        apiErr.message.toLowerCase().includes('verify')
      ) {
        setShowSignupVerify(true);
        const email = loginForm.getValues('email');
        signupForm.setValue('email', email);
      }
    },
  });

  const otpRequestMutation = useMutation({
    mutationFn: async () => {
      const email = (otpForm.getValues('email') || loginForm.getValues('email')).trim().toLowerCase();
      if (!email) throw new Error('Enter your email first');
      otpForm.setValue('email', email);
      return requestFacilityOtp(email);
    },
    onSuccess: (data) => {
      if (data.code_ttl_minutes != null) {
        setOtpSent(true);
        toastSuccess(`OTP sent (valid ~${data.code_ttl_minutes} min). Check your channels.`);
      } else {
        toastInfo(data.message || 'If eligible, a code was sent.');
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
      toastSuccess('Facility session started.');
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
      toastSuccess(data.message || 'Verified. Sign in with your password.');
      setShowSignupVerify(false);
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  return (
    <View className="gap-2">
      <Controller
        control={loginForm.control}
        name="email"
        render={({ field: { value, onChange }, fieldState }) => (
          <AuthTextField
            label="Email"
            value={value}
            onChangeText={(t) => {
              onChange(t);
              otpForm.setValue('email', t);
              signupForm.setValue('email', t);
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
            label="Password"
            value={value}
            onChangeText={onChange}
            error={fieldState.error?.message}
            secureTextEntry
            placeholder="••••••••"
          />
        )}
      />
      <PrimaryButton
        label={passwordMutation.isPending ? 'Signing in…' : 'Sign in'}
        variant="action"
        disabled={passwordMutation.isPending}
        onPress={loginForm.handleSubmit((values) => passwordMutation.mutate(values))}
      />

      {showSignupVerify ? (
        <View className="mt-4 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
          <Banner
            message="Verify your registration code, then sign in again."
            tone="info"
          />
          <Controller
            control={signupForm.control}
            name="verification_code"
            render={({ field: { value, onChange }, fieldState }) => (
              <AuthTextField
                label="Registration verification code"
                value={value}
                onChangeText={onChange}
                error={fieldState.error?.message}
                keyboardType="number-pad"
              />
            )}
          />
          <PrimaryButton
            label={signupVerifyMutation.isPending ? 'Verifying…' : 'Verify registration'}
            variant="action"
            disabled={signupVerifyMutation.isPending}
            onPress={signupForm.handleSubmit((values) => signupVerifyMutation.mutate(values))}
          />
        </View>
      ) : null}

      <View className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <Banner
          message="Facility OTP is for approved facility reporters only."
          tone="info"
        />
        <PrimaryButton
          label={otpRequestMutation.isPending ? 'Sending OTP…' : 'Send facility OTP'}
          variant="secondary"
          disabled={otpRequestMutation.isPending}
          onPress={() => otpRequestMutation.mutate()}
        />
        {otpSent ? (
          <View className="mt-3 gap-2">
            <Controller
              control={otpForm.control}
              name="code"
              render={({ field: { value, onChange }, fieldState }) => (
                <AuthTextField
                  label="OTP code"
                  value={value}
                  onChangeText={onChange}
                  error={fieldState.error?.message}
                  keyboardType="number-pad"
                />
              )}
            />
            <PrimaryButton
              label={otpExchangeMutation.isPending ? 'Exchanging…' : 'Exchange OTP'}
              variant="action"
              disabled={otpExchangeMutation.isPending}
              onPress={otpForm.handleSubmit((values) => otpExchangeMutation.mutate(values))}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}
