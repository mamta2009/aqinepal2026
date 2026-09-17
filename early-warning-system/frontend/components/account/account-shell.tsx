"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useAccountMutation,
  useAccountProfile,
  useAccountQueryClient,
  useRefreshAccount,
  clearAccountSession,
  markAccountSessionActive,
} from "@/hooks/use-account";
import { accountApi, AccountApiError, type AccountProfile } from "@/lib/api/account";
import { cn } from "@/lib/utils/cn";

export const accountNav = [
  { href: "/users/profile/", label: "Profile" },
  { href: "/users/preferences/", label: "Preferences" },
  { href: "/users/contacts/", label: "Trusted contacts" },
  { href: "/users/facilities/", label: "Facilities" },
  { href: "/users/notifications/", label: "Notifications" },
  { href: "/users/security/", label: "Security" },
] as const;

function navActive(pathname: string, href: string) {
  const current = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return current === href || current.startsWith(href);
}

type AccountShellCtx = {
  profile: AccountProfile;
  refresh: () => void;
  onSignedOut: () => void;
};

export function AccountShell({
  children,
}: {
  children: (ctx: AccountShellCtx) => ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useAccountProfile();
  const queryClient = useAccountQueryClient();
  const refresh = useRefreshAccount();
  const unauthenticated =
    profile.error instanceof AccountApiError && profile.error.status === 401;
  const logout = useAccountMutation(accountApi.logout, {
    // Update the navbar immediately; do not wait for the logout response.
    onMutate: () => {
      clearAccountSession(queryClient);
    },
    onError: () => {
      markAccountSessionActive(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["account"] });
    },
  });

  const onSignedOut = () => clearAccountSession(queryClient);

  useEffect(() => {
    if (profile.isPending || !unauthenticated) return;
    const next = pathname?.startsWith("/") ? pathname : "/users/profile/";
    router.replace(`/login/?next=${encodeURIComponent(next)}`);
  }, [pathname, profile.isPending, router, unauthenticated]);

  if (profile.isPending || unauthenticated) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <p
          className="rounded-2xl border border-border bg-white p-8 text-center font-bold text-ink-muted"
          role="status"
        >
          {unauthenticated ? "Redirecting to sign in…" : "Loading your account…"}
        </p>
      </div>
    );
  }

  if (profile.error || !profile.data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-alert-red/30 bg-white p-8 text-center">
          <h1 className="text-2xl font-black text-ink">Account unavailable</h1>
          <p className="mt-2 text-alert-red" role="alert">
            {profile.error?.message || "Your profile could not be loaded."}
          </p>
          <Button className="mt-5" onClick={() => profile.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-mist/30">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold tracking-[0.12em] text-forest uppercase">
              Registrant account
            </p>
            <h1 className="mt-1 text-3xl font-black text-ink">
              Welcome, {profile.data.name || profile.data.email}
            </h1>
            <p className="mt-2 text-ink-muted">
              Keep your sites, alerts, contacts, and preparedness records current.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={refresh}>
              <RefreshCw size={17} aria-hidden /> Refresh
            </Button>
            <Button
              variant="secondary"
              disabled={logout.isPending}
              onClick={() => logout.mutate(undefined)}
            >
              <LogOut size={17} aria-hidden />{" "}
              {logout.isPending ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[14rem_1fr]">
        <nav
          aria-label="Account tasks"
          className="lg:sticky lg:top-24 lg:self-start"
        >
          <p className="mb-2 text-xs font-extrabold tracking-wide text-ink-muted uppercase">
            Account tasks
          </p>
          <ul className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:gap-1.5 lg:overflow-visible">
            {accountNav.map((item) => {
              const active = navActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest/25",
                      active
                        ? "bg-forest text-white shadow-sm"
                        : "text-ink hover:bg-white hover:text-forest-dark",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="grid min-w-0 gap-6">
          {children({
            profile: profile.data,
            refresh,
            onSignedOut,
          })}
          {logout.error ? (
            <p className="text-sm font-semibold text-alert-red" role="alert">
              {logout.error.message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
