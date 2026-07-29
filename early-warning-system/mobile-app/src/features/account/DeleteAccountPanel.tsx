import { useState } from 'react';
import { Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { AccountSectionAccent, FeatureSection } from '@/components/FeatureSection';
import {
  AuthTextField,
  Banner,
  PrimaryButton,
} from '@/features/auth/FormFields';
import { deleteAccount } from '@/services/api/auth';
import { toApiError } from '@/services/api/client';
import { useAuthStore } from '@/store/authStore';
import { toastError, toastSuccess } from '@/utils/toast';

/**
 * Danger zone: permanently delete the signed-in registrant account.
 * Requires a password session (not facility OTP alone) plus typed DELETE.
 */
export function DeleteAccountPanel() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      deleteAccount({
        password,
        confirm: confirm.trim(),
      }),
    onSuccess: async (data) => {
      toastSuccess(data.message || 'Account deleted.');
      setPassword('');
      setConfirm('');
      await clearSession();
    },
    onError: (error) => {
      const msg = toApiError(error).message;
      toastError(
        msg ||
          'Delete failed. Sign in with email and password (not OTP only), then try again.',
      );
    },
  });

  const canSubmit =
    password.length > 0 && confirm.trim() === 'DELETE' && !mutation.isPending;

  return (
    <FeatureSection accent={AccountSectionAccent.profile}>
      <Text className="mb-1 text-base font-bold text-neutral-900 dark:text-white">
        Delete account
      </Text>
      <Banner
        message="Permanently removes your registration, preferences, notification history, and friends/family contacts. Sign in with email and password (not OTP only). Type DELETE to confirm. This cannot be undone."
        tone="error"
      />

      <AuthTextField
        label="Current password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Your account password"
        autoCapitalize="none"
      />
      <AuthTextField
        label="Type DELETE to confirm"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="DELETE"
        autoCapitalize="characters"
      />

      <View className="mt-1">
        <PrimaryButton
          label={mutation.isPending ? 'Deleting…' : 'Delete my account'}
          variant="danger"
          disabled={!canSubmit}
          onPress={() => mutation.mutate()}
        />
      </View>
    </FeatureSection>
  );
}
