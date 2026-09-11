import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, useColorScheme } from 'react-native';
import Slider from '@react-native-community/slider';
import { BrandColors } from '@/constants/brand';
import { InfoSheet, InfoSheetParagraph } from '@/components/ui';
import {
  DashboardSection,
  DashboardSectionAccent,
} from '@/features/dashboard/DashboardSection';
import {
  clampLiveAirSeed,
  clampLiveHeat,
  computeScenarioSandbox,
  syncScenarioBaselineFromCases,
} from '@/utils/scenarioSandbox';
import type { CasesWeekResponse } from '@/types/cases';

interface StressSandboxCardProps {
  cityLabel: string;
  livePm25: number | null | undefined;
  liveAqi?: number | null | undefined;
  liveHeatC: number | null | undefined;
  casesWeek: CasesWeekResponse | undefined;
}

function OutcomeCard({
  kicker,
  value,
  sub,
}: {
  kicker: string;
  value: string;
  sub: string;
}) {
  return (
    <View className="min-w-[45%] flex-1 rounded-xl border border-border bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-950">
      <Text className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {kicker}
      </Text>
      <Text className="mt-1 font-mono text-lg font-bold text-ink dark:text-white">
        {value}
      </Text>
      <Text className="mt-1 text-[11px] leading-4 text-muted">
        {sub}
      </Text>
    </View>
  );
}

/**
 * Recreates Scenario A · Stress sandbox from `frontend/index.html`
 * (illustrative PM2.5 × heat multipliers on synthetic weekly cases).
 */
export function StressSandboxCard({
  cityLabel,
  livePm25,
  liveAqi,
  liveHeatC,
  casesWeek,
}: StressSandboxCardProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const liveSeed = useMemo(
    () => clampLiveAirSeed({ pm25: livePm25, aqi: liveAqi }),
    [liveAqi, livePm25],
  );

  const [pm25, setPm25] = useState(() => liveSeed);
  const [heatC, setHeatC] = useState(() => clampLiveHeat(liveHeatC));
  const [userTouched, setUserTouched] = useState(false);

  const baseline = useMemo(
    () => syncScenarioBaselineFromCases(casesWeek),
    [casesWeek],
  );

  // Sync from live readings when the user has not moved the sliders (web parity).
  // City changes also clear userTouched so the new city live values apply.
  useEffect(() => {
    setUserTouched(false);
  }, [cityLabel]);

  useEffect(() => {
    if (userTouched) return;
    setPm25(liveSeed);
    setHeatC(clampLiveHeat(liveHeatC));
  }, [liveSeed, liveHeatC, userTouched, cityLabel]);
  const result = useMemo(
    () => computeScenarioSandbox({ pm25, heatC, baseline }),
    [pm25, heatC, baseline],
  );

  const useLiveReadings = () => {
    setUserTouched(false);
    setPm25(liveSeed);
    setHeatC(clampLiveHeat(liveHeatC));
  };

  const trackColor = isDark ? '#404040' : '#d4d4d4';

  return (
    <DashboardSection accent={DashboardSectionAccent.scenario}>
      <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-1 flex-row flex-wrap items-center gap-2">
          <Text className="text-sm font-semibold text-ink dark:text-white">
            Stress scenario sandbox
          </Text>
          <InfoSheet label="Stress scenario sandbox">
            <InfoSheetParagraph>
              Try "what if" changes for {cityLabel}: move the PM2.5 and heat
              sliders to see how the demo case numbers might change.
            </InfoSheetParagraph>
            <InfoSheetParagraph>
              For learning and discussion only — not a real prediction.
            </InfoSheetParagraph>
          </InfoSheet>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use current readings"
          onPress={useLiveReadings}
          className="rounded-md border px-3 py-1.5 active:opacity-70"
          style={{ borderColor: 'rgba(124, 58, 237, 0.45)' }}>
          <Text className="text-xs font-semibold text-neutral-800">
            Use current readings
          </Text>
        </Pressable>
      </View>

      <Text className="mb-4 text-xs leading-5 text-muted">
        Change pollution and heat to discuss possible pressure on services in{' '}
        {cityLabel}. This applies simple multipliers to synthetic case data; it is
        not a validated clinical forecast.
      </Text>

      <View className="mb-4">
        <View className="mb-1 flex-row items-baseline justify-between">
          <Text className="text-xs font-semibold text-neutral-600">
            Simulated PM2.5 burden (µg/m³)
          </Text>
          <Text className="font-mono text-sm font-bold text-ink dark:text-white">
            {Math.round(pm25)}
          </Text>
        </View>
        <Slider
          minimumValue={5}
          maximumValue={320}
          step={1}
          value={pm25}
          onValueChange={(v) => {
            setUserTouched(true);
            setPm25(v);
          }}
          minimumTrackTintColor={BrandColors.primary}
          maximumTrackTintColor={trackColor}
          thumbTintColor={BrandColors.primary}
        />
      </View>

      <View className="mb-4">
        <View className="mb-1 flex-row items-baseline justify-between">
          <Text className="text-xs font-semibold text-neutral-600">
            Simulated heat (effective °C)
          </Text>
          <Text className="font-mono text-sm font-bold text-ink dark:text-white">
            {heatC}
          </Text>
        </View>
        <Slider
          minimumValue={22}
          maximumValue={46}
          step={0.5}
          value={heatC}
          onValueChange={(v) => {
            setUserTouched(true);
            setHeatC(Math.round(v * 2) / 2);
          }}
          minimumTrackTintColor="#f57c00"
          maximumTrackTintColor={trackColor}
          thumbTintColor="#f57c00"
        />
      </View>

      <View className="flex-row flex-wrap gap-2">
        <OutcomeCard
          kicker="Baseline (synthetic avg / day)"
          value={
            result.baselineAvgDaily != null
              ? String(Math.round(result.baselineAvgDaily))
              : '—'
          }
          sub={`From Cases This Week API series for ${cityLabel}.`}
        />
        <OutcomeCard
          kicker="Illustrative load index"
          value={`${result.loadIndex} / 100`}
          sub="0–100 composite of dialled PM2.5 + heat strain (sandbox only)."
        />
        <OutcomeCard
          kicker="Multipliers applied"
          value={`Air ${result.airMul.toFixed(2)}× · Heat ${result.heatMul.toFixed(2)}×`}
          sub={`Combined × ${result.combinedMul.toFixed(2)} applied to baseline daily avg.`}
        />
        <OutcomeCard
          kicker="Rough scenario daily / week"
          value={
            result.simDaily != null
              ? `${result.simDaily} cases / day`
              : '—'
          }
          sub={
            result.simWeek != null
              ? `Week scale ≈ ${result.simWeek} if constant 7 days. ${result.deltaLabel}`
              : result.deltaLabel
          }
        />
      </View>
    </DashboardSection>
  );
}
