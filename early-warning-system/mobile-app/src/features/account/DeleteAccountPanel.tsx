import { useEffect, useState } from 'react';
import { Keyboard, Platform, Text, View } from 'react-native';
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
import { BottomTabInset } from '@/constants/theme';

/**
 * Danger zone: permanently delete the signed-in registrant account.
 * Requires a password session (not facility OTP alone) plus typed DELETE.
 */
export function DeleteAccountPanel() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [keyboardPad, setKeyboardPad] = useState(0);

  useEffect(() => {
    if (!expanded) {
      setKeyboardPad(0);
      return;
    }
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (event) => {
      setKeyboardPad(
        Math.max(0, event.endCoordinates.height - BottomTabInset),
      );
    });
    const onHide = Keyboard.addListener(hideEvent, () => setKeyboardPad(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [expanded]);

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
      <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        Security
      </Text>
      <Text className="mb-2 text-lg font-extrabold text-ink">Delete account</Text>
      <Text className="mb-3 text-sm leading-5 text-muted">
        This permanently removes your registration and personal data. Sign in
        with email and password (not OTP only).
      </Text>

      {!expanded ? (
        <PrimaryButton
          label="Open delete account"
          variant="dangerOutline"
          onPress={() => setExpanded(true)}
        />
      ) : (
        <View style={{ paddingBottom: keyboardPad }}>
          <Banner
            message="Permanently removes your registration, preferences, notification history, and trusted contacts. Type DELETE to confirm. This cannot be undone."
            tone="error"
          />

          <AuthTextField
            label="Current password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            showSecureToggle
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

          <View className="mt-1 gap-2">
            <PrimaryButton
              label={
                mutation.isPending
                  ? 'Deleting…'
                  : 'Permanently delete account'
              }
              variant="danger"
              disabled={!canSubmit}
              onPress={() => mutation.mutate()}
            />
            <PrimaryButton
              label="Cancel"
              variant="ghost"
              onPress={() => {
                setExpanded(false);
                setPassword('');
                setConfirm('');
              }}
            />
          </View>
        </View>
      )}
    </FeatureSection>
  );
}
