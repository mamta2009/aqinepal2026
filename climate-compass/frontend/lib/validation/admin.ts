import { z } from "zod";

export const pinSchema = z.object({
  pin: z.string().trim().min(1, "Enter the operator PIN.").max(240),
});

export const thresholdSchema = z.object({
  threshold: z
    .number()
    .min(5, "Use a value from 5 to 600.")
    .max(600, "Use a value from 5 to 600."),
});

const phone = z
  .string()
  .trim()
  .regex(/^\+\d{7,15}$/, "Use an international number such as +9779812345678.");

export const registrantSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required."),
    email: z.email("Enter a valid email address."),
    phone_number: phone,
    whatsapp_number: z
      .string()
      .trim()
      .refine((value) => !value || /^\+\d{7,15}$/.test(value), {
        message: "Use an international number beginning with +.",
      }),
    password: z
      .string()
      .min(8, "Password must contain at least 8 characters.")
      .max(128),
    password_confirmation: z.string(),
    contact_type: z.enum([
      "health_worker",
      "parent",
      "admin",
      "government",
      "school_admin",
    ]),
    cities: z.array(z.string()).min(1, "Select at least one municipality."),
    facility_names: z.string(),
    school_name: z.string().max(200),
    school_contact: z.string().max(200),
    school_address: z.string().max(500),
    school_information: z.string().max(2000),
    facility_id: z.string(),
    preferred_channels: z
      .array(z.enum(["sms", "whatsapp", "email"]))
      .min(1, "Select at least one alert channel."),
    environmental_topics: z
      .array(z.enum(["air", "heat"]))
      .min(1, "Select air quality and/or heat."),
    language: z.enum(["en", "ne"]),
    consent_given: z.boolean(),
    send_verification: z.boolean(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    path: ["password_confirmation"],
    message: "Passwords do not match.",
  })
  .superRefine((data, ctx) => {
    if (data.contact_type === "school_admin" && !data.school_name.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["school_name"],
        message: "School name is required for school administrators.",
      });
    }
  });

export const enrolmentSchema = z.object({
  cities: z.array(z.string()).min(1, "Select at least one municipality."),
  facility_names: z.string(),
  facility_id: z.string(),
});

export const passwordSchema = z.object({
  new_password: z
    .string()
    .min(8, "Password must contain at least 8 characters.")
    .max(128),
});

export const outcomeSchema = z.object({
  facility_id: z.string().trim().min(1, "Facility ID is required.").max(256),
  facility_display_name: z.string().trim().max(500),
  day: z.iso.date("Use a date in YYYY-MM-DD format."),
  respiratory_cases: z.number().int().min(0).max(1_000_000),
  severe_cases: z.number().int().min(0).max(1_000_000),
});

export type RegistrantInput = z.infer<typeof registrantSchema>;
export type EnrolmentInput = z.infer<typeof enrolmentSchema>;
export type OutcomeInput = z.infer<typeof outcomeSchema>;
