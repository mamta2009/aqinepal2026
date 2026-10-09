"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { browserApi } from "@/lib/api/browser";

type MessageResponse = { message?: string; success?: boolean };

export function DeletePublicFlow() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [busy, setBusy] = useState<"request" | "confirm" | null>(null);
  const [status, setStatus] = useState<{
    kind: "success" | "error" | "info";
    text: string;
  } | null>(null);

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    if (!email.trim()) {
      setStatus({ kind: "error", text: "Enter your registered email." });
      return;
    }
    setBusy("request");
    setStatus({ kind: "info", text: "Sending a confirmation code…" });
    try {
      const result = await browserApi<MessageResponse>(
        "api/auth/delete-account/request",
        { method: "POST", body: { email: email.trim() } },
      );
      setCodeRequested(true);
      setStatus({
        kind: "success",
        text: result.message || "If registered, a confirmation code was sent.",
      });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete(event: FormEvent) {
    event.preventDefault();
    if (code.trim().length < 4) {
      setStatus({ kind: "error", text: "Enter the confirmation code." });
      return;
    }
    if (confirmation !== "DELETE") {
      setStatus({ kind: "error", text: "Type DELETE exactly to continue." });
      return;
    }
    setBusy("confirm");
    setStatus({ kind: "info", text: "Permanently deleting your account…" });
    try {
      const result = await browserApi<MessageResponse>(
        "api/auth/delete-account/confirm",
        {
          method: "POST",
          body: { email: email.trim(), code: code.trim(), confirm: confirmation },
        },
      );
      setDeleted(true);
      setCode("");
      setConfirmation("");
      setStatus({
        kind: "success",
        text: result.message || "Your account was deleted.",
      });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Deletion failed.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-6">
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <strong>This cannot be undone.</strong> We process deletion immediately
        after you confirm with a one-time code and type DELETE.
      </div>

      <form onSubmit={requestCode} className="space-y-3">
        <label htmlFor="delete-email" className="block text-sm font-bold">
          Registered email
        </label>
        <input
          id="delete-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={deleted}
          className={inputClass}
          placeholder="you@example.com"
        />
        <Button type="submit" disabled={busy !== null || deleted}>
          {busy === "request"
            ? "Sending…"
            : codeRequested
              ? "Resend confirmation code"
              : "Send confirmation code"}
        </Button>
      </form>

      {codeRequested && !deleted && (
        <form onSubmit={confirmDelete} className="space-y-4 border-t border-border pt-6">
          <div>
            <label htmlFor="delete-code" className="block text-sm font-bold">
              Confirmation code
            </label>
            <input
              id="delete-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={16}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="delete-confirmation" className="block text-sm font-bold">
              Type DELETE to confirm
            </label>
            <input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              className={inputClass}
              placeholder="DELETE"
            />
          </div>
          <Button variant="danger" type="submit" disabled={busy !== null}>
            {busy === "confirm" ? "Deleting…" : "Delete my account permanently"}
          </Button>
        </form>
      )}

      {status && (
        <p
          role="status"
          className={
            status.kind === "error"
              ? "rounded-xl bg-red-50 p-3 text-sm text-red-800"
              : status.kind === "success"
                ? "rounded-xl bg-surface-tint p-3 text-sm text-forest-dark"
                : "rounded-xl bg-sky-soft p-3 text-sm"
          }
        >
          {status.text}
        </p>
      )}
    </Card>
  );
}

const inputClass =
  "mt-1 min-h-11 w-full rounded-xl border border-border-strong bg-white px-3 py-2 disabled:bg-surface";
