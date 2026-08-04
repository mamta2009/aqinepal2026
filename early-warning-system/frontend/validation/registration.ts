import { z } from "zod";

export const CITIES = [
  "Kathmandu",
  "Lalitpur",
  "Bhaktapur",
  "Banepa",
  "Dhulikhel",
  "Hetauda",
  "Bharatpur",
  "Narayanghad",
] as const;

export const CONTACT_TYPES = [
  "health_worker",
  "parent",
  "admin",
  "government",
] as const;

export const CHANNELS = ["sms", "whatsapp", "email"] as const;
export const TOPICS = ["air", "heat"] as const;

const e164 = /^\+[1-9]\d{7,14}$/;
const normalizePhone = (value: string) => value.replace(/[\s()-]/g, "");

export const registrationSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(160),
    email: z.email("Enter a valid email address."),
    phone_number: z
      .string()
      .trim()
      .transform(normalizePhone)
      .refine((value) => e164.test(value), {
        message: "Use international E.164 format, for example +9779812345678.",
      }),
    whatsapp_number: z
      .string()
      .trim()
      .transform(normalizePhone)
      .refine((value) => !value || e164.test(value), {
        message: "Use international E.164 format, for example +9779812345678.",
      }),
    password: z.string().min(8, "Use at least 8 characters.").max(128),
    password_confirmation: z.string(),
    contact_type: z.enum(CONTACT_TYPES, {
      message: "Select your role.",
    }),
    facility_names_text: z.string().max(2000),
    cities: z.array(z.enum(CITIES)).min(1, "Select at least one municipality."),
    language: z.enum(["en", "ne"]),
    preferred_channels: z
      .array(z.enum(CHANNELS))
      .min(1, "Select at least one contact channel."),
    environmental_topics: z
      .array(z.enum(TOPICS))
      .min(1, "Select air quality and/or heat."),
    consent_given: z.boolean().refine(Boolean, {
      message: "Consent is required to send alerts.",
    }),
    privacy_accepted: z.boolean().refine(Boolean, {
      message: "Accept the privacy policy to continue.",
    }),
    research_data_use: z.boolean(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    path: ["password_confirmation"],
    message: "Passwords do not match.",
  });

export type RegistrationValues = z.input<typeof registrationSchema>;
export type RegistrationParsed = z.output<typeof registrationSchema>;

export function toRegistrationPayload(values: RegistrationParsed) {
  const facilityNames = values.facility_names_text
    .split(/\r?\n|;/)
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    name: values.name,
    email: values.email,
    phone_number: values.phone_number,
    whatsapp_number: values.whatsapp_number || values.phone_number,
    contact_type: values.contact_type,
    facility_names: facilityNames,
    cities: values.cities,
    preferred_channels: values.preferred_channels,
    environmental_topics: values.environmental_topics,
    language: values.language,
    consent_given: values.consent_given,
    password: values.password,
  };
}
