import { useState } from 'react';
import { View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { CITY_NAMES } from '@/constants/cities';
import {
  Banner,
  ChipMultiSelect,
  ConsentToggle,
  AuthTextField,
  PrimaryButton,
} from '@/features/auth/FormFields';
import {
  registerSchema,
  toRegisterPayload,
  type RegisterFormValues,
} from '@/features/auth/schemas';
import { registerContact } from '@/services/api/contacts';
import { toApiError } from '@/services/api/client';
import { savePendingRegistration } from '@/utils/pendingRegistration';

const CONTACT_TYPES = [
  { value: 'health_worker', label: 'Health worker' },
  { value: 'parent', label: 'Parent / caregiver' },
  { value: 'admin', label: 'Admin' },
  { value: 'government', label: 'Government' },
];

export function RegisterForm() {
  const router = useRouter();
  const [banner, setBanner] = useState<{ message: string; tone: 'info' | 'error' | 'success' } | null>(
    null,
  );

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone_number: '+977',
      whatsapp_number: '',
      contact_type: 'health_worker',
      facility_names_text: '',
      cities: ['Kathmandu'],
      preferred_channels: ['sms', 'whatsapp', 'email'],
      environmental_topics: ['air', 'heat'],
      language: 'en',
      consent_given: true,
      password: '',
      password_confirm: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: RegisterFormValues) => {
      const payload = toRegisterPayload(values);
      return registerContact(payload);
    },
    onSuccess: async (data, values) => {
      await savePendingRegistration(values.email.trim().toLowerCase(), data.contact_id);
      const warningText =
        data.warnings && data.warnings.length > 0
          ? `\n${data.warnings.join('\n')}`
          : '';
      setBanner({
        message: `${data.message}${warningText}`,
        tone: 'success',
      });
      router.push('/verify');
    },
    onError: (error) => setBanner({ message: toApiError(error).message, tone: 'error' }),
  });

  return (
    <View>
      {banner ? <Banner message={banner.message} tone={banner.tone} /> : null}

      <Controller
        control={form.control}
        name="name"
        render={({ field: { value, onChange }, fieldState }) => (
          <AuthTextField
            label="Full name"
            value={value}
            onChangeText={onChange}
            error={fieldState.error?.message}
            autoCapitalize="words"
          />
        )}
      />
      <Controller
        control={form.control}
        name="email"
        render={({ field: { value, onChange }, fieldState }) => (
          <AuthTextField
            label="Email"
            value={value}
            onChangeText={onChange}
            error={fieldState.error?.message}
            keyboardType="email-address"
          />
        )}
      />
      <Controller
        control={form.control}
        name="phone_number"
        render={({ field: { value, onChange }, fieldState }) => (
          <AuthTextField
            label="Phone (E.164)"
            value={value}
            onChangeText={onChange}
            error={fieldState.error?.message}
            keyboardType="phone-pad"
            placeholder="+977..."
          />
        )}
      />
      <Controller
        control={form.control}
        name="whatsapp_number"
        render={({ field: { value, onChange }, fieldState }) => (
          <AuthTextField
            label="WhatsApp (optional)"
            value={value ?? ''}
            onChangeText={onChange}
            error={fieldState.error?.message}
            keyboardType="phone-pad"
            placeholder="Defaults to phone"
          />
        )}
      />

      <Controller
        control={form.control}
        name="contact_type"
        render={({ field: { value, onChange }, fieldState }) => (
          <ChipMultiSelect
            label="Role (pick one)"
            options={CONTACT_TYPES}
            selected={[value]}
            onChange={(next) => onChange((next[next.length - 1] as typeof value) || value)}
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={form.control}
        name="facility_names_text"
        render={({ field: { value, onChange }, fieldState }) => (
          <AuthTextField
            label="Facility names (one per line)"
            value={value ?? ''}
            onChangeText={onChange}
            error={fieldState.error?.message}
            multiline
            autoCapitalize="words"
          />
        )}
      />

      <Controller
        control={form.control}
        name="cities"
        render={({ field: { value, onChange }, fieldState }) => (
          <ChipMultiSelect
            label="Coverage cities"
            options={CITY_NAMES.map((c) => ({ value: c, label: c }))}
            selected={value}
            onChange={onChange}
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={form.control}
        name="preferred_channels"
        render={({ field: { value, onChange }, fieldState }) => (
          <ChipMultiSelect
            label="Preferred channels"
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
        name="environmental_topics"
        render={({ field: { value, onChange }, fieldState }) => (
          <ChipMultiSelect
            label="Topics"
            options={[
              { value: 'air', label: 'Air quality' },
              { value: 'heat', label: 'Heat' },
            ]}
            selected={value}
            onChange={onChange}
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={form.control}
        name="password"
        render={({ field: { value, onChange }, fieldState }) => (
          <AuthTextField
            label="Password"
            value={value}
            onChangeText={onChange}
            error={fieldState.error?.message}
            secureTextEntry
          />
        )}
      />
      <Controller
        control={form.control}
        name="password_confirm"
        render={({ field: { value, onChange }, fieldState }) => (
          <AuthTextField
            label="Confirm password"
            value={value}
            onChangeText={onChange}
            error={fieldState.error?.message}
            secureTextEntry
          />
        )}
      />

      <Controller
        control={form.control}
        name="consent_given"
        render={({ field: { value, onChange }, fieldState }) => (
          <ConsentToggle
            label="I consent to receive early-warning alerts on my chosen channels."
            checked={value === true}
            onChange={(next) => onChange(next ? true : false)}
            error={fieldState.error?.message}
          />
        )}
      />

      <PrimaryButton
        label={mutation.isPending ? 'Registering…' : 'Register'}
        disabled={mutation.isPending}
        onPress={form.handleSubmit((values) => mutation.mutate(values))}
      />
    </View>
  );
}
