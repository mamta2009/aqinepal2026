"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  markAccountSessionActive,
  useAccountProfile,
  useAccountQueryClient,
} from "@/hooks/use-account";
import { AccountApiError } from "@/lib/api/account";
import { AccountAuthPanel } from "./account-auth-panel";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/users/profile/";
  }
  return raw;
}

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profile = useAccountProfile();
  const queryClient = useAccountQueryClient();
  const nextPath = safeNextPath(searchParams.get("next"));
  const unauthenticated =
    profile.error instanceof AccountApiError && profile.error.status === 401;

  useEffect(() => {
    if (profile.isPending || unauthenticated || !profile.data) return;
    router.replace(nextPath);
  }, [nextPath, profile.data, profile.isPending, router, unauthenticated]);

  const onAuthenticated = async () => {
    markAccountSessionActive(queryClient);
    await queryClient.invalidateQueries({ queryKey: ["account"] });
    router.replace(nextPath);
  };

  if (profile.isPending) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <p
          className="rounded-2xl border border-border bg-white p-8 text-center font-bold text-ink-muted"
          role="status"
        >
          Checking your session…
        </p>
      </div>
    );
  }

  if (profile.data) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <p
          className="rounded-2xl border border-border bg-white p-8 text-center font-bold text-ink-muted"
          role="status"
        >
          You’re signed in. Opening your account…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <AccountAuthPanel onAuthenticated={onAuthenticated} />
    </div>
  );
}
