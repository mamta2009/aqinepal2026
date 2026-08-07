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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';

import { BrandColors } from '@/constants/brand';
import { CITY_NAMES, DEFAULT_CITY, type CityName } from '@/constants/cities';
import { useRuntimeConfig } from '@/hooks/useRuntimeConfig';
import {
  compareBarColor,
  compareRowPm25,
  compareSourceLabel,
  fetchAirCompareSequential,
  formatCompareAirIndexCell,
  formatCompareThreshold,
  type CompareCityRow,
} from '@/utils/compareCities';
import { Spacing } from '@/constants/theme';

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
  const pm25 = compareRowPm25(row);
  const accent = compareBarColor(pm25, threshold, false);

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
          PM2.5:{' '}
          <Text className="font-mono font-bold text-neutral-900">
            {pm25 != null ? `${pm25} µg/m³` : '—'}
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
          vs threshold: {formatCompareThreshold(pm25, threshold)}
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
      const refreshed = await runtimeConfig.refetch();
      const thr =
        refreshed.data?.dashboard.pm25_alert_threshold_ugm3 ?? threshold;
      const settled = await fetchAirCompareSequential(selected, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setRows(settled);
      setStatus(
        `Compared ${settled.length} cit${settled.length === 1 ? 'y' : 'ies'} · threshold ${thr} µg/m³`,
      );
      setHasFetched(true);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Compare failed');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [selected, runtimeConfig, threshold]);

  const chartBars = useMemo(() => {
    return rows
      .filter((r) => r.ok)
      .map((row) => {
        const pm = compareRowPm25(row);
        const short =
          row.city.length > 6 ? `${row.city.slice(0, 5)}…` : row.city;
        return {
          value: pm ?? 0,
          label: short,
          frontColor: compareBarColor(pm, threshold, false),
          topLabelComponent: () => (
            <Text className="mb-0.5 text-[10px] font-mono text-neutral-500">
              {pm != null ? String(pm) : '—'}
            </Text>
          ),
        };
      });
  }, [rows, threshold]);

  const chartWidth = Math.max(windowWidth - 48, chartBars.length * 56);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Compare cities', headerBackTitle: 'Back' }} />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void runCompare()} />
        }
        contentContainerStyle={{ paddingBottom: Spacing.four * 4 }}
        keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-3">
          <Text className="text-sm leading-5 text-neutral-500">
            Select cities to load side-by-side air readings. Fetches run one city at a time
            (~0.65s apart) to reduce rate limits. Keep selections small (about {MAX_RECOMMENDED}{' '}
            or fewer).
          </Text>

          <Text className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
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

        <View className="mt-4 mx-4 rounded-2xl border border-border bg-white p-4">
          <Text className="mb-1 text-sm font-semibold text-neutral-900">
            Snapshot chart
          </Text>
          <Text className="mb-3 text-xs text-neutral-500">
            PM2.5 (µg/m³) by city. Bar color follows alert tiers. Dashed line is the stored
            threshold ({threshold} µg/m³).
          </Text>

          {loading && chartBars.length === 0 ? (
            <ActivityIndicator className="my-10 self-center" color={BrandColors.secondary} />
          ) : chartBars.length === 0 ? (
            <View className="min-h-[140px] items-center justify-center py-8">
              <Text className="text-center text-sm text-neutral-500">
                {hasFetched
                  ? 'No successful PM2.5 readings to chart.'
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
                  threshold * 1.15,
                  ...chartBars.map((b) => b.value),
                  80,
                )}
                showReferenceLine1
                referenceLine1Position={threshold}
                referenceLine1Config={{
                  color: BrandColors.accent,
                  dashWidth: 4,
                  dashGap: 4,
                  thickness: 2,
                  labelText: `Thr ${threshold}`,
                  labelTextStyle: { color: BrandColors.accent, fontSize: 10 },
                }}
              />
            </ScrollView>
          )}
        </View>

        <View className="mt-4 gap-3 px-4">
          <Text className="text-sm font-semibold text-neutral-900">
            Results
          </Text>
          {!hasFetched && !loading ? (
            <Text className="text-sm text-neutral-500">
              Select cities and tap Compare to load readings.
            </Text>
          ) : null}
          {rows.map((row) => (
            <CompareResultCard key={row.city} row={row} threshold={threshold} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
