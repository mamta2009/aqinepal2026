import { useMemo } from 'react';
import { Text, View, useColorScheme } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { BrandColors } from '@/constants/brand';
import { InfoSheet, InfoSheetParagraph } from '@/components/ui';
import {
  DashboardSection,
  DashboardSectionAccent,
} from '@/features/dashboard/DashboardSection';
import {
  generate24hFromReading,
  resolveAirChartBaseline,
} from '@/utils/chartSeries';

interface AirQualityChartProps {
  pm25: number | null | undefined;
  aqi?: number | null | undefined;
  cityLabel: string;
  sourceLabel: string;
}

/** Recreates the "Air Quality 24H" Chart.js line chart from the web dashboard. */
export function AirQualityChart({
  pm25,
  aqi,
  cityLabel,
  sourceLabel,
}: AirQualityChartProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const baseline = useMemo(
    () => resolveAirChartBaseline({ pm25, aqi }),
    [aqi, pm25],
  );

  const points = useMemo(() => {
    const series = generate24hFromReading(baseline?.value, cityLabel);
    return series.map((value, hour) => ({
      value,
      label: hour % 4 === 0 ? `${hour}h` : '',
    }));
  }, [baseline?.value, cityLabel]);

  const readingWord =
    baseline?.metric === 'aqi' ? 'station air score (AQI)' : 'live PM2.5';

  return (
    <DashboardSection accent={DashboardSectionAccent.airQuality}>
      <View className="mb-3 flex-row flex-wrap items-center gap-2">
        <Text className="text-sm font-semibold text-ink dark:text-white">
          Air quality — 24h
        </Text>
        <InfoSheet label="Air quality 24h chart">
          <InfoSheetParagraph>
            Starts from today{"'"}s live reading for {cityLabel} (PM2.5 when
            available, otherwise station AQI), then draws a day-long wavy line so
            you can picture how levels might vary hour to hour.
          </InfoSheetParagraph>
          <InfoSheetParagraph>
            The shape is an illustration — not a real hour-by-hour history.
          </InfoSheetParagraph>
        </InfoSheet>
      </View>

      {points.length > 0 && baseline ? (
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
        <View className="h-[180px] items-center justify-center px-2">
          <Text className="text-center text-sm text-muted">
            No live air reading yet for {cityLabel}.
          </Text>
        </View>
      )}

      <Text className="mt-3 text-xs text-muted">
        {points.length > 0
          ? `Illustrative intra-day shape around the current ${readingWord} for ${cityLabel} (${sourceLabel}).`
          : `Source: ${sourceLabel}.`}
      </Text>
    </DashboardSection>
  );
}
