import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPage } from "@/components/account/login-page";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Climate Compass registrant account.",
};

export default function LoginRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <p
            className="rounded-2xl border border-border bg-white p-8 text-center font-bold text-ink-muted"
            role="status"
          >
            Loading sign in…
          </p>
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
