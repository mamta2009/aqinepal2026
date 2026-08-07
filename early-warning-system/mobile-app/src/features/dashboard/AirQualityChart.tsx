import { useMemo } from 'react';
import { Text, View, useColorScheme } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { BrandColors } from '@/constants/brand';
import {
  DashboardSection,
  DashboardSectionAccent,
} from '@/features/dashboard/DashboardSection';
import { generate24hFromReading } from '@/utils/chartSeries';

interface AirQualityChartProps {
  pm25: number | null | undefined;
  cityLabel: string;
  sourceLabel: string;
}

/** Recreates the "Air Quality 24H" Chart.js line chart from `frontend/index.html`. */
export function AirQualityChart({ pm25, cityLabel, sourceLabel }: AirQualityChartProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const points = useMemo(() => {
    const series = generate24hFromReading(pm25, cityLabel);
    return series.map((value, hour) => ({
      value,
      label: hour % 4 === 0 ? `${hour}h` : '',
    }));
  }, [pm25, cityLabel]);

  return (
    <DashboardSection accent={DashboardSectionAccent.airQuality}>
      <Text className="mb-3 text-sm font-semibold text-ink dark:text-white">
        Air quality — 24h
      </Text>

      {points.length > 0 ? (
        <LineChart
          data={points}
          height={180}
          color={BrandColors.primary}
          thickness={2}
          curved
          areaChart
          startFillColor={BrandColors.primary}
          endFillColor={BrandColors.primary}
          startOpacity={0.25}
          endOpacity={0.02}
          hideDataPoints
          hideRules
          yAxisTextStyle={{ color: isDark ? '#a3a3a3' : '#737373', fontSize: 10 }}
          xAxisLabelTextStyle={{ color: isDark ? '#a3a3a3' : '#737373', fontSize: 10 }}
          yAxisColor={isDark ? '#404040' : '#d4d4d4'}
          xAxisColor={isDark ? '#404040' : '#d4d4d4'}
          initialSpacing={8}
          spacing={12}
          noOfSections={4}
        />
      ) : (
        <View className="h-[180px] items-center justify-center">
          <Text className="text-sm text-muted">
            No PM2.5 reading yet for {cityLabel}.
          </Text>
        </View>
      )}

      <Text className="mt-3 text-xs text-muted">
        Deterministic intra-day variation around the latest {sourceLabel} reading — not observed
        hourly AQ.
      </Text>
    </DashboardSection>
  );
}
