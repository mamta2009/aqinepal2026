import { Text, View } from "react-native";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { openBrowserAsync, WebBrowserPresentationStyle } from "expo-web-browser";

import { CITY_NAMES } from "@/constants/cities";
import { API_BASE_URL } from "@/constants/api";
import {
  ChipMultiSelect,
  ConsentToggle,
  AuthTextField,
  FormSection,
  PrimaryButton,
} from "@/features/auth/FormFields";
import {
  registerSchema,
  toRegisterPayload,
  type RegisterFormValues,
} from "@/features/auth/schemas";
import { registerContact } from "@/services/api/contacts";
import { toApiError } from "@/services/api/client";
import { savePendingRegistration } from "@/utils/pendingRegistration";
import { toastError, toastSuccess } from "@/utils/toast";

const CONTACT_TYPES = [
  { value: "health_worker", label: "Health worker / doctor" },
  { value: "parent", label: "Parent / guardian" },
  { value: "admin", label: "Administrator" },
  { value: "government", label: "Government official" },
  { value: "school_admin", label: "School administrator" },
] as const;

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ne", label: "नेपाली (Nepali)" },
];

const DEFAULT_VALUES: RegisterFormValues = {
  name: "",
  email: "",
  phone_number: "+977",
  whatsapp_number: "",
  contact_type: "health_worker",
  facility_names_text: "",
  school_name: "",
  school_contact: "",
  school_address: "",
  school_information: "",
  cities: [],
  preferred_channels: ["sms", "whatsapp", "email"],
  environmental_topics: ["air", "heat"],
  language: "en",
  consent_given: false,
  privacy_agreed: false,
  data_use: false,
  password: "",
  password_confirm: "",
};

