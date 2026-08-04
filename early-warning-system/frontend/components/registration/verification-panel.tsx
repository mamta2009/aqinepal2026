"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRegistration } from "@/hooks/use-registration";

export function VerificationPanel({
  initialEmail = "",
  initialContactId = "",
}: {
  initialEmail?: string;
  initialContactId?: string;
}) {
  const { resend, verify } = useRegistration();
  const [email, setEmail] = useState(initialEmail);
  const [contactId, setContactId] = useState(initialContactId);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<{
    kind: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState<"verify" | "resend" | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() && !contactId.trim()) {
      setStatus({ kind: "error", text: "Enter your registration email or reference ID." });
      return;
    }
    if (code.trim().length < 4) {
      setStatus({ kind: "error", text: "Enter the verification code you received." });
      return;
    }
    setBusy("verify");
    setStatus({ kind: "info", text: "Checking your code…" });
    try {
      const result = await verify({ email, contactId, code });
      setStatus({
        kind: "success",
        text:
          result.message ||
          "Verified. You can now sign in with your email and password.",
      });
      setCode("");
      sessionStorage.removeItem("ew_reg_contact_id");
      sessionStorage.removeItem("ew_reg_email");
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Verification failed.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function resendCode() {
    if (!email.trim()) {
      setStatus({ kind: "error", text: "Enter your registration email to resend." });
      return;
    }
    setBusy("resend");
    setStatus({ kind: "info", text: "Sending another code…" });
    try {
      const result = await resend(email);
      const warnings = result.warnings?.length
        ? ` ${result.warnings.join("; ")}`
        : "";
      setStatus({
        kind: "success",
        text: `${result.message || "If this email is pending, a code was sent."}${warnings}`,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not resend the code.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <p className="eyebrow">Finish signup</p>
        <h2 className="text-2xl font-extrabold">Verify your registration</h2>
        <p className="mt-2 text-sm text-muted">
          The same code is sent through your selected email, SMS, and WhatsApp
          channels. Email is the easiest way to identify your registration.
        </p>
      </div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Registration email" htmlFor="verify-email">
          <input
            id="verify-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            placeholder="you@facility.org"
          />
        </Field>
        <Field label="Reference ID (optional)" htmlFor="verify-reference">
          <input
            id="verify-reference"
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
            className={inputClass}
            spellCheck={false}
          />
        </Field>
        <Field label="Verification code" htmlFor="verify-code">
          <input
            id="verify-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={16}
            className={inputClass}
          />
        </Field>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" disabled={busy !== null}>
            {busy === "verify" ? "Verifying…" : "Verify code"}
          </Button>
          <Button
            variant="secondary"
            onClick={resendCode}
            disabled={busy !== null}
          >
            {busy === "resend" ? "Sending…" : "Resend"}
          </Button>
        </div>
      </form>
      {status && (
        <p
          role="status"
          className={
            status.kind === "error"
              ? "rounded-xl bg-red-50 p-3 text-sm text-red-800"
              : status.kind === "success"
                ? "rounded-xl bg-surface-tint p-3 text-sm text-forest-dark"
                : "rounded-xl bg-sky-soft p-3 text-sm text-ink"
          }
        >
          {status.text}
        </p>
      )}
    </Card>
  );
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-border-strong bg-white px-3 py-2";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-bold">
        {label}
      </label>
      {children}
    </div>
  );
}
