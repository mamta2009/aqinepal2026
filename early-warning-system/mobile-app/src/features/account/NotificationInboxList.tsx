import { ActivityIndicator, Text, View } from 'react-native';

import { formatRelativeTimestamp } from '@/utils/format';

import type { NotificationInboxEntry } from '@/types/auth';

interface NotificationInboxListProps {
  entries: NotificationInboxEntry[] | undefined;
  isLoading: boolean;
}

export function NotificationInboxList({ entries, isLoading }: NotificationInboxListProps) {
  return (
    <View className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-white">
        Notifications sent to you
      </Text>

      {isLoading ? (
        <ActivityIndicator className="my-4 self-start" />
      ) : !entries || entries.length === 0 ? (
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          No deliveries logged yet.
        </Text>
      ) : (
        entries.map((entry, index) => (
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
        ))
      )}
    </View>
  );
}
