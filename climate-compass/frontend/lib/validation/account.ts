import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(128),
  reverification_code: z.string().max(16).optional(),
  new_password: z.string().max(128).optional(),
});

export const otpRequestSchema = z.object({
  email: z.email("Enter a valid email address."),
});

export const otpExchangeSchema = otpRequestSchema.extend({
  code: z.string().min(4, "Enter the code you received.").max(16),
});

export const verificationSchema = otpRequestSchema.extend({
  verification_code: z.string().min(4, "Enter your verification code.").max(16),
});

export const facilitySchema = z.object({
  name: z.string().trim().min(1, "Enter a school or facility name.").max(200),
});

export const contactSchema = z
  .object({
    display_name: z.string().trim().min(1, "Enter a name.").max(120),
    channel: z.enum(["sms", "email", "whatsapp"]),
    phone_e164: z.string().trim().optional(),
    email: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (value.channel === "email") {
      if (!z.email().safeParse(value.email).success) {
        context.addIssue({
          code: "custom",
          path: ["email"],
          message: "Enter a valid email address.",
        });
      }
    } else if (
      !value.phone_e164?.startsWith("+") ||
      value.phone_e164.length < 5
    ) {
      context.addIssue({
        code: "custom",
        path: ["phone_e164"],
        message: "Use international format beginning with +.",
      });
    }
  });

export const notifySchema = z.object({
  contact_ids: z.array(z.string()).min(1, "Select at least one contact."),
  message: z.string().trim().min(1, "Enter a message.").max(1200),
  confirm_recipients_consented: z.literal(true, {
    error: "Confirm that recipients consented.",
  }),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your current password.").max(128),
  confirm: z.literal("DELETE", { error: "Type DELETE exactly." }),
});

export const forgotPasswordRequestSchema = z.object({
  email: z.email("Enter a valid email address."),
});

export const forgotPasswordConfirmSchema = z
  .object({
    email: z.email("Enter a valid email address."),
    code: z.string().min(4, "Enter the code from your email.").max(16),
    new_password: z.string().min(8, "Use at least 8 characters.").max(128),
    new_password_confirm: z
      .string()
      .min(8, "Confirm your new password.")
      .max(128),
  })
  .refine((value) => value.new_password === value.new_password_confirm, {
    message: "Passwords do not match.",
    path: ["new_password_confirm"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type OtpRequestValues = z.infer<typeof otpRequestSchema>;
export type OtpExchangeValues = z.infer<typeof otpExchangeSchema>;
export type VerificationValues = z.infer<typeof verificationSchema>;
export type FacilityValues = z.infer<typeof facilitySchema>;
export type ContactValues = z.infer<typeof contactSchema>;
export type NotifyValues = z.infer<typeof notifySchema>;
export type DeleteAccountValues = z.infer<typeof deleteAccountSchema>;
export type ForgotPasswordRequestValues = z.infer<
  typeof forgotPasswordRequestSchema
>;
export type ForgotPasswordConfirmValues = z.infer<
  typeof forgotPasswordConfirmSchema
>;
