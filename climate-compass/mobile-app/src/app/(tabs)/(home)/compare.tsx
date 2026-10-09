import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  useColorScheme,
} from 'react-native';
import { Stack } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';
import { BrandColors } from '@/constants/brand';
import { CITY_NAMES, DEFAULT_CITY, type CityName } from '@/constants/cities';
import { StackScreen } from '@/components/layout/screen';
import { InfoSheet, InfoSheetParagraph } from '@/components/ui';
import { useRuntimeConfig } from '@/hooks/useRuntimeConfig';
import {
  compareBarColor,
  compareBarColorFromAqi,
  compareRowChartValue,
  compareSourceLabel,
  fetchAirCompareSequential,
  formatCompareAirIndexCell,
  formatCompareReadingCell,
  formatCompareVsGuide,
  type CompareCityRow,
} from '@/utils/compareCities';

const DEFAULT_PM25_THRESHOLD = 55;
const MAX_RECOMMENDED = 4;

function CityToggleChip({
  city,
  selected,
  onToggle,
}: {
  city: CityName;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onToggle}
      className={
        selected
          ? 'rounded-full px-3.5 py-2'
          : 'rounded-full border border-border px-3.5 py-2'
      }
      style={selected ? { backgroundColor: BrandColors.secondary } : undefined}>
      <Text
        className={
          selected
            ? 'text-sm font-semibold text-white'
            : 'text-sm text-neutral-700'
        }>
        {city}
      </Text>
    </Pressable>
  );
}

