import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AlertRow } from '@/features/dashboard/AlertRow';
import {
  DashboardSection,
  DashboardSectionAccent,
} from '@/features/dashboard/DashboardSection';
import { buildRecentAlerts } from '@/utils/buildRecentAlerts';
import type { LatestAlertResponse } from '@/types/alerts';

const PREVIEW_LIMIT = 2;

interface RecentAlertsCardProps {
  cityLabel: string;
  pm25: number | null | undefined;
  aqi?: number | null | undefined;
  thresholdUgM3: number;
  latestAlert: LatestAlertResponse | undefined;
  isLoadingLatestAlert: boolean;
}

/**
 * Dashboard preview of Recent Alerts (first few rows) with See all → `/alerts`.
 */
export function RecentAlertsCard({
  cityLabel,
  pm25,
  aqi,
  thresholdUgM3,
  latestAlert,
  isLoadingLatestAlert,
}: RecentAlertsCardProps) {
  const router = useRouter();

  const allAlerts = useMemo(
    () =>
      buildRecentAlerts({
        cityLabel,
        pm25,
        aqi,
        thresholdUgM3,
        latestAlert,
      }),
    [cityLabel, pm25, aqi, thresholdUgM3, latestAlert],
  );

  const preview = allAlerts.slice(0, PREVIEW_LIMIT);
  const hasMore = allAlerts.length > PREVIEW_LIMIT;

  return (
    <DashboardSection accent={DashboardSectionAccent.alerts}>
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-ink dark:text-white">
          Recent alerts · {cityLabel}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See all alerts for ${cityLabel}`}
          onPress={() =>
            router.push({ pathname: '/alerts', params: { city: cityLabel } })
          }
          className="active:opacity-70">
          <Text className="text-xs font-semibold text-secondary">See all</Text>
        </Pressable>
      </View>

      {isLoadingLatestAlert && !latestAlert ? (
        <ActivityIndicator className="my-3 self-start" />
      ) : (
        preview.map((alert) => (
          <AlertRow
            key={alert.id}
            level={alert.level}
            time={alert.time}
            message={alert.message}
          />
        ))
      )}

      {hasMore ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/alerts', params: { city: cityLabel } })
          }
          className="mt-2 items-center rounded-xl border py-2.5 active:opacity-70"
          style={{ borderColor: 'rgba(245, 158, 11, 0.45)' }}>
          <Text className="text-sm font-semibold text-secondary">
            See all for {cityLabel} ({allAlerts.length})
          </Text>
        </Pressable>
      ) : null}
    </DashboardSection>
  );
}
