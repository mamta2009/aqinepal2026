import { useState } from 'react';
import { Text, View } from 'react-native';
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
  FormSection,
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
  { value: 'health_worker', label: 'Health Worker / Doctor' },
  { value: 'parent', label: 'Parent / Guardian' },
  { value: 'admin', label: 'Administrator' },
  { value: 'government', label: 'Government Official' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ne', label: 'नेपाली (Nepali)' },
];

const DEFAULT_VALUES: RegisterFormValues = {
  name: '',
  email: '',
  phone_number: '+977',
  whatsapp_number: '',
  contact_type: 'health_worker',
  facility_names_text: '',
  cities: [],
  preferred_channels: ['sms', 'whatsapp', 'email'],
  environmental_topics: ['air', 'heat'],
  language: 'en',
  consent_given: false,
  privacy_agreed: false,
  data_use: false,
  password: '',
  password_confirm: '',
};

export function RegisterForm() {
  const router = useRouter();
  const [banner, setBanner] = useState<{ message: string; tone: 'info' | 'error' | 'success' } | null>(
    null,
  );

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: DEFAULT_VALUES,
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

  const clearForm = () => {
    form.reset(DEFAULT_VALUES);
    setBanner(null);
  };

  return (
    <View>
      {banner ? <Banner message={banner.message} tone={banner.tone} /> : null}

      <FormSection title="Personal Information">
        <Controller
          control={form.control}
          name="name"
          render={({ field: { value, onChange }, fieldState }) => (
            <AuthTextField
              label="Full Name *"
              value={value}
              onChangeText={onChange}
              error={fieldState.error?.message}
              placeholder="Dr. Sharma"
              autoCapitalize="words"
            />
          )}
        />
        <Controller
          control={form.control}
          name="email"
          render={({ field: { value, onChange }, fieldState }) => (
            <AuthTextField
              label="Email Address *"
              value={value}
              onChangeText={onChange}
              error={fieldState.error?.message}
              placeholder="sharma@hospital.com"
              keyboardType="email-address"
            />
          )}
        />
        <Controller
          control={form.control}
          name="phone_number"
          render={({ field: { value, onChange }, fieldState }) => (
            <AuthTextField
              label="Phone Number *"
              value={value}
              onChangeText={onChange}
              error={fieldState.error?.message}
              help="Include country code (e.g., +977)"
              placeholder="+977-98XXXXXXXX"
              keyboardType="phone-pad"
            />
          )}
        />
        <Controller
          control={form.control}
          name="whatsapp_number"
          render={({ field: { value, onChange }, fieldState }) => (
            <AuthTextField
              label="WhatsApp Number (Optional)"
              value={value ?? ''}
              onChangeText={onChange}
              error={fieldState.error?.message}
              help="Leave blank to use phone number"
              placeholder="+977-98XXXXXXXX"
              keyboardType="phone-pad"
            />
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field: { value, onChange }, fieldState }) => (
            <AuthTextField
              label="Dashboard password *"
              value={value}
              onChangeText={onChange}
              error={fieldState.error?.message}
              help="Used to sign in after you verify your email / phone."
              placeholder="At least 8 characters"
              secureTextEntry
            />
          )}
        />
        <Controller
          control={form.control}
          name="password_confirm"
          render={({ field: { value, onChange }, fieldState }) => (
            <AuthTextField
              label="Confirm password *"
              value={value}
              onChangeText={onChange}
              error={fieldState.error?.message}
              secureTextEntry
            />
          )}
        />
      </FormSection>

      <FormSection title="Facility Information">
        <Controller
          control={form.control}
          name="contact_type"
          render={({ field: { value, onChange }, fieldState }) => (
            <ChipMultiSelect
              label="Your Role *"
              options={CONTACT_TYPES}
              selected={[value]}
              onChange={(next) => onChange((next[0] as typeof value) || value)}
              error={fieldState.error?.message}
              single
            />
          )}
        />
        <Controller
          control={form.control}
          name="facility_names_text"
          render={({ field: { value, onChange }, fieldState }) => (
            <AuthTextField
              label="Facility name(s)"
              value={value ?? ''}
              onChangeText={onChange}
              error={fieldState.error?.message}
              help="Enter one facility or site per line if you cover more than one place. Optional for some roles."
              placeholder={"e.g. Patan Academy of Health Sciences (PAHS)\nor: Ward 12 municipal clinic"}
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
              label="Municipality / coverage area *"
              options={CITY_NAMES.map((c) => ({ value: c, label: c }))}
              selected={value}
              onChange={onChange}
              error={fieldState.error?.message}
              help="You will receive municipality-level readiness alerts for every area you select."
            />
          )}
        />
        <Controller
          control={form.control}
          name="language"
          render={({ field: { value, onChange }, fieldState }) => (
            <ChipMultiSelect
              label="Preferred Language"
              options={LANGUAGE_OPTIONS}
              selected={[value]}
              onChange={(next) => onChange((next[0] as typeof value) || value)}
              error={fieldState.error?.message}
              single
            />
          )}
        />
      </FormSection>

      <FormSection
        title="Notification Channels"
        description="Select how you'd like to receive alerts:">
        <Controller
          control={form.control}
          name="preferred_channels"
          render={({ field: { value, onChange }, fieldState }) => (
            <ChipMultiSelect
              label="Channels *"
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
      </FormSection>

      <FormSection
        title="Environmental hazards"
        description="Municipality-level readiness pushes on the channels you selected above. Choose at least one topic.">
        <Controller
          control={form.control}
          name="environmental_topics"
          render={({ field: { value, onChange }, fieldState }) => (
            <ChipMultiSelect
              label="Topics *"
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
      </FormSection>

      <FormSection title="Consent & Preferences">
        <Controller
          control={form.control}
          name="consent_given"
          render={({ field: { value, onChange }, fieldState }) => (
            <ConsentToggle
              label="I give consent to receive air quality and heat readiness alerts via the channels and topics I selected above. I understand I can revisit these choices with program support when available."
              checked={value === true}
              onChange={(next) => onChange(next)}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="privacy_agreed"
          render={({ field: { value, onChange }, fieldState }) => (
            <ConsentToggle
              label="I agree to the Privacy Policy and understand my data will be protected according to GDPR and healthcare privacy standards."
              checked={value === true}
              onChange={(next) => onChange(next)}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="data_use"
          render={({ field: { value, onChange }, fieldState }) => (
            <ConsentToggle
              label="I allow my respiratory case data to be used for research to improve the Early Warning System (optional but appreciated)."
              checked={value === true}
              onChange={(next) => onChange(next)}
              error={fieldState.error?.message}
            />
          )}
        />
      </FormSection>

      <View className="mt-1 flex-row gap-3">
        <View className="flex-1">
          <PrimaryButton label="Clear Form" variant="dangerOutline" onPress={clearForm} />
        </View>
        <View className="flex-1">
          <PrimaryButton
            label={mutation.isPending ? 'Registering…' : 'Register & Verify'}
            disabled={mutation.isPending}
            onPress={form.handleSubmit(
              (values) => mutation.mutate(values),
              () =>
                setBanner({
                  message: 'Please fix the highlighted fields before submitting.',
                  tone: 'error',
                }),
            )}
          />
        </View>
      </View>

      <Text className="mt-3 text-center text-xs text-neutral-500">
        After registering, enter the verification code sent to your selected channels.
      </Text>
    </View>
  );
}
