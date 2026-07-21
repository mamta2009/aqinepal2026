import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { Banner, AuthTextField, PrimaryButton } from '@/features/auth/FormFields';
import { verifySchema, type VerifyFormValues } from '@/features/auth/schemas';
import { resendVerification, verifyContact, verifyWithEmail } from '@/services/api/contacts';
import { toApiError } from '@/services/api/client';
import {
  clearPendingRegistration,
  loadPendingRegistration,
} from '@/utils/pendingRegistration';

export function VerifyForm() {
  const router = useRouter();
  const [banner, setBanner] = useState<{ message: string; tone: 'info' | 'error' | 'success' } | null>(
    null,
  );

  const form = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { email: '', contact_id: '', verification_code: '' },
  });

  useEffect(() => {
    void loadPendingRegistration().then(({ email, contactId }) => {
      if (email) form.setValue('email', email);
      if (contactId) form.setValue('contact_id', contactId);
    });
  }, [form]);

  const verifyMutation = useMutation({
    mutationFn: async (values: VerifyFormValues) => {
      const email = values.email?.trim();
      const code = values.verification_code.trim();
      if (email) {
        return verifyWithEmail({ email: email.toLowerCase(), verification_code: code });
      }
      return verifyContact({
        contact_id: values.contact_id!.trim(),
        verification_code: code,
      });
    },
    onSuccess: async (data) => {
      await clearPendingRegistration();
      setBanner({ message: data.message || 'Verified. You can sign in now.', tone: 'success' });
      router.replace('/account');
    },
    onError: (error) => setBanner({ message: toApiError(error).message, tone: 'error' }),
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      const email = form.getValues('email')?.trim();
      if (!email) throw new Error('Enter the registration email to resend');
      return resendVerification({ email: email.toLowerCase() });
    },
    onSuccess: (data) =>
      setBanner({ message: data.message || 'Verification code resent.', tone: 'success' }),
    onError: (error) => {
      const apiErr = toApiError(error);
      if (apiErr.status === 429) {
        setBanner({
          message: apiErr.message || 'Please wait before requesting another code.',
          tone: 'error',
        });
        return;
      }
      setBanner({ message: apiErr.message, tone: 'error' });
    },
  });

  return (
    <View>
      {banner ? <Banner message={banner.message} tone={banner.tone} /> : null}

      <Controller
        control={form.control}
        name="email"
        render={({ field: { value, onChange }, fieldState }) => (
          <AuthTextField
            label="Email"
            value={value ?? ''}
            onChangeText={onChange}
            error={fieldState.error?.message}
            keyboardType="email-address"
          />
        )}
      />
      <Controller
        control={form.control}
        name="contact_id"
        render={({ field: { value, onChange }, fieldState }) => (
          <AuthTextField
            label="Contact id (optional if email set)"
            value={value ?? ''}
            onChangeText={onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="verification_code"
        render={({ field: { value, onChange }, fieldState }) => (
          <AuthTextField
            label="Verification code"
            value={value}
            onChangeText={onChange}
            error={fieldState.error?.message}
            keyboardType="number-pad"
          />
        )}
      />

      <PrimaryButton
        label={verifyMutation.isPending ? 'Verifying…' : 'Verify'}
        disabled={verifyMutation.isPending}
        onPress={form.handleSubmit((values) => verifyMutation.mutate(values))}
      />
      <View className="mt-3">
        <PrimaryButton
          label={resendMutation.isPending ? 'Resending…' : 'Resend code'}
          variant="secondary"
          disabled={resendMutation.isPending}
          onPress={() => resendMutation.mutate()}
        />
      </View>
    </View>
  );
}
