import { ActivityIndicator, Text, View } from 'react-native';

import { AlertLevelColors, type AlertLevel } from '@/constants/brand';
import { formatNumber } from '@/utils/format';

interface StatusCardProps {
  label: string;
  value: string;
  unit?: string;
  accentColor?: string;
  loading?: boolean;
}

function StatusCard({ label, value, unit, accentColor, loading }: StatusCardProps) {
  return (
    <View
      className="min-w-[45%] flex-1 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
      style={accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : undefined}>
      <Text className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </Text>
      {loading ? (
        <ActivityIndicator className="mt-2 self-start" />
      ) : (
        <View className="mt-1 flex-row items-baseline gap-1">
          <Text className="font-mono text-2xl font-bold text-neutral-900 dark:text-white">
            {value}
          </Text>
          {unit ? (
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">{unit}</Text>
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

/** Recreates the PM2.5 / AQI / Alert level / Heat status-card row from `frontend/index.html`. */
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
  return (
    <View className="flex-row flex-wrap gap-3 px-4">
      <StatusCard label="Current PM2.5" value={formatNumber(pm25)} unit="µg/m³" loading={isLoadingAir} />
      <StatusCard label={aqiLabel} value={formatNumber(aqiValue)} loading={isLoadingAir} />
      <StatusCard
        label="Alert level"
        value={alertLevel}
        accentColor={AlertLevelColors[alertLevel]}
        loading={isLoadingAir}
      />
      <StatusCard
        label="Heat"
        value={formatNumber(heatTempC)}
        unit={heatLevel ? `°C · ${heatLevel}` : '°C'}
        loading={isLoadingHeat}
      />
    </View>
  );
}
