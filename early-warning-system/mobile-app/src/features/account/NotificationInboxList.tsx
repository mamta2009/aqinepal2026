import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AccountSectionAccent, FeatureSection } from '@/components/FeatureSection';
import { formatRelativeTimestamp } from '@/utils/format';
import type { NotificationInboxEntry } from '@/types/auth';

interface NotificationInboxListProps {
  entries: NotificationInboxEntry[] | undefined;
  isLoading?: boolean;
  /** When set, only show this many rows (preview mode). */
  previewLimit?: number;
  /** Total matching rows from the API (used for See more). */
  totalCount?: number;
  showSeeMore?: boolean;
  emptyMessage?: string;
  title?: string;
  helper?: string;
  /** Flat list of rows without outer card chrome (for FlatList screens). */
  bare?: boolean;
}

export function NotificationInboxRow({ entry, index }: { entry: NotificationInboxEntry; index: number }) {
  return (
    <View
      key={`${entry.timestamp ?? 't'}-${index}`}
      className="border-b border-neutral-100 py-3 dark:border-neutral-800">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold uppercase text-secondary">
          {entry.channel || 'channel'} · {entry.status || 'unknown'}
        </Text>
        <Text className="text-[11px] text-neutral-400">
          {formatRelativeTimestamp(entry.timestamp)}
        </Text>
      </View>
      {entry.city || entry.alert_level || entry.hazard_type ? (
        <Text className="mt-1 text-xs text-neutral-500">
          {[entry.city, entry.hazard_type, entry.alert_level].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      <Text className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
        {entry.message_preview || entry.message || entry.error || '—'}
      </Text>
    </View>
  );
}

export function NotificationInboxList({
  entries,
  isLoading,
  previewLimit,
  totalCount,
  showSeeMore,
  emptyMessage = 'No deliveries logged yet.',
  title = 'Notifications sent to you',
  helper = 'SMS, WhatsApp, and email attempts logged by the server (including alert broadcasts).',
  bare = false,
}: NotificationInboxListProps) {
  const router = useRouter();
  const visible =
    previewLimit != null && entries ? entries.slice(0, previewLimit) : entries;
  const hasMore =
    Boolean(showSeeMore) &&
    (totalCount != null
      ? totalCount > (previewLimit ?? 0)
      : (entries?.length ?? 0) >= (previewLimit ?? 0) && (previewLimit ?? 0) > 0);

  const body = (
    <>
      {title ? (
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</Text>
          {showSeeMore && hasMore ? (
            <Pressable onPress={() => router.push('/inbox')} hitSlop={8}>
              <Text className="text-sm font-semibold text-secondary">See more</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {helper ? (
        <Text className="mb-2 text-xs leading-4 text-neutral-500 dark:text-neutral-400">
          {helper}
        </Text>
      ) : null}

      {isLoading ? (
        <ActivityIndicator className="my-4 self-start" />
      ) : !visible || visible.length === 0 ? (
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">{emptyMessage}</Text>
      ) : (
        visible.map((entry, index) => (
          <NotificationInboxRow key={`${entry.timestamp ?? 't'}-${index}`} entry={entry} index={index} />
        ))
      )}

      {showSeeMore && hasMore ? (
        <Pressable
          onPress={() => router.push('/inbox')}
          className="mt-2 items-center rounded-xl border px-3 py-2"
          style={{ borderColor: 'rgba(245, 158, 11, 0.45)' }}>
          <Text className="text-sm font-semibold text-secondary">See more notifications</Text>
        </Pressable>
      ) : null}
    </>
  );

  if (bare) return <View>{body}</View>;

  return <FeatureSection accent={AccountSectionAccent.inbox}>{body}</FeatureSection>;
}
