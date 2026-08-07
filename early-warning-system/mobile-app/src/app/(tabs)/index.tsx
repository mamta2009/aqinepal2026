import { Image } from "expo-image";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  InfoSheet,
  InfoSheetParagraph,
  RecommendationCard,
  SectionTitle,
  StatusCard,
} from "@/components/ui";
import { RainStatusIcon } from "@/components/ui/rain-status-icon";
import { AirBandColors } from "@/constants/brand";
import { BottomTabInset, Spacing } from "@/constants/theme";
import {
  AirQualityChart,
  CasesWeekCard,
  CityInfoPanel,
  CityPicker,
  DashboardActionsSidebar,
  DashboardMenuButton,
  FiveDayForecastCard,
  IllustrativeForecastCard,
  RecentAlertsCard,
  StressSandboxCard,
  WeeklyCityComparisonCard,
} from "@/features/dashboard";
import { useAirQuality } from "@/hooks/useAirQuality";
import { useCasesAllCities } from "@/hooks/useCasesAllCities";
import { useCasesWeek } from "@/hooks/useCasesWeek";
import { useCities } from "@/hooks/useCities";
import { useHeatCurrent } from "@/hooks/useHeatCurrent";
import { useLatestAlert } from "@/hooks/useLatestAlert";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useSurgeForecast } from "@/hooks/useSurgeForecast";
import { useWeatherCurrent } from "@/hooks/useWeatherCurrent";
import { useWeekForecast } from "@/hooks/useWeekForecast";
import { getClimateGuidance } from "@/lib/climate-guidance";
import { briefAirMeasurement, explainAirMeasurement } from "@/lib/pm25-aqi";
import { extractRainIndicator } from "@/lib/weather-rain";
import { toApiError } from "@/services/api/client";
import { useDashboardStore } from "@/store/dashboardStore";
import type { ProvenanceInfo } from "@/types/provenance";

