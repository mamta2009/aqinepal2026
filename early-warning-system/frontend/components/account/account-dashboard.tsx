"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AccountShell } from "./account-shell";
import { ActionsPanel, DeleteAccountPanel } from "./account-actions-panel";
import { ContactsPanel } from "./account-contacts-panel";
import { NotificationsPanel } from "./account-notifications-panel";
import {
  FacilitiesPanel,
  PreferencesPanel,
  ProfilePanel,
} from "./account-profile-panels";

/** Legacy entry: send authenticated users to Profile. */
export function AccountDashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/users/profile/");
  }, [router]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <p
        className="rounded-2xl border border-border bg-white p-8 text-center font-bold text-ink-muted"
        role="status"
      >
        Opening your account…
      </p>
    </div>
  );
}

export function AccountProfilePage() {
  return (
    <AccountShell>
      {({ profile }) => <ProfilePanel profile={profile} />}
    </AccountShell>
  );
}

export function AccountFacilitiesPage() {
  return (
    <AccountShell>
      {({ profile, refresh }) => (
        <>
          <FacilitiesPanel
            key={JSON.stringify([
              profile.facility_names,
              profile.facility_name,
              profile.facility_site_pm25_thresholds,
            ])}
            profile={profile}
            onUpdated={refresh}
          />
          <ActionsPanel profile={profile} />
        </>
      )}
    </AccountShell>
  );
}

export function AccountPreferencesPage() {
  return (
    <AccountShell>
      {({ profile, refresh }) => (
        <PreferencesPanel profile={profile} onUpdated={refresh} />
      )}
    </AccountShell>
  );
}

export function AccountNotificationsPage() {
  return (
    <AccountShell>{() => <NotificationsPanel />}</AccountShell>
  );
}

export function AccountContactsPage() {
  return <AccountShell>{() => <ContactsPanel />}</AccountShell>;
}

export function AccountSecurityPage() {
  return (
    <AccountShell>
      {({ onSignedOut }) => (
        <DeleteAccountPanel onDeleted={onSignedOut} defaultOpen />
      )}
    </AccountShell>
  );
}
