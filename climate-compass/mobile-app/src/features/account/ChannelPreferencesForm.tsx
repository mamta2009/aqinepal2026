import { useEffect } from "react";
import { Text } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AccountSectionAccent, FeatureSection } from "@/components/FeatureSection";
import {
  ChipMultiSelect,
  ConsentToggle,
  PrimaryButton,
} from "@/features/auth/FormFields";
import {
  notificationPrefsSchema,
  type NotificationPrefsFormValues,
} from "@/features/auth/schemas";
import { patchPreferences } from "@/services/api/auth";
import { toApiError } from "@/services/api/client";
import { toastError, toastSuccess } from "@/utils/toast";
import type {
  AuthProfile,
  EnvironmentalTopic,
  NotificationChannel,
} from "@/types/auth";

interface ChannelPreferencesFormProps {
  profile: AuthProfile | undefined;
}

export function ChannelPreferencesForm({
  profile,
}: ChannelPreferencesFormProps) {
  const queryClient = useQueryClient();

  const form = useForm<NotificationPrefsFormValues>({
    resolver: zodResolver(notificationPrefsSchema),
    defaultValues: {
      preferred_channels: ["sms", "whatsapp", "email"],
      environmental_topics: ["air", "heat"],
      consent_given: true,
    },
  });

  useEffect(() => {
    if (!profile) return;
    const channels = (profile.preferred_channels || []).filter(
      Boolean,
    ) as NotificationChannel[];
    const topics = (profile.environmental_topics || []).filter(
      Boolean,
    ) as EnvironmentalTopic[];
    form.reset({
      preferred_channels: channels.length > 0 ? channels : ["email"],
      environmental_topics: topics.length > 0 ? topics : ["air", "heat"],
      consent_given: profile.consent_given !== false,
    });
  }, [profile, form]);

  const mutation = useMutation({
    mutationFn: (values: NotificationPrefsFormValues) =>
      patchPreferences({
        preferred_channels: values.preferred_channels,
        environmental_topics: values.environmental_topics,
        consent_given: values.consent_given,
      }),
    onSuccess: async (data) => {
      toastSuccess(data.message || "Notification preferences saved.");
      await queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  return (
    <FeatureSection accent={AccountSectionAccent.channels}>
      <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        Alerts
      </Text>
      <Text className="mb-3 text-lg font-extrabold text-ink">
        Notification preferences
      </Text>

      <Controller
        control={form.control}
        name="preferred_channels"
        render={({ field: { value, onChange }, fieldState }) => (
          <ChipMultiSelect
            label="Channels"
            options={[
              { value: "sms", label: "SMS" },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "email", label: "Email" },
            ]}
            selected={value}
            onChange={onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="environmental_topics"
        render={({ field: { value, onChange }, fieldState }) => (
          <ChipMultiSelect
            label="Environmental topics"
            options={[
              { value: "air", label: "Air quality" },
              { value: "heat", label: "Heat" },
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
            label="I consent to receive alerts through the selected channels."
            checked={value}
            onChange={onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <PrimaryButton
        label={mutation.isPending ? "Saving…" : "Save preferences"}
        disabled={mutation.isPending}
        onPress={form.handleSubmit((values) => mutation.mutate(values))}
      />
    </FeatureSection>
  );
}
