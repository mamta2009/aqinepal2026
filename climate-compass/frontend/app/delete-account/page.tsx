import type { Metadata } from "next";
import Link from "next/link";
import { DeletePublicFlow } from "@/components/account/delete-public-flow";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Delete your account",
  description:
    "Request permanent deletion of your Climate Compass registration and personal data.",
};

export default function DeleteAccountPage() {
  return (
    <div className="page-shell section-space max-w-3xl">
      <header className="mb-7">
        <p className="eyebrow">Public account controls</p>
        <h1 className="text-4xl font-extrabold tracking-tight">
          Delete your account
        </h1>
        <p className="mt-3 text-ink-soft">
          Request permanent deletion without installing the mobile app.
        </p>
      </header>

      <Card className="mb-6">
        <h2 className="text-2xl font-extrabold">What gets deleted</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-soft">
          <li>Your registration, contact details, and alert preferences</li>
          <li>Consent records and notification delivery history tied to you</li>
          <li>Friends and family alert contacts you saved</li>
        </ul>
        <p className="mt-3 text-sm text-muted">
          Facility preparedness actions may be retained only in anonymized form
          for operational audit. You can register the same email again later.
        </p>
      </Card>

      <DeletePublicFlow />

      <p className="mt-6 text-center text-sm">
        <Link href="/" className="font-bold text-link underline">Home</Link>
        {" · "}
        <Link href="/privacy-policy" className="font-bold text-link underline">
          Privacy policy
        </Link>
      </p>
    </div>
  );
}
