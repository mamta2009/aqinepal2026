import type { Metadata } from "next";
import { ForgotPasswordPanel } from "@/components/account/forgot-password-panel";

export const metadata: Metadata = {
  title: "Forgot password",
  description:
    "Reset your Climate Compass registrant password with an email verification code.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <ForgotPasswordPanel />
    </div>
  );
}
