import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, Stack } from 'expo-router';

import { NotificationInboxRow } from '@/features/account/NotificationInboxList';
import {
  useAuthHydrated,
  useInfiniteNotificationInbox,
  useIsAuthenticated,
} from '@/hooks/useAuth';
import { Spacing } from '@/constants/theme';

import type { NotificationInboxEntry } from '@/types/auth';

export default function InboxScreen() {
  const hydrated = useAuthHydrated();
  const isAuthenticated = useIsAuthenticated();
  const inbox = useInfiniteNotificationInbox(isAuthenticated);

  const entries = useMemo(
    () =>
      (inbox.data?.pages ?? []).flatMap((page) => page.entries ?? []) as NotificationInboxEntry[],
    [inbox.data?.pages],
  );

  const onRefresh = useCallback(async () => {
    await inbox.refetch();
  }, [inbox]);

  const onEndReached = useCallback(() => {
    if (inbox.hasNextPage && !inbox.isFetchingNextPage) {
      void inbox.fetchNextPage();
    }
  }, [inbox]);

  if (hydrated && !isAuthenticated) {
    return <Redirect href="/(tabs)/account" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-surface-dark" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Notifications', headerBackTitle: 'Account' }} />
      <FlatList
        data={entries}
        keyExtractor={(item, index) => `${item.timestamp ?? 't'}-${index}`}
        contentContainerStyle={{ padding: 16, paddingBottom: Spacing.five, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={inbox.isRefetching} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View className="mb-3">
            <Text className="text-sm leading-5 text-neutral-500 dark:text-neutral-400">
              SMS, WhatsApp, and email attempts logged by the server (including alert broadcasts). Full
              text when available. Scroll to load 5 more at a time.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => <NotificationInboxRow entry={item} index={index} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          inbox.isLoading ? (
            <ActivityIndicator className="mt-8" />
          ) : (
            <Text className="mt-8 text-center text-sm text-neutral-500">
              No deliveries logged yet.
            </Text>
          )
        }
        ListFooterComponent={
          inbox.isFetchingNextPage ? (
            <ActivityIndicator className="my-4" />
          ) : !inbox.hasNextPage && entries.length > 0 ? (
            <Text className="my-4 text-center text-xs text-neutral-400">End of list</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
