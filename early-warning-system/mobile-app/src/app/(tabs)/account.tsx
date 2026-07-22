import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AccountNavRow,
  ChannelPreferencesForm,
  NotificationInboxList,
  ProfileCard,
} from '@/features/account';
import { LoginForm } from '@/features/auth/LoginForm';
import { PrimaryButton } from '@/features/auth/FormFields';
import {
  useAuthHydrated,
  useIsAuthenticated,
  useNotificationInbox,
  useProfile,
} from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { AccountSectionAccent, FeatureSection } from '@/components/FeatureSection';
import { BottomTabInset, Spacing } from '@/constants/theme';

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50 dark:bg-surface-dark">
        <Text className="text-neutral-500">Loading session…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-surface-dark" edges={['top']}>
      <ScrollView
        refreshControl={
          isAuthenticated ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          // Extra room so Sign out (and guest CTAs) clear the native tab bar.
          paddingBottom: BottomTabInset + Spacing.six + insets.bottom,
          paddingHorizontal: 16,
        }}>
        <View className="pb-3 pt-2">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Account</Text>
          <Text className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {isAuthenticated
              ? 'Sign in, enrolment profile, and workplace tools'
              : 'Sign in or register to manage alerts'}
          </Text>
        </View>

        {!isAuthenticated ? (
          <View className="gap-4">
            <FeatureSection accent={AccountSectionAccent.signIn}>
              <Text className="mb-2 text-sm leading-5 text-neutral-600 dark:text-neutral-300">
                Use the same email and password (or OTP) as in the main app. Preparedness buttons write
                to the facility audit when your account is approved and linked to a site.
              </Text>
              <Text className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
                Sign in
              </Text>
              <LoginForm />
            </FeatureSection>

            <View className="gap-3">
              <PrimaryButton
                label="Register"
                variant="action"
                onPress={() => router.push('/register')}
              />
              <PrimaryButton
                label="Verify code"
                variant="secondary"
                onPress={() => router.push('/verify')}
              />
            </View>
            <Text className="text-xs text-neutral-500">
              After registering, verify the code sent to your channels, then sign in here.
            </Text>
          </View>
        ) : (
          <View className="gap-4">
            <FeatureSection accent={AccountSectionAccent.tip}>
              <Text className="text-sm leading-5 text-neutral-700 dark:text-neutral-200">
                Use the same email and password (or OTP) as in the main app. Preparedness buttons write
                to the facility audit when your account is approved and linked to a site.
              </Text>
            </FeatureSection>

            <ProfileCard
              profile={profileQuery.data}
              facilityReportingReady={facilityReportingReady}
            />

            <ChannelPreferencesForm profile={profileQuery.data} />

            <NotificationInboxList
              entries={inboxQuery.data?.entries}
              isLoading={inboxQuery.isLoading}
              previewLimit={2}
              totalCount={inboxQuery.data?.total ?? inboxQuery.data?.count}
              showSeeMore
            />

            <View className="gap-3">
              <AccountNavRow
                title="Facility Actions"
                subtitle="Add sites, PM2.5 thresholds, preparedness buttons, and action history"
                tone="facility"
                onPress={() => router.push('/facility-actions')}
              />

              <AccountNavRow
                title="Friends & family alerts"
                subtitle="Save emergency contacts and send SMS, WhatsApp, or email"
                tone="friends"
                onPress={() => router.push('/friends')}
              />
            </View>
            <PrimaryButton
              label="Sign out"
              variant="danger"
              onPress={() => {
                void clearSession();
              }}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