function CompareResultCard({
  row,
  threshold,
}: {
  row: CompareCityRow;
  threshold: number;
}) {
  const chart = compareRowChartValue(row);
  const accent =
    chart.kind === 'aqi'
      ? compareBarColorFromAqi(chart.value, false)
      : compareBarColor(chart.value, threshold, false);

  if (!row.ok) {
    return (
      <View className="rounded-xl border border-primary/40 bg-red-50 p-3">
        <Text className="font-semibold text-primary">{row.city}</Text>
        <Text className="mt-1 text-sm text-neutral-700">
          {row.error ?? `HTTP ${row.http ?? 'error'}`}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="rounded-xl border border-border bg-white p-3"
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}>
      <Text className="text-base font-semibold text-neutral-900">
        {row.city}
      </Text>
      <View className="mt-2 gap-1">
        <Text className="text-sm text-neutral-600">
          Reading:{' '}
          <Text className="font-mono font-bold text-neutral-900">
            {formatCompareReadingCell(row)}
          </Text>
        </Text>
        <Text className="text-sm text-neutral-600">
          Air index:{' '}
          <Text className="font-semibold text-neutral-900">
            {formatCompareAirIndexCell(row.source, row.aq)}
          </Text>
        </Text>
        <Text className="text-sm text-neutral-600">
          Source: {compareSourceLabel(row)}
        </Text>
        <Text className="text-sm text-neutral-600">
          Guide: {formatCompareVsGuide(row, threshold)}
        </Text>
        {row.aq?.station_name ? (
          <Text className="text-xs text-neutral-400">
            Station: {row.aq.station_name}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function CompareCitiesScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { width: windowWidth } = useWindowDimensions();

  const runtimeConfig = useRuntimeConfig();
  const threshold =
    runtimeConfig.data?.dashboard.pm25_alert_threshold_ugm3 ?? DEFAULT_PM25_THRESHOLD;

  const [selected, setSelected] = useState<CityName[]>(() => [DEFAULT_CITY]);
  const [rows, setRows] = useState<CompareCityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [status, setStatus] = useState('');
  const [hasFetched, setHasFetched] = useState(false);

  const toggleCity = useCallback((city: CityName) => {
    setSelected((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city],
    );
  }, []);

  const runCompare = useCallback(async () => {
    if (selected.length === 0) {
      setRows([]);
      setStatus('Select at least one city to compare air readings.');
      setHasFetched(true);
      return;
    }

    setLoading(true);
    setProgress({ done: 0, total: selected.length });
    setStatus(`Fetching ${selected.length} city snapshot sequentially…`);
    try {
      await runtimeConfig.refetch();
      const settled = await fetchAirCompareSequential(selected, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setRows(settled);
      setStatus(
        `Updated ${settled.length} city snapshot${settled.length === 1 ? '' : 's'}.`,
      );
      setHasFetched(true);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Compare failed');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [selected, runtimeConfig]);

  const chartRows = useMemo(
    () =>
      rows.filter((row) => {
        if (!row.ok) return false;
        return compareRowChartValue(row).value != null;
      }),
    [rows],
  );

  const chartKinds = useMemo(
    () => chartRows.map((row) => compareRowChartValue(row).kind),
    [chartRows],
  );
  const aqiOnly =
    chartKinds.length > 0 &&
    chartKinds.every((kind) => kind === 'aqi' || kind === 'none');
  const showPm25Threshold = chartKinds.some((kind) => kind === 'pm25');

  const chartBars = useMemo(() => {
    return chartRows.map((row) => {
      const chart = compareRowChartValue(row);
      const short =
        row.city.length > 6 ? `${row.city.slice(0, 5)}…` : row.city;
      const color =
        chart.kind === 'aqi'
          ? compareBarColorFromAqi(chart.value, false)
          : compareBarColor(chart.value, threshold, false);
      return {
        value: chart.value ?? 0,
        label: short,
        frontColor: color,
        topLabelComponent: () => (
          <Text className="mb-0.5 text-[10px] font-mono text-neutral-500">
            {chart.value != null
              ? chart.kind === 'aqi'
                ? `A${chart.value}`
                : String(chart.value)
              : '—'}
          </Text>
        ),
      };
    });
  }, [chartRows, threshold]);

  const chartWidth = Math.max(windowWidth - 48, chartBars.length * 56);

  return (
    <StackScreen
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void runCompare()} />
      }>
      <Stack.Screen options={{ title: 'Compare cities', headerBackTitle: 'Back' }} />
      <View>
        <View className="mb-2 flex-row flex-wrap items-center gap-2">
          <Text className="text-lg font-extrabold text-ink">
            Compare cities · live air
          </Text>
          <InfoSheet label="City air comparison chart">
            <InfoSheetParagraph>
              Pick cities to compare live air side by side. Local station
              readings show as WAQI AQI. Model sources may show PM2.5 (µg/m³)
              instead.
            </InfoSheetParagraph>
            <InfoSheetParagraph>
              Read the numbers in the results too — do not rely on colour alone.
            </InfoSheetParagraph>
          </InfoSheet>
        </View>
        <Text className="text-sm leading-5 text-muted">
          Select cities to fetch live air side by side. Requests run one at a
          time to limit upstream rate pressure. Prefer station AQI when
          available; PM2.5 threshold ({threshold} µg/m³) applies only when a
          source provides concentrations. Keep selections small (about{' '}
          {MAX_RECOMMENDED} or fewer).
        </Text>

        <Text className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
          Cities
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {CITY_NAMES.map((city) => (
            <CityToggleChip
              key={city}
              city={city}
              selected={selected.includes(city)}
              onToggle={() => toggleCity(city)}
            />
          ))}
        </View>

        {selected.length > MAX_RECOMMENDED ? (
          <Text className="mt-2 text-xs text-warning">
            Many cities selected — upstream APIs may return HTTP 429. Prefer a smaller set.
          </Text>
        ) : null}

        <View className="mt-4 flex-row flex-wrap gap-2">
          <Pressable
            accessibilityRole="button"
            disabled={loading || selected.length === 0}
            onPress={() => void runCompare()}
            className="rounded-xl bg-secondary px-4 py-3 active:opacity-80"
            style={loading || selected.length === 0 ? { opacity: 0.5 } : undefined}>
            <Text className="text-sm font-semibold text-white">
              {loading
                ? progress
                  ? `Loading ${progress.done}/${progress.total}…`
                  : 'Loading…'
                : 'Compare'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => setSelected([DEFAULT_CITY])}
            className="rounded-xl border border-border px-4 py-3 active:opacity-70">
            <Text className="text-sm font-semibold text-neutral-800">
              Only {DEFAULT_CITY}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => setSelected([])}
            className="rounded-xl border border-border px-4 py-3 active:opacity-70">
            <Text className="text-sm font-semibold text-neutral-800">
              Clear
            </Text>
          </Pressable>
        </View>

        {status ? (
          <Text className="mt-3 text-xs text-neutral-500">{status}</Text>
        ) : null}
      </View>

      <View className="mt-4 rounded-2xl border border-border bg-white p-4">
        <Text className="mb-1 text-sm font-semibold text-ink">
          Snapshot chart
        </Text>
        <Text className="mb-3 text-xs text-muted">
          {aqiOnly
            ? 'Station AQI bars by city. Bar color follows AQI bands.'
            : showPm25Threshold
              ? `Live air bars. Dashed line is the PM2.5 threshold (${threshold} µg/m³) when concentrations are available.`
              : 'Live air bars by city.'}
        </Text>

        {loading && chartBars.length === 0 ? (
          <ActivityIndicator className="my-10 self-center" color={BrandColors.secondary} />
        ) : chartBars.length === 0 ? (
          <View className="min-h-[140px] items-center justify-center py-8">
            <Text className="text-center text-sm text-muted">
              {hasFetched
                ? 'No successful air readings to chart.'
                : 'Tap Compare after selecting cities — the chart loads with the results.'}
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={chartBars}
              width={chartWidth}
              height={200}
              barWidth={Math.min(36, Math.max(22, Math.floor(chartWidth / (chartBars.length * 2.2))))}
              spacing={18}
              barBorderRadius={5}
              hideRules
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={isDark ? '#404040' : '#d4d4d4'}
              yAxisTextStyle={{ color: isDark ? '#a3a3a3' : '#737373', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: isDark ? '#a3a3a3' : '#737373', fontSize: 10 }}
              noOfSections={4}
              maxValue={Math.max(
                showPm25Threshold ? threshold * 1.15 : 0,
                ...chartBars.map((b) => b.value),
                aqiOnly ? 100 : 80,
              )}
              {...(showPm25Threshold
                ? {
                  showReferenceLine1: true,
                  referenceLine1Position: threshold,
                  referenceLine1Config: {
                    color: BrandColors.accent,
                    dashWidth: 4,
                    dashGap: 4,
                    thickness: 2,
                    labelText: `Thr ${threshold}`,
                    labelTextStyle: { color: BrandColors.accent, fontSize: 10 },
                  },
                }
                : { showReferenceLine1: false })}
            />
          </ScrollView>
        )}
      </View>

      <View className="mt-4 gap-3">
        <Text className="text-sm font-semibold text-ink">
          Results
        </Text>
        {!hasFetched && !loading ? (
          <Text className="text-sm text-muted">
            Select cities and tap Compare to load readings.
          </Text>
        ) : null}
        {rows.map((row) => (
          <CompareResultCard key={row.city} row={row} threshold={threshold} />
        ))}
      </View>
    </StackScreen>
  );
}
