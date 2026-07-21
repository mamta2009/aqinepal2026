import { z } from "zod";

import { CITY_NAMES } from "@/constants/cities";

export const contactTypeSchema = z.enum([
  "health_worker",
  "parent",
  "admin",
  "government",
]);

export const channelSchema = z.enum(["sms", "whatsapp", "email"]);
export const topicSchema = z.enum(["air", "heat"]);
export const languageSchema = z.enum(["en", "ne"]);

const citySchema = z.enum(CITY_NAMES as unknown as [string, ...string[]]);

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().trim().email("Valid email is required"),
    phone_number: z
      .string()
      .trim()
      .min(1, "Phone is required")
      .refine((v) => v.startsWith("+"), "Phone must start with + (E.164)"),
    whatsapp_number: z.string().trim().optional().or(z.literal("")),
    contact_type: contactTypeSchema,
    facility_names_text: z.string().optional().or(z.literal("")),
    cities: z.array(citySchema).min(1, "Select at least one city"),
    preferred_channels: z
      .array(channelSchema)
      .min(1, "Select at least one channel"),
    environmental_topics: z
      .array(topicSchema)
      .min(1, "Select at least one topic"),
    language: languageSchema,
    consent_given: z
      .boolean()
      .refine((v) => v === true, { message: "Consent is required" }),
    privacy_agreed: z
      .boolean()
      .refine((v) => v === true, { message: "Privacy agreement is required" }),
    data_use: z.boolean(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
    password_confirm: z.string().min(8).max(128),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: "Passwords do not match",
    path: ["password_confirm"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const verifySchema = z
  .object({
    email: z.string().trim().email().optional().or(z.literal("")),
    contact_id: z.string().trim().optional().or(z.literal("")),
    verification_code: z
      .string()
      .trim()
      .min(4, "Code is required")
      .max(16, "Code is too long"),
  })
  .refine(
    (data) => Boolean(data.email?.trim()) || Boolean(data.contact_id?.trim()),
    {
      message: "Email or contact id is required",
      path: ["email"],
    },
  );

export type VerifyFormValues = z.infer<typeof verifySchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  password: z.string().min(1, "Password is required").max(128),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const otpRequestSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
});

export type OtpRequestFormValues = z.infer<typeof otpRequestSchema>;

export const otpExchangeSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  code: z.string().trim().min(4, "Code is required").max(16),
});

export type OtpExchangeFormValues = z.infer<typeof otpExchangeSchema>;

export const signupVerifySchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  verification_code: z.string().trim().min(4).max(16),
});

export type SignupVerifyFormValues = z.infer<typeof signupVerifySchema>;

export const channelPrefsSchema = z.object({
  preferred_channels: z
    .array(channelSchema)
    .min(1, "Select at least one channel"),
  consent_given: z.boolean(),
});

export type ChannelPrefsFormValues = z.infer<typeof channelPrefsSchema>;

/** Build API register payload from form values (drops confirm password and local-only flags). */
export function toRegisterPayload(values: RegisterFormValues) {
  const phone = values.phone_number.trim();
  const whatsapp = (values.whatsapp_number || "").trim() || phone;
  const facility_names = (values.facility_names_text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    phone_number: phone,
    whatsapp_number: whatsapp,
    contact_type: values.contact_type,
    facility_names,
    cities: values.cities,
    preferred_channels: values.preferred_channels,
    environmental_topics: values.environmental_topics,
    language: values.language,
    consent_given: values.consent_given === true,
    password: values.password,
  };
}
