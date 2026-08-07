import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { BrandColors } from '@/constants/brand';
import {
  DashboardSection,
  DashboardSectionAccent,
} from '@/features/dashboard/DashboardSection';
import { buildFiveDayForecast } from '@/utils/forecastDays';
import { toApiError } from '@/services/api/client';
import type { WeekPredictResponse } from '@/types/forecast';

interface FiveDayForecastCardProps {
  cityLabel: string;
  pm25: number | null | undefined;
  data: WeekPredictResponse | undefined;
  isLoading: boolean;
  isError?: boolean;
  error?: unknown;
}

/** Recreates the AI "5-Day Forecast" panel from `frontend/index.html`. */
export function FiveDayForecastCard({
  cityLabel,
  pm25,
  data,
  isLoading,
  isError,
  error,
}: FiveDayForecastCardProps) {
  const days = useMemo(
    () => buildFiveDayForecast(data?.forecast, pm25),
    [data?.forecast, pm25],
  );

  const modelLabel = data?.forecast?.model ? ` · ${data.forecast.model}` : '';

  return (
    <DashboardSection accent={DashboardSectionAccent.forecast}>
      <View className="mb-1 flex-row flex-wrap items-center gap-2">
        <Text className="text-sm font-semibold text-ink dark:text-white">
          5-Day Forecast
        </Text>
        <View
          className="rounded px-2 py-0.5"
          style={{ backgroundColor: 'rgba(6, 182, 212, 0.15)' }}>
          <Text
            className="text-[10px] font-bold uppercase tracking-wide"
            style={{ color: BrandColors.ai }}>
            AI Powered
          </Text>
        </View>
      </View>

      <Text className="mb-3 text-xs text-muted">
        Predicted respiratory cases based on air quality forecast
      </Text>

      {isLoading && !data ? (
        <ActivityIndicator className="my-6 self-center" color={BrandColors.ai} />
      ) : isError && !data ? (
        <Text className="py-4 text-sm text-muted">
          Forecast unavailable
          {error ? `: ${toApiError(error).message}` : ''}
        </Text>
      ) : (
        <>
          <Text className="mb-2 text-[11px] text-neutral-400">
            {cityLabel}
            {modelLabel}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}>
            {days.map((day) => (
              <View
                key={day.day}
                className="min-w-[100px] items-center rounded-lg border px-3 py-3"
                style={{
                  borderColor: 'rgba(6, 182, 212, 0.35)',
                  backgroundColor: 'rgba(6, 182, 212, 0.06)',
                }}>
                <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Day {day.day}
                </Text>
                <Text className="font-mono text-2xl font-bold text-ink dark:text-white">
                  {day.pm25}
                </Text>
                <Text className="text-[10px] text-neutral-400">µg/m³</Text>
                <Text className="mt-2 text-xs font-semibold" style={{ color: BrandColors.ai }}>
                  {day.cases} cases
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </DashboardSection>
  );
}
