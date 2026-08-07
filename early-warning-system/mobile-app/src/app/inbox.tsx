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
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Notification inbox', headerBackTitle: 'Account' }} />
      <FlatList
        data={entries}
        keyExtractor={(item, index) => `${item.timestamp ?? 't'}-${index}`}
        contentContainerStyle={{ padding: 16, paddingBottom: Spacing.five, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={inbox.isRefetching} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View className="mb-3">
            <Text className="text-[10px] font-extrabold uppercase tracking-widest text-forest">
              Delivery history
            </Text>
            <Text className="mt-1 text-sm leading-5 text-muted">
              SMS, WhatsApp, and email attempts logged by the server. Full text when
              available. Scroll to load more.
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
            <Text className="mt-8 text-center text-sm text-muted">
              No notification deliveries are recorded yet.
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
