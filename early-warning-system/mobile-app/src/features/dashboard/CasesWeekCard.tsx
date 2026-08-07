import { useMemo } from 'react';
import { ActivityIndicator, Text, View, useColorScheme } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { BrandColors } from '@/constants/brand';
import { InfoSheet, InfoSheetParagraph } from '@/components/ui';
import {
  DashboardSection,
  DashboardSectionAccent,
} from '@/features/dashboard/DashboardSection';
import type { CasesWeekResponse } from '@/types/cases';

interface CasesWeekCardProps {
  data: CasesWeekResponse | undefined;
  isLoading: boolean;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Recreates the "Cases This Week" bar chart from `frontend/index.html` (synthetic WHO-pattern data). */
export function CasesWeekCard({ data, isLoading }: CasesWeekCardProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const bars = useMemo(() => {
    if (!data) return [];
    return data.data.map((day) => ({
      value: day.cases,
      label: WEEKDAY_LABELS[new Date(day.date).getDay()],
      frontColor: BrandColors.secondary,
    }));
  }, [data]);

  return (
    <DashboardSection accent={DashboardSectionAccent.cases}>
      <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-1 flex-row flex-wrap items-center gap-2">
          <Text className="text-sm font-semibold text-ink dark:text-white">
            Respiratory cases — this week
          </Text>
          <InfoSheet label="Respiratory cases chart">
            <InfoSheetParagraph>
              The bars show an example count of breathing-related clinic visits
              for about the last week in this city. The dashed line is a simple
              guess for the next few days.
            </InfoSheetParagraph>
            <InfoSheetParagraph>
              This is practice / demo data for now — not live hospital numbers.
            </InfoSheetParagraph>
            <InfoSheetParagraph>
              Source: {data?.source || 'Unavailable'}
            </InfoSheetParagraph>
          </InfoSheet>
        </View>
        {data ? (
          <Text className="font-mono text-sm text-muted">
            {data.total} total
          </Text>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator className="h-[160px] self-center" color={BrandColors.secondary} />
      ) : bars.length > 0 ? (
        <BarChart
          data={bars}
          height={140}
          barWidth={20}
          barBorderRadius={4}
          spacing={18}
          hideRules
          yAxisTextStyle={{ color: isDark ? '#a3a3a3' : '#737373', fontSize: 10 }}
          xAxisLabelTextStyle={{ color: isDark ? '#a3a3a3' : '#737373', fontSize: 10 }}
          yAxisColor={isDark ? '#404040' : '#d4d4d4'}
          xAxisColor={isDark ? '#404040' : '#d4d4d4'}
        />
      ) : (
        <Text className="text-sm text-muted">No case data yet.</Text>
      )}

      <Text className="mt-3 text-xs text-muted">
        {data?.note ?? 'Synthetic demo data — transitions to real DHIS2 data when connected.'}
      </Text>
    </DashboardSection>
  );
}
