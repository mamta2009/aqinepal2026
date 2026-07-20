import { ActivityIndicator, Text, View } from 'react-native';

import { AlertLevelColors } from '@/constants/brand';
import { alertLevelFromPm25 } from '@/utils/alertLevel';
import { formatRelativeTimestamp } from '@/utils/format';

import type { LatestAlertResponse } from '@/types/alerts';

interface AlertRowProps {
  level: string;
  time: string;
  message: string;
}

function AlertRow({ level, time, message }: AlertRowProps) {
  const color = AlertLevelColors[level as keyof typeof AlertLevelColors] ?? '#6b7280';
  return (
    <View className="flex-row gap-3 py-3">
      <View className="w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text
            className="text-[11px] font-bold uppercase tracking-wide"
            style={{ color }}>
            {level}
          </Text>
          <Text className="text-[11px] text-neutral-400 dark:text-neutral-500">{time}</Text>
        </View>
        <Text className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{message}</Text>
      </View>
    </View>
  );
}

interface RecentAlertsCardProps {
  cityLabel: string;
  pm25: number | null | undefined;
  thresholdUgM3: number;
  latestAlert: LatestAlertResponse | undefined;
  isLoadingLatestAlert: boolean;
}

/**
 * Recreates the "Recent alerts" panel from `frontend/index.html`: a
 * client-derived tier from live PM2.5 (`displayAlerts()` parity), plus the
 * real last broadcast summary from `GET /api/alerts/latest`.
 */
export function RecentAlertsCard({
  cityLabel,
  pm25,
  thresholdUgM3,
  latestAlert,
  isLoadingLatestAlert,
}: RecentAlertsCardProps) {
  const level = alertLevelFromPm25(pm25, thresholdUgM3);

  const syntheticMessage =
    level === 'NO DATA'
      ? `${cityLabel}: no PM2.5 from API yet.`
      : level === 'HIGH'
        ? `${cityLabel}: PM2.5 ${Math.round(pm25 as number)} µg/m³ (threshold ${thresholdUgM3}). Elevated respiratory load possible.`
        : level === 'MODERATE'
          ? `${cityLabel}: PM2.5 ${Math.round(pm25 as number)} µg/m³ exceeds alert threshold (${thresholdUgM3}). Monitor.`
          : `${cityLabel}: PM2.5 ${Math.round(pm25 as number)} µg/m³ below threshold (${thresholdUgM3}).`;

  return (
    <View className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <Text className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">
        Recent alerts
      </Text>

      <AlertRow level={level} time="Just now" message={syntheticMessage} />

      {isLoadingLatestAlert ? (
        <ActivityIndicator className="my-3 self-start" />
      ) : latestAlert?.ok && latestAlert.source === 'alert_broadcasts' ? (
        <AlertRow
          level={latestAlert.severity_level ?? latestAlert.level ?? 'INFO'}
          time={formatRelativeTimestamp(latestAlert.timestamp)}
          message={`Last broadcast to ${latestAlert.city ?? cityLabel}: ${latestAlert.hazard_type ?? 'air'} alert, ${latestAlert.total_recipients ?? 0} recipients.`}
        />
      ) : (
        <AlertRow
          level="INFO"
          time="System"
          message={latestAlert?.message ?? 'No broadcast history yet.'}
        />
      )}
    </View>
  );
}
