import { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { BrandColors } from "@/constants/brand";
import { InfoSheet, InfoSheetParagraph } from "@/components/ui";
import {
  DashboardSection,
  DashboardSectionAccent,
} from "@/features/dashboard/DashboardSection";
import type { CasesAllCitiesResponse } from "@/types/cases";

interface WeeklyCityComparisonCardProps {
  selectedCity: string;
  data: CasesAllCitiesResponse | undefined;
  isLoading: boolean;
}

/** Weekly synthetic cases by city — website Weekly city comparison card. */
export function WeeklyCityComparisonCard({
  selectedCity,
  data,
  isLoading,
}: WeeklyCityComparisonCardProps) {
  const rows = useMemo(() => {
    if (!data?.cities) return [];
    return Object.entries(data.cities)
      .map(([name, value]) => ({
        name,
        total: value.total ?? null,
      }))
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  }, [data]);

  return (
    <DashboardSection accent={DashboardSectionAccent.cases}>
      <View className="mb-1 flex-row flex-wrap items-center gap-2">
        <Text className="text-sm font-semibold text-ink dark:text-white">
          Weekly synthetic cases
        </Text>
        <InfoSheet label="Weekly city comparison">
          <InfoSheetParagraph>
            Compares example (demo) breathing-related case totals for each city
            this week. Helpful for practice conversations — real counts can
            replace this later.
          </InfoSheetParagraph>
        </InfoSheet>
      </View>

      <Text className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted">
        City comparison
      </Text>

      {isLoading && rows.length === 0 ? (
        <ActivityIndicator
          className="my-6 self-center"
          color={BrandColors.link}
        />
      ) : rows.length === 0 ? (
        <Text className="text-sm text-muted">Comparison data are unavailable.</Text>
      ) : (
        <View>
          <View className="mb-1 flex-row border-b border-border pb-2">
            <Text className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted">
              City
            </Text>
            <Text className="w-20 text-right text-xs font-semibold uppercase tracking-wide text-muted">
              Cases
            </Text>
          </View>
          {rows.map((row) => {
            const selected = row.name === selectedCity;
            return (
              <View
                key={row.name}
                className="flex-row items-center border-b border-border py-2.5"
                style={
                  selected
                    ? { backgroundColor: "rgba(15, 118, 110, 0.08)" }
                    : undefined
                }>
                <Text
                  className={
                    selected
                      ? "flex-1 px-1 text-sm font-extrabold text-ink"
                      : "flex-1 px-1 text-sm text-ink"
                  }>
                  {row.name}
                </Text>
                <Text
                  className={
                    selected
                      ? "w-20 px-1 text-right font-mono text-sm font-extrabold text-ink"
                      : "w-20 px-1 text-right font-mono text-sm text-ink"
                  }>
                  {row.total ?? "—"}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </DashboardSection>
  );
}
