"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardKicker } from "@/components/ui/card";
import { useAccountMutation } from "@/hooks/use-account";
import { accountApi } from "@/lib/api/account";
import {
  forgotPasswordConfirmSchema,
  forgotPasswordRequestSchema,
  type ForgotPasswordConfirmValues,
  type ForgotPasswordRequestValues,
} from "@/lib/validation/account";

const inputClass =
  "min-h-11 w-full rounded-xl border border-border-strong bg-white px-3 text-ink outline-none focus:border-forest focus:ring-3 focus:ring-forest/15";
const labelClass = "grid gap-1.5 text-sm font-bold text-ink";

function ErrorText({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm font-semibold text-alert-red" role="alert">
      {message}
    </p>
  ) : null;
}

export function ForgotPasswordPanel() {
  const [codeSent, setCodeSent] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState("");

  const requestForm = useForm<ForgotPasswordRequestValues>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: "" },
  });
  const confirmForm = useForm<ForgotPasswordConfirmValues>({
    resolver: zodResolver(forgotPasswordConfirmSchema),
    defaultValues: {
      email: "",
      code: "",
      new_password: "",
      new_password_confirm: "",
    },
  });

  const requestReset = useAccountMutation(accountApi.requestPasswordReset, {
    onSuccess: (result, values) => {
      const message =
        result.message ||
        "If this email has a password login, a reset code was sent.";
      setNotice(message);
      setCodeSent(true);
      confirmForm.setValue("email", values.email);
      toast.success(message);
    },
    onError: (error) => toast.error(error.message || "Could not send reset code."),
  });

  const confirmReset = useAccountMutation(accountApi.confirmPasswordReset, {
    onSuccess: (result) => {
      const message =
        result.message || "Password updated. You can sign in with your new password.";
      setNotice(message);
      setDone(true);
      toast.success(message);
    },
    onError: (error) =>
      toast.error(error.message || "Could not reset password."),
  });

  return (
    <section aria-labelledby="forgot-password-heading" className="grid gap-5">
      <div>
        <CardKicker>Account recovery</CardKicker>
        <h1 id="forgot-password-heading" className="text-3xl font-black text-ink">
          Forgot your password?
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Enter the email on your Climate Compass account. We will send a one-time
          reset code to that email only.
        </p>
      </div>

      <Card className="max-w-2xl">
        {done ? (
          <div className="grid gap-4">
            <p className="rounded-xl bg-forest/10 p-3 text-sm font-bold text-forest-dark" role="status">
              {notice || "Password updated."}
            </p>
            <ButtonLink href="/login/">Back to sign in</ButtonLink>
          </div>
        ) : (
          <div className="grid gap-6">
            <form
              className="grid gap-3"
              onSubmit={requestForm.handleSubmit((values) =>
                requestReset.mutate(values),
              )}
            >
              <h2 className="text-xl font-black text-ink">1. Request a reset code</h2>
              <label className={labelClass}>
                Registered email
                <input
                  className={inputClass}
                  type="email"
                  autoComplete="email"
                  {...requestForm.register("email")}
                />
              </label>
              <ErrorText message={requestForm.formState.errors.email?.message} />
              <Button type="submit" disabled={requestReset.isPending}>
                {requestReset.isPending
                  ? "Sending…"
                  : codeSent
                    ? "Resend code"
                    : "Send reset code"}
              </Button>
            </form>

            {codeSent ? (
              <form
                className="grid gap-3 border-t border-border pt-5"
                onSubmit={confirmForm.handleSubmit((values) =>
                  confirmReset.mutate({
                    email: values.email,
                    code: values.code,
                    new_password: values.new_password,
                  }),
                )}
              >
                <h2 className="text-xl font-black text-ink">2. Choose a new password</h2>
                <p className="text-sm text-ink-muted">
                  Check the inbox for{" "}
                  <span className="font-bold text-ink">
                    {confirmForm.watch("email")}
                  </span>
                  , enter the Climate Compass reset code, then set a new password
                  (at least 8 characters).
                </p>
                <input type="hidden" {...confirmForm.register("email")} />
                <label className={labelClass}>
                  Reset code from email
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    {...confirmForm.register("code")}
                  />
                </label>
                <ErrorText message={confirmForm.formState.errors.code?.message} />
                <label className={labelClass}>
                  New password
                  <input
                    className={inputClass}
                    type="password"
                    autoComplete="new-password"
                    {...confirmForm.register("new_password")}
                  />
                </label>
                <ErrorText
                  message={confirmForm.formState.errors.new_password?.message}
                />
                <label className={labelClass}>
                  Confirm new password
                  <input
                    className={inputClass}
                    type="password"
                    autoComplete="new-password"
                    {...confirmForm.register("new_password_confirm")}
                  />
                </label>
                <ErrorText
                  message={
                    confirmForm.formState.errors.new_password_confirm?.message
                  }
                />
                <Button type="submit" disabled={confirmReset.isPending}>
                  {confirmReset.isPending ? "Updating…" : "Update password"}
                </Button>
              </form>
            ) : null}
          </div>
        )}
      </Card>

      {notice && !done ? (
        <p
          className="max-w-2xl rounded-xl bg-forest/10 p-3 text-sm font-bold text-forest-dark"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <p className="max-w-2xl text-sm text-ink-muted">
        Remembered it?{" "}
        <Link href="/login/" className="font-bold text-link underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}
