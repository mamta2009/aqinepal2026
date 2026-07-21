import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AirQualityChart,
  CasesWeekCard,
  CityInfoPanel,
  CityPicker,
  DashboardActionsSidebar,
  DashboardMenuButton,
  RecentAlertsCard,
  StatusCards,
} from '@/features/dashboard';
import { useAirQuality } from '@/hooks/useAirQuality';
import { useCasesWeek } from '@/hooks/useCasesWeek';
import { useCities } from '@/hooks/useCities';
import { useHeatCurrent } from '@/hooks/useHeatCurrent';
import { useLatestAlert } from '@/hooks/useLatestAlert';
import { useRuntimeConfig } from '@/hooks/useRuntimeConfig';
import { toApiError } from '@/services/api/client';
import { useDashboardStore } from '@/store/dashboardStore';
import { alertLevelFromPm25 } from '@/utils/alertLevel';
import { BottomTabInset, Spacing } from '@/constants/theme';

const DEFAULT_PM25_THRESHOLD = 55;

export default function DashboardScreen() {
  const selectedCity = useDashboardStore((state) => state.selectedCity);
  const setSelectedCity = useDashboardStore((state) => state.setSelectedCity);

  const runtimeConfig = useRuntimeConfig();
  const cities = useCities();
  const airQuality = useAirQuality(selectedCity);
  const heat = useHeatCurrent(selectedCity);
  const casesWeek = useCasesWeek(selectedCity);
  const latestAlert = useLatestAlert(selectedCity);

  const selectedCityInfo = cities.data?.cities.find((c) => c.name === selectedCity);

  const threshold =
    runtimeConfig.data?.dashboard.pm25_alert_threshold_ugm3 ?? DEFAULT_PM25_THRESHOLD;

  const aqPayload = airQuality.data?.air_quality;
  const pm25 = aqPayload?.pm25_ug_m3 ?? null;
  const isWaqiIndex = airQuality.data?.source === 'waqi' && typeof aqPayload?.aqi === 'number';
  const aqiValue = isWaqiIndex
    ? aqPayload?.aqi ?? null
    : typeof pm25 === 'number'
      ? Math.min(100, Math.round((pm25 / 150) * 100))
      : null;
  const aqiLabel = isWaqiIndex ? 'AQI' : 'PM2.5 score';

  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        airQuality.refetch(),
        heat.refetch(),
        casesWeek.refetch(),
        latestAlert.refetch(),
        runtimeConfig.refetch(),
        cities.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [airQuality, heat, casesWeek, latestAlert, runtimeConfig, cities]);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-surface-dark" edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}>
        <View className="flex-row items-start justify-between px-4 pb-4 pt-2">
          <View className="mr-3 flex-1">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
              Early Warning
            </Text>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">
              Air quality &amp; respiratory risk — {selectedCity}
            </Text>
          </View>
          <DashboardMenuButton onPress={() => setSidebarOpen(true)} />
        </View>

        <CityPicker selectedCity={selectedCity} onSelectCity={setSelectedCity} />

        <CityInfoPanel city={selectedCityInfo} isLoading={cities.isLoading} />

        <StatusCards
          pm25={pm25}
          aqiValue={aqiValue}
          aqiLabel={aqiLabel}
          alertLevel={alertLevelFromPm25(pm25, threshold)}
          heatTempC={heat.data?.heat_temperature_display}
          heatLevel={heat.data?.heat_level}
          isLoadingAir={airQuality.isLoading}
          isLoadingHeat={heat.isLoading}
        />

        <View className="mt-4 gap-4 px-4">
          <AirQualityChart
            pm25={pm25}
            cityLabel={selectedCity}
            sourceLabel={airQuality.data?.source ?? 'API'}
          />

          <CasesWeekCard data={casesWeek.data} isLoading={casesWeek.isLoading} />

          <RecentAlertsCard
            cityLabel={selectedCity}
            pm25={pm25}
            thresholdUgM3={threshold}
            latestAlert={latestAlert.data}
            isLoadingLatestAlert={latestAlert.isLoading}
          />

          {airQuality.isError ? (
            <Text className="text-sm text-primary">
              Could not load air quality for {selectedCity}:{' '}
              {toApiError(airQuality.error).message}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <DashboardActionsSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onRefresh={onRefresh}
        refreshing={refreshing}
        selectedCity={selectedCity}
      />
    </SafeAreaView>
  );
}
