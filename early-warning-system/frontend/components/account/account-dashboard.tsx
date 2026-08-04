"use client";

import { LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useAccountMutation,
  useAccountProfile,
  useAccountQueryClient,
  useRefreshAccount,
} from "@/hooks/use-account";
import { accountApi, AccountApiError } from "@/lib/api/account";
import { AccountAuthPanel } from "./account-auth-panel";
import { ActionsPanel, DeleteAccountPanel } from "./account-actions-panel";
import { ContactsPanel } from "./account-contacts-panel";
import { NotificationsPanel } from "./account-notifications-panel";
import {
  FacilitiesPanel,
  PreferencesPanel,
  ProfilePanel,
} from "./account-profile-panels";

const navigation = [
  ["Profile", "#profile"],
  ["Facilities", "#facilities"],
  ["Preferences", "#preferences"],
  ["Notifications", "#notifications"],
  ["Trusted contacts", "#contacts"],
  ["Actions", "#actions"],
  ["Security", "#security"],
] as const;

export function AccountDashboard() {
  const profile = useAccountProfile();
  const queryClient = useAccountQueryClient();
  const refresh = useRefreshAccount();
  const unauthenticated =
    profile.error instanceof AccountApiError && profile.error.status === 401;
  const logout = useAccountMutation(accountApi.logout, {
    onSuccess: () => queryClient.removeQueries({ queryKey: ["account"] }),
  });

  const onAuthenticated = async () => {
    await queryClient.invalidateQueries({ queryKey: ["account"] });
    await profile.refetch();
  };
  const onSignedOut = () => queryClient.removeQueries({ queryKey: ["account"] });

  if (profile.isPending) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <p className="rounded-2xl border border-border bg-white p-8 text-center font-bold text-ink-muted" role="status">
          Loading your account…
        </p>
      </div>
    );
  }

  if (unauthenticated) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <AccountAuthPanel onAuthenticated={onAuthenticated} />
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
              <LogOut size={17} aria-hidden /> {logout.isPending ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Account tasks" className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-xs font-extrabold tracking-wide text-ink-muted uppercase">
            Account tasks
          </p>
          <ul className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:overflow-visible">
            {navigation.map(([label, href]) => (
              <li key={href}>
                <a
                  className="block whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold text-ink hover:bg-white hover:text-forest-dark focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest/25"
                  href={href}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid min-w-0 gap-6">
          <ProfilePanel profile={profile.data} />
          <FacilitiesPanel
            key={JSON.stringify([
              profile.data.facility_names,
              profile.data.facility_name,
              profile.data.facility_site_pm25_thresholds,
            ])}
            profile={profile.data}
            onUpdated={refresh}
          />
          <PreferencesPanel profile={profile.data} onUpdated={refresh} />
          <NotificationsPanel />
          <ContactsPanel />
          <ActionsPanel profile={profile.data} />
          <DeleteAccountPanel onDeleted={onSignedOut} />
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
