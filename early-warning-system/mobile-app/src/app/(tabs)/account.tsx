import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { RefreshControl, Text, View } from "react-native";
import {
  AccountNavRow,
  ChannelPreferencesForm,
  DeleteAccountPanel,
  NotificationInboxList,
  ProfileCard,
} from "@/features/account";
import { LoginForm } from "@/features/auth/LoginForm";
import { PrimaryButton } from "@/features/auth/FormFields";
import { TabScreen } from "@/components/layout/screen";
import { TabChrome } from "@/features/navigation/TabChrome";
import {
  useAuthHydrated,
  useIsAuthenticated,
  useNotificationInbox,
  useProfile,
} from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";

export default function AccountScreen() {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const isAuthenticated = useIsAuthenticated();
  const clearSession = useAuthStore((s) => s.clearSession);
  const facilityReportingReady = useAuthStore((s) => s.facilityReportingReady);

  const profileQuery = useProfile(isAuthenticated);
  const inboxQuery = useNotificationInbox(isAuthenticated, 2);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setRefreshing(true);
    try {
      await Promise.all([profileQuery.refetch(), inboxQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [isAuthenticated, profileQuery, inboxQuery]);

  if (!hydrated) {
    return (
      <TabScreen scroll={false}>
        <TabChrome title="Account" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted">Loading your account…</Text>
        </View>
      </TabScreen>
    );
  }

  const welcomeName =
    profileQuery.data?.name?.trim() ||
    profileQuery.data?.email?.trim() ||
    "there";

  return (
    <TabScreen
      refreshControl={
        isAuthenticated ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        ) : undefined
      }>
      <TabChrome title="Account" subtitle="Registrant access" />
      {!isAuthenticated ? (
        <View className="gap-4">
          <View className="pb-1">
            <Text className="text-xs font-extrabold uppercase tracking-widest text-forest">
              Registrant access
            </Text>
            <Text className="mt-1 text-2xl font-extrabold text-ink">
              Sign in to your clean-air account
            </Text>
            <Text className="mt-2 text-sm leading-5 text-muted">
              Manage facilities, alert preferences, preparedness actions, and
              trusted contacts. Your session is stored securely on this
              device.
            </Text>
          </View>
          <LoginForm />
          <View className="gap-3">
            <PrimaryButton
              label="Register for alerts"
              variant="action"
              onPress={() => router.push("/register")}
            />
            <PrimaryButton
              label="Verify code"
              variant="secondary"
              onPress={() => router.push("/verify")}
            />
          </View>
          <Text className="text-xs text-muted">
            After registering, verify the code sent to your channels, then
            sign in here.
          </Text>
        </View>
      ) : (
        <View className="gap-4">
          <View className="pb-1">
            <Text className="text-xs font-extrabold uppercase tracking-widest text-forest">
              Registrant account
            </Text>
            <Text className="mt-1 text-2xl font-extrabold text-ink">
              Welcome, {welcomeName}
            </Text>
            <Text className="mt-2 text-sm leading-5 text-muted">
              Keep your sites, alerts, contacts, and preparedness records
              current.
            </Text>
          </View>

          <Text className="text-[10px] font-extrabold uppercase tracking-widest text-forest">
            Account tasks
          </Text>

          <ProfileCard
            profile={profileQuery.data}
            facilityReportingReady={facilityReportingReady}
          />

          <AccountNavRow
            title="Facilities"
            subtitle="Sites you cover, PM2.5 thresholds, and preparedness actions"
            tone="facility"
            onPress={() => router.push("/facility-actions")}
          />

          <ChannelPreferencesForm profile={profileQuery.data} />

          <NotificationInboxList
            entries={inboxQuery.data?.entries}
            isLoading={inboxQuery.isLoading}
            previewLimit={2}
            totalCount={inboxQuery.data?.total ?? inboxQuery.data?.count}
            showSeeMore
          />

          <AccountNavRow
            title="Trusted contacts"
            subtitle="People you trust for shared SMS, WhatsApp, or email alerts"
            tone="friends"
            onPress={() => router.push("/friends")}
          />

          <PrimaryButton
            label="Sign out"
            variant="ghost"
            onPress={() => {
              void clearSession();
            }}
          />

          <DeleteAccountPanel />
        </View>
      )}
    </TabScreen>
  );
}
