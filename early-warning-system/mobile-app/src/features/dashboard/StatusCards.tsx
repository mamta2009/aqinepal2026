import { ActivityIndicator, Text, View } from 'react-native';

import {
  AlertLevelColors,
  BrandColors,
  HeatLevelColors,
  type AlertLevel,
} from '@/constants/brand';
import type { HeatLevel } from '@/types/heat';
import { formatNumber } from '@/utils/format';

/** Matches web `.status-card::before` default (`--low`). */
const STATUS_ACCENT_DEFAULT = BrandColors.success;

function heatAccentColor(level: string | null | undefined): string {
  if (level && level in HeatLevelColors) {
    return HeatLevelColors[level as HeatLevel];
  }
  return STATUS_ACCENT_DEFAULT;
}

interface StatusCardProps {
  label: string;
  value: string;
  unit?: string;
  accentColor?: string;
  loading?: boolean;
}

function StatusCard({
  label,
  value,
  unit,
  accentColor = STATUS_ACCENT_DEFAULT,
  loading,
}: StatusCardProps) {
  return (
    <View
      className="min-w-[45%] flex-1 rounded-2xl border border-border bg-white p-4"
      style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}>
      <Text className="text-xs uppercase tracking-wide text-muted">
        {label}
      </Text>
      {loading ? (
        <ActivityIndicator className="mt-2 self-start" />
      ) : (
        <View className="mt-1">
          <View className="flex-row items-baseline gap-1">
            <Text className="font-mono text-2xl font-bold text-ink dark:text-white">
              {value}
            </Text>
          </View>
          {unit ? (
            <Text className="mt-1 text-xs leading-4 text-muted">
              {unit}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

interface StatusCardsProps {
  pm25: number | null | undefined;
  aqiValue: number | null | undefined;
  aqiLabel: string;
  alertLevel: AlertLevel;
  heatTempC: number | null | undefined;
  heatLevel: string | null | undefined;
  isLoadingAir: boolean;
  isLoadingHeat: boolean;
}

/** Recreates the five status cards from `frontend/index.html` (PM2.5, AQI, Alert, Heat, Projection). */
export function StatusCards({
  pm25,
  aqiValue,
  aqiLabel,
  alertLevel,
  heatTempC,
  heatLevel,
  isLoadingAir,
  isLoadingHeat,
}: StatusCardsProps) {
  const projection =
    typeof pm25 === 'number' && !Number.isNaN(pm25) ? Math.round(pm25 * 0.9) : null;

  return (
    <View className="flex-row flex-wrap gap-3 px-4">
      <StatusCard
        label="Current PM2.5"
        value={formatNumber(pm25)}
        unit="µg/m³"
        loading={isLoadingAir}
      />
      <StatusCard label={aqiLabel} value={formatNumber(aqiValue)} loading={isLoadingAir} />
      <StatusCard
        label="Alert level"
        value={alertLevel}
        unit="Current Status"
        accentColor={AlertLevelColors[alertLevel]}
        loading={isLoadingAir}
      />
      <StatusCard
        label="Heat"
        value={formatNumber(heatTempC)}
        unit={heatLevel ? `°C · ${heatLevel}` : '°C'}
        accentColor={heatAccentColor(heatLevel)}
        loading={isLoadingHeat}
      />
      <StatusCard
        label="PM2.5 projection"
        value={formatNumber(projection)}
        unit="Rough scalar (current × 0.9), not forecast"
        loading={isLoadingAir}
      />
    </View>
  );
}
