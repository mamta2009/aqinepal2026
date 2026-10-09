import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";

import { BrandColors } from "@/constants/brand";
import { useEnvironmentOverview } from "@/hooks/useEnvironmentOverview";
import { toApiError } from "@/services/api/client";
import type { EnvironmentOverviewItem } from "@/types/environment";

function statusLabel(item: EnvironmentOverviewItem): string {
  const value = item.air_quality.aqi;
  if (typeof value === "number") {
    if (value <= 50) return "Good";
    if (value <= 100) return "Moderate";
    if (value <= 150) return "Use extra care";
    return "Unhealthy";
  }
  if (item.air_quality.pm25_ug_m3 == null) return "No air data";
  return item.air_quality.status || item.status || "Reading available";
}

function markerColor(item: EnvironmentOverviewItem): string {
  const label = statusLabel(item).toLowerCase();
  if (label.includes("unhealthy")) return BrandColors.aqUnhealthy;
  if (label.includes("extra care")) return BrandColors.aqSensitive;
  if (label.includes("moderate")) return BrandColors.aqModerate;
  if (label.includes("good")) return BrandColors.aqGood;
  return BrandColors.muted;
}

function position(
  item: EnvironmentOverviewItem,
  cities: EnvironmentOverviewItem[],
) {
  const lats = cities.map((city) => city.lat);
  const lons = cities.map((city) => city.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    x: 30 + ((item.lon - minLon) / Math.max(maxLon - minLon, 0.01)) * 340,
    y: 220 - ((item.lat - minLat) / Math.max(maxLat - minLat, 0.01)) * 180,
  };
}

