"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardKicker } from "@/components/ui/card";
import { useAccountMutation } from "@/hooks/use-account";
import {
  accountApi,
  AccountApiError,
  type ReverificationDetail,
} from "@/lib/api/account";
import {
  loginSchema,
  otpExchangeSchema,
  otpRequestSchema,
  verificationSchema,
  type LoginValues,
  type OtpExchangeValues,
  type OtpRequestValues,
  type VerificationValues,
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

export function AccountAuthPanel({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [reverify, setReverify] = useState<ReverificationDetail | null>(null);
  const [notice, setNotice] = useState("");

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const otpRequestForm = useForm<OtpRequestValues>({
    resolver: zodResolver(otpRequestSchema),
    defaultValues: { email: "" },
  });
  const otpForm = useForm<OtpExchangeValues>({
    resolver: zodResolver(otpExchangeSchema),
    defaultValues: { email: "", code: "" },
  });
  const verifyForm = useForm<VerificationValues>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { email: "", verification_code: "" },
  });

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("ew_login_email")?.trim();
      if (!saved) return;
      loginForm.setValue("email", saved);
      otpRequestForm.setValue("email", saved);
      otpForm.setValue("email", saved);
      verifyForm.setValue("email", saved);
      sessionStorage.removeItem("ew_login_email");
    } catch {
      // Prefill is optional if storage is blocked.
    }
    // Prefill once on mount after successful registration verify.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useAccountMutation(accountApi.login, {
    onSuccess: () => {
      setReverify(null);
      setNotice("Signed in securely.");
      toast.success("Signed in successfully.");
      onAuthenticated();
    },
    onError: (error) => {
      if (
        error instanceof AccountApiError &&
        error.status === 403 &&
        error.detail &&
        typeof error.detail === "object" &&
        "error" in error.detail &&
        error.detail.error === "reverification_required"
      ) {
        setReverify(error.detail as ReverificationDetail);
        setNotice("");
        return;
      }
      toast.error(error.message || "Sign in failed.");
    },
  });
  const requestOtp = useAccountMutation(accountApi.requestFacilityOtp, {
    onSuccess: (result, values) => {
      otpForm.setValue("email", values.email);
      setNotice(result.message);
      toast.success(result.message || "OTP sent.");
    },
    onError: (error) => toast.error(error.message || "Could not send OTP."),
  });
  const exchangeOtp = useAccountMutation(accountApi.exchangeFacilityOtp, {
    onSuccess: () => {
      setNotice("OTP accepted. Your secure session is ready.");
      toast.success("Signed in with facility OTP.");
      onAuthenticated();
    },
    onError: (error) => toast.error(error.message || "OTP sign-in failed."),
  });
  const verify = useAccountMutation(accountApi.verifyRegistration, {
    onSuccess: (result) => {
      const message = result.message || "Registration verified. You can sign in now.";
      setNotice(message);
      toast.success(message);
    },
    onError: (error) => toast.error(error.message || "Verification failed."),
  });

  const mutationError =
    login.error || requestOtp.error || exchangeOtp.error || verify.error;

  return (
    <section aria-labelledby="account-signin-heading" className="grid gap-5">
      <div>
        <CardKicker>Registrant access</CardKicker>
        <h1 id="account-signin-heading" className="text-3xl font-black text-ink">
          Sign in to your clean-air account
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Manage facilities, alert preferences, preparedness actions, and trusted contacts.
          Your session is stored in a secure HttpOnly cookie.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sign-in method">
        <Button
          role="tab"
          aria-selected={mode === "password"}
          variant={mode === "password" ? "primary" : "secondary"}
          onClick={() => setMode("password")}
        >
          Email and password
        </Button>
        <Button
          role="tab"
          aria-selected={mode === "otp"}
          variant={mode === "otp" ? "primary" : "secondary"}
          onClick={() => setMode("otp")}
        >
          Facility OTP
        </Button>
      </div>

      <Card className="max-w-2xl">
        {mode === "password" ? (
          <form
            className="grid gap-4"
            onSubmit={loginForm.handleSubmit((values) => login.mutate(values))}
          >
            <h2 className="text-xl font-black text-ink">Account login</h2>
            <label className={labelClass}>
              Email
              <input
                className={inputClass}
                type="email"
                autoComplete="email"
                {...loginForm.register("email")}
              />
            </label>
            <ErrorText message={loginForm.formState.errors.email?.message} />
            <label className={labelClass}>
              Current password
              <input
                className={inputClass}
                type="password"
                autoComplete="current-password"
                {...loginForm.register("password")}
              />
            </label>
            <ErrorText message={loginForm.formState.errors.password?.message} />

            {reverify ? (
              <fieldset className="grid gap-3 rounded-xl border border-warning-amber/40 bg-warning-amber/10 p-4">
                <legend className="px-1 font-black text-ink">Security renewal</legend>
                <p className="text-sm text-ink-muted">{reverify.message}</p>
                <label className={labelClass}>
                  Security code
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    {...loginForm.register("reverification_code")}
                  />
                </label>
                <label className={labelClass}>
                  New password
                  <input
                    className={inputClass}
                    type="password"
                    autoComplete="new-password"
                    {...loginForm.register("new_password")}
                  />
                </label>
              </fieldset>
            ) : null}

            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? "Signing in…" : reverify ? "Renew and sign in" : "Sign in"}
            </Button>
          </form>
        ) : (
          <div className="grid gap-6">
            <form
              className="grid gap-3"
              onSubmit={otpRequestForm.handleSubmit((values) => requestOtp.mutate(values))}
            >
              <h2 className="text-xl font-black text-ink">Request a facility code</h2>
              <label className={labelClass}>
                Registration email
                <input
                  className={inputClass}
                  type="email"
                  autoComplete="email"
                  {...otpRequestForm.register("email")}
                />
              </label>
              <ErrorText message={otpRequestForm.formState.errors.email?.message} />
              <Button type="submit" disabled={requestOtp.isPending}>
                {requestOtp.isPending ? "Requesting…" : "Send OTP"}
              </Button>
            </form>
            <form
              className="grid gap-3 border-t border-border pt-5"
              onSubmit={otpForm.handleSubmit((values) => exchangeOtp.mutate(values))}
            >
              <h3 className="font-black text-ink">Exchange OTP</h3>
              <label className={labelClass}>
                Email
                <input className={inputClass} type="email" {...otpForm.register("email")} />
              </label>
              <label className={labelClass}>
                One-time code
                <input
                  className={inputClass}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  {...otpForm.register("code")}
                />
              </label>
              <ErrorText
                message={
                  otpForm.formState.errors.email?.message ||
                  otpForm.formState.errors.code?.message
                }
              />
              <Button type="submit" disabled={exchangeOtp.isPending}>
                {exchangeOtp.isPending ? "Checking…" : "Sign in with OTP"}
              </Button>
            </form>
          </div>
        )}
      </Card>

      <details className="max-w-2xl rounded-2xl border border-border bg-white p-5">
        <summary className="cursor-pointer font-black text-ink">
          Verify a new registration
        </summary>
        <form
          className="mt-4 grid gap-3"
          onSubmit={verifyForm.handleSubmit((values) => verify.mutate(values))}
        >
          <label className={labelClass}>
            Registration email
            <input className={inputClass} type="email" {...verifyForm.register("email")} />
          </label>
          <label className={labelClass}>
            Signup verification code
            <input
              className={inputClass}
              inputMode="numeric"
              autoComplete="one-time-code"
              {...verifyForm.register("verification_code")}
            />
          </label>
          <Button type="submit" disabled={verify.isPending}>
            Verify registration
          </Button>
        </form>
      </details>

      {notice ? (
        <p className="rounded-xl bg-forest/10 p-3 text-sm font-bold text-forest-dark" role="status">
          {notice}
        </p>
      ) : null}
      <ErrorText message={mutationError?.message} />
    </section>
  );
}
