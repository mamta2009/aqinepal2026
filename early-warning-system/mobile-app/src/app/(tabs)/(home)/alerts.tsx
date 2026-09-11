import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StackScreenFrame } from "@/components/layout/screen";
import { EmptyState } from "@/components/ui";
import { AlertRow } from "@/features/dashboard/AlertRow";
import { CityPicker } from "@/features/dashboard/CityPicker";
import { useAirQuality } from "@/hooks/useAirQuality";
import { useLatestAlert } from "@/hooks/useLatestAlert";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useDashboardStore } from "@/store/dashboardStore";
import { buildRecentAlerts } from "@/utils/buildRecentAlerts";
import { isCityName, type CityName } from "@/constants/cities";
import { ScreenPadding } from "@/constants/theme";

const DEFAULT_PM25_THRESHOLD = 55;

export default function AlertsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ city?: string | string[] }>();
  const rawCityParam = Array.isArray(params.city) ? params.city[0] : params.city;

  const selectedCity = useDashboardStore((state) => state.selectedCity);
  const setSelectedCity = useDashboardStore((state) => state.setSelectedCity);

  /** Prefer explicit route city; fall back to dashboard store. */
  const city: CityName = isCityName(rawCityParam) ? rawCityParam : selectedCity;

  useEffect(() => {
    if (isCityName(rawCityParam) && rawCityParam !== selectedCity) {
      setSelectedCity(rawCityParam);
    }
  }, [rawCityParam, selectedCity, setSelectedCity]);

  const runtimeConfig = useRuntimeConfig();
  const airQuality = useAirQuality(city);
  const latestAlert = useLatestAlert(city);

  const threshold =
    runtimeConfig.data?.dashboard.pm25_alert_threshold_ugm3 ??
    DEFAULT_PM25_THRESHOLD;
  const pm25 = airQuality.data?.air_quality?.pm25_ug_m3 ?? null;
  const aqi =
    typeof airQuality.data?.air_quality?.aqi === "number" &&
      Number.isFinite(airQuality.data.air_quality.aqi)
      ? airQuality.data.air_quality.aqi
      : null;

  const alerts = useMemo(
    () =>
      buildRecentAlerts({
        cityLabel: city,
        pm25,
        aqi,
        thresholdUgM3: threshold,
        latestAlert: latestAlert.data,
      }),
    [city, pm25, aqi, threshold, latestAlert.data],
  );

  const onSelectCity = useCallback(
    (next: CityName) => {
      setSelectedCity(next);
      router.setParams({ city: next });
    },
    [router, setSelectedCity],
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        airQuality.refetch(),
        latestAlert.refetch(),
        runtimeConfig.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [airQuality, latestAlert, runtimeConfig]);

  return (
    <StackScreenFrame>
      <Stack.Screen
        options={{
          title: `Alerts · ${city}`,
          headerBackTitle: "Back",
        }}
      />
      <FlatList
        data={alerts}
        keyExtractor={(item) => `${city}-${item.id}`}
        extraData={city}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{
          paddingBottom: ScreenPadding.stackBottom,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <View className="pt-1">
            <CityPicker selectedCity={city} onSelectCity={onSelectCity} />
            <Text className="mb-3 px-4 text-sm leading-5 text-muted">
              Showing alerts for {city} — live PM2.5 tier, facility notes, and
              the latest broadcast for this city.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="mx-4 rounded-xl border border-border bg-white px-3">
            <AlertRow
              level={item.level}
              time={item.time}
              message={item.message}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={
          <View className="mx-4 mt-4">
            <EmptyState
              title="No alerts yet"
              message={`No alerts are recorded for ${city} right now.`}
            />
          </View>
        }
      />
    </StackScreenFrame>
  );
}
