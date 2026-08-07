import { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { BrandColors } from "@/constants/brand";
import { InfoSheet, InfoSheetParagraph } from "@/components/ui";
import {
  DashboardSection,
  DashboardSectionAccent,
} from "@/features/dashboard/DashboardSection";
import type { CasesWeekResponse } from "@/types/cases";

interface CasesWeekCardProps {
  data: CasesWeekResponse | undefined;
  isLoading: boolean;
  /** Illustrative horizon predictions from surge forecast (website trend chart). */
  forecast?: Array<number | null>;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekdayLabel(date: string, index: number): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return `Day ${index + 1}`;
  return WEEKDAY_LABELS[parsed.getDay()] ?? `Day ${index + 1}`;
}

/**
 * Website-parity "Respiratory cases this week" trend:
 * solid history line + dashed illustrative forecast (DashboardTrendChart).
 */
export function CasesWeekCard({
  data,
  isLoading,
  forecast = [],
}: CasesWeekCardProps) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.max(windowWidth - 72, 280);

  const { historyLabels, caseValues, summary } = useMemo(() => {
    const rows = data?.data ?? [];
    const fromDays =
      data?.days?.length && data.days.length === rows.length
        ? data.days
        : rows.map((day) => day.cases);
    const labels =
      rows.length > 0
        ? rows.map((day, index) => weekdayLabel(day.date, index))
        : fromDays.map((_, index) => `Day ${index + 1}`);
    const values = fromDays.map((value) =>
      typeof value === "number" && Number.isFinite(value) ? value : 0,
    );
    const total = values.reduce((sum, value) => sum + value, 0);
    const first = values[0];
    const last = values.at(-1);
    return {
      historyLabels: labels,
      caseValues: values,
      summary:
        values.length > 0
          ? `Text summary: ${total} synthetic cases over ${values.length} days. The latest day has ${last} cases, compared with ${first} on the first day shown.`
          : null,
    };
  }, [data]);

  const chartModel = useMemo(() => {
    if (caseValues.length === 0) {
      return { historySeries: [], forecastSeries: [], pointCount: 0 };
    }

    const forecastVals = forecast.filter(
      (value): value is number => typeof value === "number" && Number.isFinite(value),
    );
    const forecastLabels = forecastVals.map((_, index) => `+${index + 1}d`);
    const allLabels = [...historyLabels, ...forecastLabels];
    const lastCase = caseValues.at(-1) ?? 0;

    const historySeries = allLabels.map((label, index) => {
      if (index < caseValues.length) {
        return {
          value: caseValues[index],
          label,
        };
      }
      return {
        label,
        hideDataPoint: true,
      };
    });

    const forecastSeries = allLabels.map((label, index) => {
      if (index < caseValues.length - 1) {
        return { label, hideDataPoint: true };
      }
      if (index === caseValues.length - 1) {
        return { value: lastCase, label, hideDataPoint: true };
      }
      const forecastIndex = index - caseValues.length;
      return {
        value: forecastVals[forecastIndex] ?? lastCase,
        label,
      };
    });

    return {
      historySeries,
      forecastSeries: forecastVals.length > 0 ? forecastSeries : [],
      pointCount: allLabels.length,
    };
  }, [caseValues, forecast, historyLabels]);

  const axisColor = isDark ? "#a3a3a3" : "#737373";
  const gridColor = isDark ? "#404040" : "#d4d4d4";
  const spacing =
    chartModel.pointCount > 0
      ? Math.max(28, Math.floor((chartWidth - 48) / chartModel.pointCount))
      : 36;

  return (
    <DashboardSection accent={DashboardSectionAccent.cases}>
      <View className="mb-1 flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-1 flex-row flex-wrap items-center gap-2">
          <Text className="text-sm font-semibold text-ink dark:text-white">
            Respiratory cases this week
          </Text>
          <InfoSheet label="Respiratory cases chart">
            <InfoSheetParagraph>
              The chart shows an example count of breathing-related clinic visits
              for about the last week in this city. The dashed line is a simple
              guess for the next few days.
            </InfoSheetParagraph>
            <InfoSheetParagraph>
              This is practice / demo data for now — not live hospital numbers.
            </InfoSheetParagraph>
            <InfoSheetParagraph>
              Source: {data?.source || "Unavailable"}
            </InfoSheetParagraph>
          </InfoSheet>
        </View>
        {data ? (
          <Text className="font-mono text-sm text-muted">{data.total} total</Text>
        ) : null}
      </View>

      <Text className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted">
        Trend and cases
      </Text>

      <Text className="mb-3 text-xs text-muted">
        {data?.note || "Case-series context is unavailable."}
      </Text>

      {isLoading ? (
        <ActivityIndicator
          className="h-[200px] self-center"
          color={BrandColors.secondary}
        />
      ) : chartModel.historySeries.length > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              data={chartModel.historySeries}
              data2={
                chartModel.forecastSeries.length > 0
                  ? chartModel.forecastSeries
                  : undefined
              }
              height={200}
              width={chartWidth}
              color={BrandColors.forest}
              color2={BrandColors.link}
              thickness={2}
              thickness2={2}
              curved
              areaChart
              startFillColor={BrandColors.forest}
              endFillColor={BrandColors.forest}
              startOpacity={0.18}
              endOpacity={0.02}
              strokeDashArray2={[6, 5]}
              hideDataPoints={false}
              dataPointsColor={BrandColors.forest}
              dataPointsRadius={3}
              hideRules
              yAxisTextStyle={{ color: axisColor, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: axisColor, fontSize: 10 }}
              yAxisColor={gridColor}
              xAxisColor={gridColor}
              initialSpacing={12}
              endSpacing={16}
              spacing={spacing}
              noOfSections={4}
            />
          </ScrollView>
          <View className="mt-3 flex-row flex-wrap gap-4">
            <View className="flex-row items-center gap-2">
              <View
                className="h-0.5 w-5 rounded-full"
                style={{ backgroundColor: BrandColors.forest }}
              />
              <Text className="text-[11px] text-muted">
                Synthetic respiratory cases
              </Text>
            </View>
            {chartModel.forecastSeries.length > 0 ? (
              <View className="flex-row items-center gap-2">
                <View
                  className="h-0.5 w-5 rounded-full"
                  style={{ backgroundColor: BrandColors.link }}
                />
                <Text className="text-[11px] text-muted">
                  Illustrative forecast
                </Text>
              </View>
            ) : null}
          </View>
          {summary ? (
            <Text className="mt-3 text-sm leading-5 text-muted">{summary}</Text>
          ) : null}
        </>
      ) : (
        <Text className="rounded-xl bg-white/60 py-4 text-sm text-muted">
          No case series is available to chart.
        </Text>
      )}
    </DashboardSection>
  );
}
