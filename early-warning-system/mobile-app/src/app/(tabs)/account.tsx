import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChannelPreferencesForm } from '@/features/account/ChannelPreferencesForm';
import { NotificationInboxList } from '@/features/account/NotificationInboxList';
import { ProfileCard } from '@/features/account/ProfileCard';
import { LoginForm } from '@/features/auth/LoginForm';
import { PrimaryButton } from '@/features/auth/FormFields';
import {
  useAuthHydrated,
  useIsAuthenticated,
  useNotificationInbox,
  useProfile,
} from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { BottomTabInset, Spacing } from '@/constants/theme';

export default function AccountScreen() {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const isAuthenticated = useIsAuthenticated();
  const clearSession = useAuthStore((s) => s.clearSession);
  const facilityReportingReady = useAuthStore((s) => s.facilityReportingReady);

  const profileQuery = useProfile(isAuthenticated);
  const inboxQuery = useNotificationInbox(isAuthenticated);

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
        contentContainerStyle={{
          paddingBottom: BottomTabInset + Spacing.four,
          paddingHorizontal: 16,
        }}>
        <View className="pb-4 pt-2">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Account</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">
            {isAuthenticated
              ? 'Profile, alert channels, and delivery history'
              : 'Sign in or register to manage alerts'}
          </Text>
        </View>

        {!isAuthenticated ? (
          <View className="gap-4">
            <View className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <Text className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
                Sign in
              </Text>
              <LoginForm />
            </View>

            <View className="gap-3">
              <PrimaryButton
                label="Register"
                variant="secondary"
                onPress={() => router.push('/register')}
              />
              <PrimaryButton
                label="Verify code"
                variant="ghost"
                onPress={() => router.push('/verify')}
              />
            </View>
            <Text className="text-xs text-neutral-500">
              After registering, verify the code sent to your channels, then sign in here.
            </Text>
          </View>
        ) : (
          <View className="gap-4">
            <ProfileCard
              profile={profileQuery.data}
              facilityReportingReady={facilityReportingReady}
            />
            <ChannelPreferencesForm profile={profileQuery.data} />
            <NotificationInboxList
              entries={inboxQuery.data?.entries}
              isLoading={inboxQuery.isLoading}
            />
            <PrimaryButton
              label="Sign out"
              variant="secondary"
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
