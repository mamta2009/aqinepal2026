import { getAirQualityCurrent } from "@/services/api/dashboard";
import { toApiError } from "@/services/api/client";
import { alertLevelFromPm25 } from "@/utils/alertLevel";

import type { AirQualityPayload } from "@/types/airQuality";
import type { ProvenanceInfo } from "@/types/provenance";
import type { CityName } from "@/constants/cities";
import type { AlertLevel } from "@/constants/brand";
import { AlertLevelColors, BrandColors } from "@/constants/brand";

export interface CompareCityRow {
  city: CityName;
  ok: boolean;
  http?: number;
  source?: string | null;
  aq?: AirQualityPayload | null;
  provenance?: ProvenanceInfo | null;
  error?: string;
}

/** Mirrors web `formatCompareIndex()`. */
export function formatCompareIndex(
  source: string | null | undefined,
  aq: AirQualityPayload | null | undefined,
): string {
  const ap = aq && typeof aq === "object" ? aq : null;
  if (
    source === "waqi" &&
    typeof ap?.aqi === "number" &&
    !Number.isNaN(ap.aqi)
  ) {
    return String(Math.round(ap.aqi));
  }
  if (
    (source === "rapidapi_weather_air_quality" ||
      source === "weatherapi_com") &&
    typeof ap?.us_epa_index === "number" &&
    !Number.isNaN(ap.us_epa_index)
  ) {
    return `EPA ${ap.us_epa_index}`;
  }
  return "—";
}

export function formatCompareAirIndexCell(
  source: string | null | undefined,
  aq: AirQualityPayload | null | undefined,
): string {
  const idxRaw = formatCompareIndex(source, aq);
  if (source === "waqi" && idxRaw !== "—") return `WAQI ${idxRaw}`;
  return idxRaw;
}

/** Mirrors web `formatCompareThreshold()`. */
export function formatCompareThreshold(
  pm25: number | null | undefined,
  thr: number,
): string {
  if (typeof pm25 !== "number" || Number.isNaN(pm25)) return "—";
  if (pm25 > thr + 35) return `High (${pm25} vs ${thr})`;
  if (pm25 > thr) return `Alert (${pm25} vs ${thr})`;
  return `Below (${pm25} vs ${thr})`;
}

/** Solid hex fills for gifted-charts bars (web compareSnapshotBarStyle tiers). */
export function compareBarColor(
  pm25: number | null | undefined,
  thr: number,
  isCurrent: boolean,
): string {
  const level: AlertLevel = alertLevelFromPm25(pm25, thr);
  if (level === "NO DATA") return "#8a9199";
  if (level === "HIGH" || level === "SEVERE") {
    return isCurrent ? BrandColors.primaryLight : BrandColors.primary;
  }
  if (level === "MODERATE") {
    return isCurrent ? "#fbbf24" : "#f57c00";
  }
  return isCurrent ? "#34d399" : AlertLevelColors.LOW;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sequential city fetches (~650ms apart) matching web `refreshAirCompare()`
 * to reduce RapidAPI / upstream rate limits.
 */
export async function fetchAirCompareSequential(
  cities: CityName[],
  options?: {
    delayMs?: number;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<CompareCityRow[]> {
  const delayMs = options?.delayMs ?? 650;
  const settled: CompareCityRow[] = [];

  for (let i = 0; i < cities.length; i++) {
    if (i > 0) await sleep(delayMs);
    const city = cities[i];
    try {
      const data = await getAirQualityCurrent(city);
      settled.push({
        city,
        ok: true,
        source: data.source,
        aq: data.air_quality,
        provenance: data.provenance,
      });
    } catch (err) {
      const apiErr = toApiError(err);
      settled.push({
        city,
        ok: false,
        http: apiErr.status ?? undefined,
        error: apiErr.message.slice(0, 560),
      });
    }
    options?.onProgress?.(i + 1, cities.length);
  }

  return settled.sort((a, b) => a.city.localeCompare(b.city));
}

export function compareRowPm25(row: CompareCityRow): number | null {
  const pm = row.aq?.pm25_ug_m3;
  if (typeof pm !== "number" || Number.isNaN(pm)) return null;
  return Math.round(pm);
}

/** Prefer true PM2.5 µg/m³; for WAQI station readings fall back to reported AQI for charts. */
export function compareRowChartValue(row: CompareCityRow): {
  value: number | null;
  kind: "pm25" | "aqi" | "none";
} {
  const pm = compareRowPm25(row);
  if (pm != null) return { value: pm, kind: "pm25" };
  const aqi = row.aq?.aqi;
  if (typeof aqi === "number" && !Number.isNaN(aqi)) {
    return { value: Math.round(aqi), kind: "aqi" };
  }
  return { value: null, kind: "none" };
}

export function formatCompareReadingCell(row: CompareCityRow): string {
  const chart = compareRowChartValue(row);
  if (chart.kind === "pm25" && chart.value != null) {
    return `${chart.value} µg/m³`;
  }
  if (chart.kind === "aqi" && chart.value != null) {
    return `AQI ${chart.value}`;
  }
  return "—";
}

export function formatCompareVsGuide(row: CompareCityRow, thr: number): string {
  const chart = compareRowChartValue(row);
  if (chart.kind === "pm25") return formatCompareThreshold(chart.value, thr);
  if (chart.kind === "aqi" && chart.value != null) {
    if (chart.value <= 50) return `Good (AQI ${chart.value})`;
    if (chart.value <= 100) return `Moderate (AQI ${chart.value})`;
    if (chart.value <= 150) return `Sensitive (AQI ${chart.value})`;
    return `Unhealthy (AQI ${chart.value})`;
  }
  return "No air data";
}

/** Bar colors for station AQI (0–500) when PM2.5 µg/m³ is unavailable. */
export function compareBarColorFromAqi(
  aqi: number | null | undefined,
  isCurrent: boolean,
): string {
  if (typeof aqi !== "number" || Number.isNaN(aqi)) return "#8a9199";
  if (aqi > 150) {
    return isCurrent ? BrandColors.primaryLight : BrandColors.primary;
  }
  if (aqi > 100) {
    return isCurrent ? "#fbbf24" : "#f57c00";
  }
  if (aqi > 50) {
    return isCurrent ? "#fbbf24" : "#f57c00";
  }
  return isCurrent ? "#34d399" : AlertLevelColors.LOW;
}

export function compareSourceLabel(row: CompareCityRow): string {
  if (!row.ok) return "—";
  const tier = row.provenance?.confidence?.tier;
  if (row.source && typeof tier === "string" && tier) {
    return `${row.source} (${tier})`;
  }
  return row.source || "—";
}