/** Website-parity schematic map + city cards + accessible readings table. */
export function EnvironmentOverviewPanel() {
  const query = useEnvironmentOverview();
  const { width: windowWidth } = useWindowDimensions();
  const mapWidth = Math.min(windowWidth - 32, 400);
  const mapHeight = (mapWidth / 400) * 250;

  const cities = query.data?.cities ?? [];

  const marked = useMemo(
    () =>
      cities.map((city) => ({
        city,
        ...position(city, cities),
        color: markerColor(city),
        label: statusLabel(city),
      })),
    [cities],
  );

  if (query.isPending) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Loading environment overview"
        className="h-80 items-center justify-center rounded-3xl bg-sky-soft">
        <ActivityIndicator color={BrandColors.forest} />
      </View>
    );
  }

  if (query.isError || !query.data) {
    return (
      <View className="rounded-2xl border border-border bg-white p-5">
        <Text className="text-center text-2xl font-extrabold text-ink">
          Geographic overview unavailable
        </Text>
        <Text className="mt-2 text-center text-sm leading-5 text-muted">
          No city status should be inferred while the overview service is
          unavailable.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void query.refetch()}
          className="mt-5 min-h-11 items-center justify-center rounded-full bg-forest px-4 py-3 active:opacity-90">
          <Text className="font-extrabold text-white">Try again</Text>
        </Pressable>
        <Text className="mt-3 text-center text-xs text-alert-red">
          {toApiError(query.error).message}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View className="mb-4 flex-row flex-wrap items-center justify-between gap-3">
        <Text className="flex-1 text-sm text-muted">
          Overview status: {query.data.status}. Each city reports air and heat
          sources separately.
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={query.isFetching}
          onPress={() => void query.refetch()}
          className="min-h-11 items-center justify-center rounded-full border border-border bg-white px-4 py-2 active:opacity-80"
          style={query.isFetching ? { opacity: 0.6 } : undefined}>
          <Text className="text-sm font-extrabold text-ink">
            {query.isFetching ? "Refreshing…" : "Refresh"}
          </Text>
        </Pressable>
      </View>

      {cities.length === 0 ? (
        <View className="rounded-2xl border border-border bg-white p-5">
          <Text className="text-xl font-extrabold text-ink">No city readings</Text>
          <Text className="mt-2 text-sm text-muted">
            The service responded but did not provide locations.
          </Text>
        </View>
      ) : (
        <>
          <View className="rounded-2xl border border-border bg-white p-4">
            <Text className="text-xl font-extrabold text-ink">
              Nepal geographic overview
            </Text>
            <Text className="mt-1 text-sm text-muted">
              Marker labels and the list provide the status; color is
              supplementary.
            </Text>
            <View
              className="mt-3 overflow-hidden rounded-2xl bg-sky-soft"
              accessibilityLabel="Environmental readings by city schematic map">
              <Svg width={mapWidth} height={mapHeight} viewBox="0 0 400 250">
                <Path
                  d="M27 177 C52 120 83 75 137 60 C199 41 247 67 287 54 C337 38 371 73 376 120 C380 165 343 205 294 211 C236 220 194 195 142 211 C89 227 47 213 27 177Z"
                  fill="#ffffff"
                  stroke={BrandColors.borderStrong}
                  strokeWidth={2}
                />
                {marked.map((item) => (
                  <G
                    key={item.city.city}
                    transform={`translate(${item.x} ${item.y})`}>
                    <Circle
                      r={8}
                      fill={item.color}
                      stroke="#ffffff"
                      strokeWidth={3}
                    />
                    <SvgText
                      y={-13}
                      textAnchor="middle"
                      fill={BrandColors.ink}
                      fontSize={9}
                      fontWeight="700">
                      {item.city.city}
                    </SvgText>
                  </G>
                ))}
              </Svg>
            </View>
          </View>

          <View className="mt-4 gap-3">
            {cities.map((city) => {
              const heat =
                city.heat.effective_temp_c ?? city.heat.temp_c ?? null;
              const aqi = city.air_quality.aqi;
              const pm25 = city.air_quality.pm25_ug_m3;
              return (
                <View
                  key={city.city}
                  className="rounded-2xl border border-border bg-white p-4">
                  <Text className="font-extrabold text-ink">{city.city}</Text>
                  <Text className="mt-0.5 text-sm font-extrabold text-ink">
                    {statusLabel(city)}
                  </Text>
                  <Text className="mt-1 text-sm font-bold text-ink-soft">
                    AQI score {aqi ?? "—"}
                    {heat != null ? ` · Heat ${heat}°C` : ""}
                  </Text>
                  {pm25 != null ? (
                    <Text className="mt-0.5 text-xs text-muted">
                      Fine particles (PM2.5): {pm25} µg/m³
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View className="mt-4 overflow-hidden rounded-2xl border border-border bg-white">
            <View className="p-4">
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Accessible data view
              </Text>
              <Text className="mt-1 text-xl font-extrabold text-ink">
                All city readings
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View className="min-w-[700px] px-2 pb-4">
                <View className="flex-row border-b border-border bg-surface px-3 py-2">
                  {[
                    "City",
                    "Status",
                    "AQI score",
                    "Heat",
                    "PM2.5 (detail)",
                    "Sources",
                  ].map((heading) => (
                    <Text
                      key={heading}
                      className="w-[116px] pr-2 text-xs font-extrabold text-ink">
                      {heading}
                    </Text>
                  ))}
                </View>
                {cities.map((city) => {
                  const heat =
                    city.heat.effective_temp_c ?? city.heat.temp_c ?? null;
                  return (
                    <View
                      key={city.city}
                      className="flex-row border-b border-border px-3 py-3">
                      <Text className="w-[116px] pr-2 text-sm font-extrabold text-ink">
                        {city.city}
                      </Text>
                      <Text className="w-[116px] pr-2 text-sm font-bold text-ink">
                        {statusLabel(city)}
                      </Text>
                      <Text className="w-[116px] pr-2 text-sm text-ink">
                        {city.air_quality.aqi ?? "No data"}
                      </Text>
                      <Text className="w-[116px] pr-2 text-sm text-ink">
                        {heat != null ? `${heat}°C` : "No data"}
                      </Text>
                      <Text className="w-[116px] pr-2 text-sm text-muted">
                        {city.air_quality.pm25_ug_m3 != null
                          ? `${city.air_quality.pm25_ug_m3} µg/m³`
                          : city.air_quality.aqi != null
                            ? "—"
                            : "No data"}
                      </Text>
                      <Text className="w-[116px] pr-2 text-sm text-muted">
                        {city.air_quality.source || "Air source unavailable"};{" "}
                        {city.heat.source || "heat source unavailable"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </>
      )}

      <Text className="mt-5 text-center text-xs text-muted">
        Generated{" "}
        {query.data.generated_at
          ? new Date(query.data.generated_at).toLocaleString()
          : "at an unreported time"}
        . Automatically refreshes every 30 minutes.
      </Text>
    </View>
  );
}
