import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AccountSectionAccent, FeatureSection } from '@/components/FeatureSection';
import {
  Banner,
  ChipMultiSelect,
  ConsentToggle,
  PrimaryButton,
} from '@/features/auth/FormFields';
import {
  channelPrefsSchema,
  type ChannelPrefsFormValues,
} from '@/features/auth/schemas';
import { patchPreferences } from '@/services/api/auth';
import { toApiError } from '@/services/api/client';
import { toastError, toastSuccess } from '@/utils/toast';
import type { AuthProfile, NotificationChannel } from '@/types/auth';

interface ChannelPreferencesFormProps {
  profile: AuthProfile | undefined;
}

export function ChannelPreferencesForm({ profile }: ChannelPreferencesFormProps) {
  const queryClient = useQueryClient();

  const form = useForm<ChannelPrefsFormValues>({
    resolver: zodResolver(channelPrefsSchema),
    defaultValues: {
      preferred_channels: ['sms', 'whatsapp', 'email'],
      consent_given: true,
    },
  });

  useEffect(() => {
    if (!profile) return;
    const channels = (profile.preferred_channels || []).filter(Boolean) as NotificationChannel[];
    form.reset({
      preferred_channels: channels.length > 0 ? channels : ['email'],
      consent_given: profile.consent_given !== false,
    });
  }, [profile, form]);

  const mutation = useMutation({
    mutationFn: (values: ChannelPrefsFormValues) =>
      patchPreferences({
        preferred_channels: values.preferred_channels,
        consent_given: values.consent_given,
      }),
    onSuccess: async (data) => {
      toastSuccess(data.message || 'Preferences saved.');
      await queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] });
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  return (
    <FeatureSection accent={AccountSectionAccent.channels}>
      <Banner
        message="Choose how we may reach you for alerts (matches your registration — save to update)."
        tone="info"
      />

      <Controller
        control={form.control}
        name="preferred_channels"
        render={({ field: { value, onChange }, fieldState }) => (
          <ChipMultiSelect
            label="Notification channels"
            options={[
              { value: 'sms', label: 'SMS' },
              { value: 'whatsapp', label: 'WhatsApp' },
              { value: 'email', label: 'Email' },
            ]}
            selected={value}
            onChange={onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="consent_given"
        render={({ field: { value, onChange }, fieldState }) => (
          <ConsentToggle
            label="Keep consent active for alert delivery"
            checked={value}
            onChange={onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <PrimaryButton
        label={mutation.isPending ? 'Saving…' : 'Save channels'}
        disabled={mutation.isPending}
        onPress={form.handleSubmit((values) => mutation.mutate(values))}
      />
    </FeatureSection>
  );
}