export function RegisterForm() {
  const router = useRouter();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const contactType = useWatch({ control: form.control, name: "contact_type" });
  const isSchoolAdmin = contactType === "school_admin";

  const mutation = useMutation({
    mutationFn: async (values: RegisterFormValues) => {
      const payload = toRegisterPayload(values);
      return registerContact(payload);
    },
    onSuccess: async (data, values) => {
      await savePendingRegistration(
        values.email.trim().toLowerCase(),
        data.contact_id,
      );
      const warningText =
        data.warnings && data.warnings.length > 0
          ? `\n${data.warnings.join("\n")}`
          : "";
      toastSuccess(`${data.message}${warningText}`);
      router.push("/verify");
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  const clearForm = () => {
    form.reset(DEFAULT_VALUES);
  };

  const openPrivacyPolicy = () => {
    void openBrowserAsync(`${API_BASE_URL}/privacy-policy`, {
      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
    });
  };

  return (
    <View>
      <FormSection number="1" title="About you">
        <Controller
          control={form.control}
          name="name"
          render={({ field: { value, onChange }, fieldState }) => (
            <AuthTextField
              label="Full name"
              value={value}
              onChangeText={onChange}
              error={fieldState.error?.message}
              placeholder="Sita Sharma"
              autoCapitalize="words"
            />
          )}
        />
        <Controller
          control={form.control}
          name="email"
          render={({ field: { value, onChange }, fieldState }) => (
            <AuthTextField
              label="Email address"
              value={value}
              onChangeText={onChange}
              error={fieldState.error?.message}
              placeholder="sita@example.com"
              keyboardType="email-address"
            />
          )}
        />
        <Controller
          control={form.control}
          name="phone_number"
          render={({ field: { value, onChange }, fieldState }) => (
            <AuthTextField
              label="Phone number"
              value={value}
              onChangeText={onChange}
              error={fieldState.error?.message}
              help="Use international E.164 format, for example +9779812345678"
              placeholder="+9779812345678"
              keyboardType="phone-pad"
            />
          )}
        />
        <Controller
          control={form.control}
          name="whatsapp_number"
          render={({ field: { value, onChange }, fieldState }) => (
            <AuthTextField
              label="WhatsApp number (optional)"
              value={value ?? ""}
              onChangeText={onChange}
              error={fieldState.error?.message}
              help="Leave blank to use your phone number."
              placeholder="+9779812345678"
              keyboardType="phone-pad"
            />
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field: { value, onChange }, fieldState }) => (
            <AuthTextField
              label="Dashboard password"
              value={value}
              onChangeText={onChange}
              error={fieldState.error?.message}
              help="Used to sign in after you verify your email."
              placeholder="At least 8 characters"
              secureTextEntry
              showSecureToggle
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
              showSecureToggle
            />
          )}
        />
      </FormSection>

      <FormSection
        number="2"
        title={isSchoolAdmin ? "Your school" : "Your facility or workplace"}>
        <Controller
          control={form.control}
          name="contact_type"
          render={({ field: { value, onChange }, fieldState }) => (
            <ChipMultiSelect
              label="Your role"
              options={[...CONTACT_TYPES]}
              selected={[value]}
              onChange={(next) =>
                onChange((next[0] as typeof value) || value)
              }
              error={fieldState.error?.message}
              single
            />
          )}
        />
        <Controller
          control={form.control}
          name="language"
          render={({ field: { value, onChange }, fieldState }) => (
            <ChipMultiSelect
              label="Preferred language"
              options={LANGUAGE_OPTIONS}
              selected={[value]}
              onChange={(next) =>
                onChange((next[0] as typeof value) || value)
              }
              error={fieldState.error?.message}
              single
            />
          )}
        />
        <Controller
          control={form.control}
          name="cities"
          render={({ field: { value, onChange }, fieldState }) => (
            <ChipMultiSelect
              label="Municipality / coverage area"
              options={CITY_NAMES.map((c) => ({ value: c, label: c }))}
              selected={value}
              onChange={onChange}
              error={fieldState.error?.message}
              help="You will receive municipality-level readiness alerts for every area you select."
            />
          )}
        />
        {isSchoolAdmin ? (
          <>
            <Controller
              control={form.control}
              name="school_name"
              render={({ field: { value, onChange }, fieldState }) => (
                <AuthTextField
                  label="School name"
                  value={value ?? ""}
                  onChangeText={onChange}
                  error={fieldState.error?.message}
                  help="Required. Enter the school you administer."
                  placeholder="Shree Janaki Secondary School"
                  autoCapitalize="words"
                />
              )}
            />
            <Controller
              control={form.control}
              name="school_contact"
              render={({ field: { value, onChange }, fieldState }) => (
                <AuthTextField
                  label="School contact"
                  value={value ?? ""}
                  onChangeText={onChange}
                  error={fieldState.error?.message}
                  help="Optional phone or outreach contact for the school."
                  placeholder="+977-1-XXXXXXX or school office phone"
                />
              )}
            />
            <Controller
              control={form.control}
              name="school_address"
              render={({ field: { value, onChange }, fieldState }) => (
                <AuthTextField
                  label="School address"
                  value={value ?? ""}
                  onChangeText={onChange}
                  error={fieldState.error?.message}
                  help="Optional street or locality for the school."
                  placeholder="Ward, municipality, district"
                  autoCapitalize="words"
                />
              )}
            />
            <Controller
              control={form.control}
              name="school_information"
              render={({ field: { value, onChange }, fieldState }) => (
                <AuthTextField
                  label="About the school"
                  value={value ?? ""}
                  onChangeText={onChange}
                  error={fieldState.error?.message}
                  help="Optional brief information (size, levels taught, notes)."
                  placeholder="For example: public secondary school, about 800 students"
                  multiline
                />
              )}
            />
          </>
        ) : (
          <Controller
            control={form.control}
            name="facility_names_text"
            render={({ field: { value, onChange }, fieldState }) => (
              <AuthTextField
                label="Facility name(s)"
                value={value ?? ""}
                onChangeText={onChange}
                error={fieldState.error?.message}
                help="Optional for some roles. Enter one hospital, clinic, health post, office, school, or site per line."
                placeholder={
                  "Patan Academy of Health Sciences\nWard 12 municipal clinic"
                }
                multiline
                autoCapitalize="words"
              />
            )}
          />
        )}
      </FormSection>

      <FormSection number="3" title="How should we contact you?">
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
      </FormSection>

      <FormSection number="4" title="Which conditions matter to you?">
        <Controller
          control={form.control}
          name="environmental_topics"
          render={({ field: { value, onChange }, fieldState }) => (
            <ChipMultiSelect
              label="Topics"
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
      </FormSection>

      <FormSection number="5" title="Consent and preferences">
        <Controller
          control={form.control}
          name="consent_given"
          render={({ field: { value, onChange }, fieldState }) => (
            <ConsentToggle
              label="I consent to receive alerts through the channels and topics selected above."
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
              label={
                <Text className="text-sm leading-5 text-ink">
                  I agree to the{" "}
                  <Text
                    className="font-bold text-link underline"
                    onPress={() => {
                      openPrivacyPolicy();
                    }}>
                    Privacy Policy
                  </Text>
                  .
                </Text>
              }
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
              label="I allow respiratory case data to support research (optional)."
              checked={value === true}
              onChange={(next) => onChange(next)}
              error={fieldState.error?.message}
            />
          )}
        />
      </FormSection>

      <View className="mt-1 flex-row flex-wrap gap-3">
        <View className="min-w-[45%] flex-1">
          <PrimaryButton
            label={mutation.isPending ? "Registering…" : "Register & verify"}
            disabled={mutation.isPending}
            onPress={form.handleSubmit(
              (values) => mutation.mutate(values),
              () =>
                toastError(
                  "Please fix the highlighted fields before submitting.",
                ),
            )}
          />
        </View>
        <View className="min-w-[45%] flex-1">
          <PrimaryButton
            label="Clear form"
            variant="secondary"
            onPress={clearForm}
          />
        </View>
      </View>

      <Text className="mt-3 text-center text-xs text-muted">
        After you submit, enter the code from your email on the Verify screen.
      </Text>
    </View>
  );
}
