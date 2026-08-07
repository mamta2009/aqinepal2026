import { ActivityIndicator, Text, View } from 'react-native';

import type { CityInfo } from '@/types/cities';

/** Matches `--phase1` in `frontend/index.html` (geographic selector / info values). */
const PHASE1_GREEN = '#10b981';

interface CityInfoPanelProps {
  city: CityInfo | undefined;
  isLoading?: boolean;
}

function formatElevation(meters: number): string {
  return `${meters.toLocaleString()}m`;
}

/** Matches `updateCityInfo()` population display in `frontend/index.html`. */
function formatPopulation(population: number): string {
  return `${(population / 1_000_000).toFixed(1)}M`;
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[45%] flex-1 py-1">
      <Text className="text-xs uppercase tracking-wide text-muted">
        {label}
      </Text>
      <Text
        className="mt-0.5 font-mono text-sm font-bold"
        style={{ color: PHASE1_GREEN }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Recreates the city selector info strip from `frontend/index.html`
 * (Elevation, Province, Population, Hospitals, Phase, Status).
 */
export function CityInfoPanel({ city, isLoading }: CityInfoPanelProps) {
  if (isLoading && !city) {
    return (
      <View className="mb-4 px-4">
        <ActivityIndicator className="self-start" color={PHASE1_GREEN} />
      </View>
    );
  }

  if (!city) return null;

  const phase = city.phase ?? 1;
  const statusLabel = city.status ? `${city.status} ✓` : '—';

  return (
    <View
      className="mb-4 mx-4 rounded-lg px-4 py-3"
      style={{
        borderWidth: 1,
        borderColor: PHASE1_GREEN,
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
      }}>
      <View className="flex-row flex-wrap gap-x-2">
        <InfoCell label="Elevation" value={formatElevation(city.elevation)} />
        <InfoCell label="Province" value={city.province} />
        <InfoCell label="Population" value={formatPopulation(city.population)} />
        <InfoCell label="Hospitals" value={String(city.hospitals)} />
        <InfoCell label="Phase" value={`Phase ${phase}`} />
        <InfoCell label="Status" value={statusLabel} />
      </View>
    </View>
  );
}
