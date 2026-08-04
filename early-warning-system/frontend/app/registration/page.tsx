import type { Metadata } from "next";
import Link from "next/link";
import { RegistrationForm } from "@/components/registration/registration-form";

export const metadata: Metadata = {
  title: "Register alerts",
  description:
    "Register for place-based air quality and heat readiness alerts.",
};

export default function RegistrationPage() {
  return (
    <div className="page-shell section-space max-w-5xl">
      <header className="mb-8">
        <p className="eyebrow">Optional public registration</p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Get air and heat alerts
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          Choose the municipalities and contact channels that matter to you.
          After you submit, enter the code from your email in Step 2 on this page.
          You can still use the{" "}
          <Link href="/dashboard" className="font-bold text-link underline">
            dashboard
          </Link>{" "}
          without registering.
        </p>
      </header>
      <RegistrationForm />
      <p className="mt-8 text-center text-sm text-muted">
        Authorized program staff can open the{" "}
        <Link
          href="/registration/contacts-directory"
          className="font-bold text-link underline"
        >
          passphrase-protected registrant directory
        </Link>
        .
      </p>
    </div>
  );
}