function provenanceHelpLine(
  source: string | null | undefined,
  provenance: ProvenanceInfo | Record<string, unknown> | null | undefined,
): string {
  const tier =
    provenance &&
      typeof provenance === "object" &&
      provenance.confidence &&
      typeof provenance.confidence === "object" &&
      typeof (provenance.confidence as { tier?: unknown }).tier === "string"
      ? (provenance.confidence as { tier: string }).tier
      : null;
  const role =
    provenance &&
      typeof provenance === "object" &&
      typeof (provenance as { deployment_role?: unknown }).deployment_role ===
      "string"
      ? String((provenance as { deployment_role: string }).deployment_role).replaceAll(
        "_",
        " ",
      )
      : null;
  const confidence = tier
    ? `Confidence: ${tier}`
    : role || "Provenance details unavailable";
  return `Source: ${source || "Unavailable"} · ${confidence}`;
}
export default function HomeScreen() {
  const selectedCity = useDashboardStore((state) => state.selectedCity);
  const setSelectedCity = useDashboardStore((state) => state.setSelectedCity);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const runtimeConfig = useRuntimeConfig();
  const cities = useCities();
  const airQuality = useAirQuality(selectedCity);
  const heat = useHeatCurrent(selectedCity);
  const weather = useWeatherCurrent(selectedCity);
  const casesWeek = useCasesWeek(selectedCity);
  const weekForecast = useWeekForecast(selectedCity);
  const surgeForecast = useSurgeForecast(selectedCity, showDetails);
  const allCases = useCasesAllCities(showDetails);
  const latestAlert = useLatestAlert(selectedCity);

  const selectedCityInfo = cities.data?.cities.find(
    (c) => c.name === selectedCity,
  );

  const aqPayload = airQuality.data?.air_quality;
  const pm25 = aqPayload?.pm25_ug_m3 ?? null;
  const continuousAqi =
    typeof aqPayload?.aqi === "number" && Number.isFinite(aqPayload.aqi)
      ? aqPayload.aqi
      : null;
  const usEpaIndex =
    typeof aqPayload?.us_epa_index === "number"
      ? aqPayload.us_epa_index
      : null;

  const guidance = useMemo(
    () =>
      getClimateGuidance({
        aqi: continuousAqi,
        pm25,
        usEpaIndex,
        effectiveTemperatureC: heat.data?.heat_temperature_display,
      }),
    [continuousAqi, pm25, usEpaIndex, heat.data?.heat_temperature_display],
  );

  const airDetail = briefAirMeasurement({
    pm25,
    aqiScore: continuousAqi,
  });
  const airHelp = explainAirMeasurement({
    pm25,
    aqiScore: continuousAqi,
  });

  const heatTemp = heat.data?.heat_temperature_display;
  const rain = useMemo(() => {
    const payload = weather.data?.weather;
    return extractRainIndicator(
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : null,
    );
  }, [weather.data]);

  const bandColor = AirBandColors[guidance.airBand];
  const heroTint =
    guidance.airBand === "good"
      ? "#ecf8f0"
      : guidance.airBand === "moderate"
        ? "#fff8e8"
        : guidance.airBand === "sensitive"
          ? "#fff1e8"
          : guidance.airBand === "unhealthy"
            ? "#fdecec"
            : "#f3f6f8";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        airQuality.refetch(),
        heat.refetch(),
        weather.refetch(),
        casesWeek.refetch(),
        weekForecast.refetch(),
        latestAlert.refetch(),
        runtimeConfig.refetch(),
        cities.refetch(),
        ...(showDetails
          ? [surgeForecast.refetch(), allCases.refetch()]
          : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    airQuality,
    heat,
    weather,
    casesWeek,
    weekForecast,
    latestAlert,
    runtimeConfig,
    cities,
    showDetails,
    surgeForecast,
    allCases,
  ]);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{
          paddingBottom: BottomTabInset + Spacing.four,
        }}>
        <View className="flex-row items-start justify-between px-4 pb-2 pt-2">
          <View className="mr-3 flex-1 flex-row items-center gap-3">
            <Image
              source={require("@/assets/images/climate-compass-logo-192.png")}
              style={{ width: 44, height: 44 }}
              contentFit="contain"
              accessibilityLabel="Climate Compass logo"
            />
            <View className="flex-1">
              <Text className="text-xl font-extrabold tracking-tight text-forest">
                Climate Compass
              </Text>
              <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
                Climate-Health Alerts
              </Text>
            </View>
          </View>
          <DashboardMenuButton onPress={() => setSidebarOpen(true)} />
        </View>

        <CityPicker selectedCity={selectedCity} onSelectCity={setSelectedCity} />

        <View className="px-4 py-3">
          <SectionTitle
            eyebrow="Today's health decision"
            title="Can we go outside?"
            lede={`Clear public guidance for air, heat, and rain in ${selectedCity} — separate from operator alert rules.`}
          />
        </View>

        <View className="mx-4 mb-4 rounded-3xl border border-border p-5" style={{ backgroundColor: heroTint }}>
          <View className="mb-3 self-start rounded-full bg-white/80 px-3 py-1">
            <Text className="text-sm font-extrabold" style={{ color: bandColor }}>
              {guidance.label}
            </Text>
          </View>
          <Text className="text-xl font-extrabold leading-7 text-ink">
            {guidance.outdoorAnswer}
          </Text>
          <Text className="mt-3 text-base leading-6 text-ink-soft">
            {guidance.summary}
          </Text>
        </View>

        <View className="mb-4 gap-3 px-4">
          <View className="flex-row gap-3">
            <StatusCard
              label="Air quality"
              value={guidance.label}
              detail={airDetail}
              accentColor={bandColor}
              help={
                <InfoSheet label="Air quality">
                  <InfoSheetParagraph>
                    The big word here is a simple level for how clean or dirty
                    the air is: Good, Moderate, Use extra care, or Unhealthy.
                  </InfoSheetParagraph>
                  <InfoSheetParagraph>
                    The small line may show PM2.5 (tiny pollution particles in
                    the air) and ~AQI (a common air score from about 0 to 500).
                    Higher PM2.5 or AQI usually means dirtier air.
                  </InfoSheetParagraph>
                  {airHelp ? (
                    <InfoSheetParagraph>{airHelp}</InfoSheetParagraph>
                  ) : null}
                  <InfoSheetParagraph>
                    {provenanceHelpLine(
                      airQuality.data?.source,
                      airQuality.data?.provenance,
                    )}
                  </InfoSheetParagraph>
                </InfoSheet>
              }
            />
            <StatusCard
              label="Heat"
              value={
                typeof heatTemp === "number" && Number.isFinite(heatTemp)
                  ? `${Math.round(heatTemp)}°C`
                  : "—"
              }
              detail="How hot it feels outdoors"
              help={
                <InfoSheet label="Heat">
                  <InfoSheetParagraph>
                    The big number is how warm it feels outside in °C
                    (Celsius). We use a feels-like temperature when the weather
                    source provides one.
                  </InfoSheetParagraph>
                  <InfoSheetParagraph>
                    Higher numbers mean hotter conditions. Plan shade, water,
                    and rest when it feels especially hot.
                  </InfoSheetParagraph>
                  <InfoSheetParagraph>
                    {provenanceHelpLine(
                      heat.data?.source,
                      heat.data?.provenance,
                    )}
                  </InfoSheetParagraph>
                </InfoSheet>
              }
            />
          </View>
          <StatusCard
            label="Rain"
            value={rain.status}
            valueContent={
              <View className="flex-row items-center gap-2">
                <RainStatusIcon status={rain.status} />
                <Text className="text-lg font-extrabold text-ink">
                  {rain.status}
                </Text>
              </View>
            }
            detail={rain.summary}
            help={
              <InfoSheet label="Rain">
                <InfoSheetParagraph>
                  The icon shows if it looks rainy, a little wet, or dry at the
                  place you selected right now.
                </InfoSheetParagraph>
                <InfoSheetParagraph>
                  The small text may show how much rain was reported (in mm) or
                  a short weather note such as light rain or clear skies.
                </InfoSheetParagraph>
                <InfoSheetParagraph>
                  {provenanceHelpLine(
                    typeof weather.data?.source === "string"
                      ? weather.data.source
                      : null,
                    weather.data?.provenance as
                    | ProvenanceInfo
                    | Record<string, unknown>
                    | undefined,
                  )}
                </InfoSheetParagraph>
              </InfoSheet>
            }
          />
        </View>

        <View className="mb-2 px-4">
          <SectionTitle
            eyebrow="Recommendations"
            title="Five things to do today"
          />
          {guidance.recommendations.map((item, index) => (
            <RecommendationCard
              key={item.title}
              index={index + 1}
              title={item.title}
              action={item.action}
            />
          ))}
        </View>

        <View className="mb-4 gap-3 px-4">
          <View className="rounded-2xl border border-border bg-white p-4">
            <Text className="text-xs font-extrabold uppercase tracking-wide text-forest">
              Families
            </Text>
            <Text className="mt-1 text-sm leading-5 text-muted">
              {guidance.audienceAdvice.parent}
            </Text>
          </View>
          <View className="rounded-2xl border border-border bg-white p-4">
            <Text className="text-xs font-extrabold uppercase tracking-wide text-forest">
              Facilities & sites
            </Text>
            <Text className="mt-1 text-sm leading-5 text-muted">
              {guidance.audienceAdvice.school}
            </Text>
          </View>
          <View className="rounded-2xl border border-border bg-white p-4">
            <Text className="text-xs font-extrabold uppercase tracking-wide text-forest">
              Health settings
            </Text>
            <Text className="mt-1 text-sm leading-5 text-muted">
              {guidance.audienceAdvice.student}
            </Text>
          </View>
          <Text className="text-xs leading-5 text-muted">
            {guidance.operatorAlertNote}
          </Text>
        </View>

        <View className="mb-3 px-4">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showDetails }}
            onPress={() => setShowDetails((v) => !v)}
            className="min-h-11 items-center justify-center rounded-full border border-border bg-white px-4 py-3">
            <Text className="font-extrabold text-link">
              {showDetails
                ? "Hide detailed readings"
                : "Show detailed readings & tools"}
            </Text>
          </Pressable>
        </View>

        {showDetails ? (
          <View className="mt-1 gap-4 px-4">
            <AirQualityChart
              pm25={pm25}
              cityLabel={selectedCity}
              sourceLabel={airQuality.data?.source ?? "API"}
            />
            <CasesWeekCard
              data={casesWeek.data}
              isLoading={casesWeek.isLoading}
              forecast={
                surgeForecast.data?.surge_forecast?.predicted_cases_by_horizon_day
                  ? Object.values(
                    surgeForecast.data.surge_forecast
                      .predicted_cases_by_horizon_day,
                  ).filter(
                    (value): value is number | null =>
                      value === null || typeof value === "number",
                  )
                  : []
              }
            />
            <IllustrativeForecastCard
              data={surgeForecast.data}
              isLoading={surgeForecast.isLoading}
              isError={surgeForecast.isError}
              error={surgeForecast.error}
            />
            <WeeklyCityComparisonCard
              selectedCity={selectedCity}
              data={allCases.data}
              isLoading={allCases.isLoading}
            />
            <FiveDayForecastCard
              cityLabel={selectedCity}
              pm25={pm25}
              data={weekForecast.data}
              isLoading={weekForecast.isLoading}
              isError={weekForecast.isError}
              error={weekForecast.error}
            />
            <StressSandboxCard
              cityLabel={selectedCity}
              livePm25={pm25}
              liveHeatC={heat.data?.heat_temperature_display}
              casesWeek={casesWeek.data}
            />
          </View>
        ) : null}

        {airQuality.isError ? (
          <Text className="mx-4 mt-3 text-sm text-alert-red">
            Could not load air quality for {selectedCity}:{" "}
            {toApiError(airQuality.error).message}
          </Text>
        ) : null}
      </ScrollView>

      <DashboardActionsSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onRefresh={onRefresh}
        refreshing={refreshing}
        selectedCity={selectedCity}
      />
    </SafeAreaView>
  );
}
