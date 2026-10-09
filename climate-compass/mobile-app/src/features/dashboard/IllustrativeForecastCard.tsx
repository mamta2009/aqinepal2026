import { ActivityIndicator, Text, View } from "react-native";
import { BrandColors } from "@/constants/brand";
import { InfoSheet, InfoSheetParagraph } from "@/components/ui";
import {
  DashboardSection,
  DashboardSectionAccent,
} from "@/features/dashboard/DashboardSection";
import { toApiError } from "@/services/api/client";
import type { SurgeForecastResponse } from "@/types/forecast";

interface IllustrativeForecastCardProps {
  data: SurgeForecastResponse | undefined;
  isLoading: boolean;
  isError?: boolean;
  error?: unknown;
}

/** Possible 3–5 day pressure score — website Illustrative forecast card. */
export function IllustrativeForecastCard({
  data,
  isLoading,
  isError,
  error,
}: IllustrativeForecastCardProps) {
  const score = data?.surge_forecast?.risk_score_0_100;
  const disclaimer =
    data?.surge_forecast?.disclaimer ||
    "No forecast explanation is available. Do not use this as a clinical prediction.";

  return (
    <DashboardSection accent={DashboardSectionAccent.forecast}>
      <View className="mb-1 flex-row flex-wrap items-center gap-2">
        <Text className="text-sm font-semibold text-ink dark:text-white">
          Possible 3–5 day pressure
        </Text>
        <InfoSheet label="Illustrative forecast">
          <InfoSheetParagraph>
            A simple 0–100 score that guesses how busy next few days might look
            using the example case chart above. Higher means more pressure in the
            demo model.
          </InfoSheetParagraph>
          <InfoSheetParagraph>
            For learning and discussion only — not a real health or weather
            forecast.
          </InfoSheetParagraph>
        </InfoSheet>
      </View>

      <Text className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted">
        Illustrative forecast
      </Text>

      {isLoading && !data ? (
        <ActivityIndicator
          className="my-6 self-center"
          color={BrandColors.link}
        />
      ) : isError && !data ? (
        <Text className="py-4 text-sm text-muted">
          Forecast unavailable
          {error ? `: ${toApiError(error).message}` : ""}
        </Text>
      ) : (
        <>
          <Text className="text-3xl font-extrabold text-ink dark:text-white">
            {typeof score === "number" ? score : "—"}
            <Text className="text-base font-semibold text-muted">
              {" "}
              / 100 risk score
            </Text>
          </Text>
          <Text className="mt-2 text-sm leading-5 text-muted">{disclaimer}</Text>
          <View className="mt-3 self-start rounded-full border border-border bg-white px-3 py-1">
            <Text className="text-[11px] font-bold text-ink">Synthetic input</Text>
          </View>
        </>
      )}
    </DashboardSection>
  );
}
