import { api } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/error";
import type { AirQualityResponse } from "@/lib/api/types";

export const DEFAULT_PM25_THRESHOLD_UGM3 = 55;
const FETCH_DELAY_MS = 650;

export type CompareCityRow = {
  city: string;
  ok: boolean;
  http?: number;
  source?: string | null;
  aq?: AirQualityResponse["air_quality"] | null;
  provenance?: Record<string, unknown> | null;
  error?: string;
};

export function formatCompareIndex(
  source: string | null | undefined,
  aq: AirQualityResponse["air_quality"] | null | undefined,
): string {
  if (
    source === "waqi" &&
    typeof aq?.aqi === "number" &&
    Number.isFinite(aq.aqi)
  ) {
    return String(Math.round(aq.aqi));
  }
  if (
    (source === "rapidapi_weather_air_quality" ||
      source === "weatherapi_com") &&
    typeof aq?.us_epa_index === "number" &&
    Number.isFinite(aq.us_epa_index)
  ) {
    return `EPA ${aq.us_epa_index}`;
  }
  return "—";
}

export function formatCompareAirIndexCell(
  source: string | null | undefined,
  aq: AirQualityResponse["air_quality"] | null | undefined,
): string {
  const idxRaw = formatCompareIndex(source, aq);
  if (source === "waqi" && idxRaw !== "—") return `WAQI ${idxRaw}`;
  return idxRaw;
}

export function formatCompareThreshold(
  pm25: number | null | undefined,
  thr: number,
): string {
  if (typeof pm25 !== "number" || Number.isNaN(pm25)) return "No PM2.5";
  if (pm25 > thr + 35) return `High (${pm25} vs ${thr})`;
  if (pm25 > thr) return `Alert (${pm25} vs ${thr})`;
  return `Below (${pm25} vs ${thr})`;
}

export function compareRowPm25(row: CompareCityRow): number | null {
  const pm = row.aq?.pm25_ug_m3 ?? row.aq?.pm25;
  if (typeof pm !== "number" || Number.isNaN(pm)) return null;
  return Math.round(pm);
}

export function compareSourceLabel(row: CompareCityRow): string {
  if (!row.ok) return "—";
  const confidence = row.provenance?.confidence;
  const tier =
    confidence && typeof confidence === "object"
      ? (confidence as Record<string, unknown>).tier
      : undefined;
  if (row.source && typeof tier === "string" && tier) {
    return `${row.source} (${tier})`;
  }
  return row.source || "—";
}

export function compareBarColor(
  pm25: number | null | undefined,
  thr: number,
  isCurrent: boolean,
): string {
  if (typeof pm25 !== "number" || Number.isNaN(pm25)) return "#8a9199";
  if (pm25 > thr + 35) return isCurrent ? "#ef4444" : "#c62828";
  if (pm25 > thr) return isCurrent ? "#fbbf24" : "#f57c00";
  return isCurrent ? "#34d399" : "#2e7d32";
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Sequential fetches (~650ms apart) to reduce upstream rate limits. */
export async function fetchAirCompareSequential(
  cities: string[],
  options?: {
    delayMs?: number;
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<CompareCityRow[]> {
  const delayMs = options?.delayMs ?? FETCH_DELAY_MS;
  const settled: CompareCityRow[] = [];

  for (let i = 0; i < cities.length; i++) {
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (i > 0) await sleep(delayMs, options?.signal);
    const city = cities[i];
    try {
      const data = await api.environment.air(city);
      settled.push({
        city,
        ok: true,
        source: data.source,
        aq: data.air_quality,
        provenance: data.provenance ?? null,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      settled.push({
        city,
        ok: false,
        http: err instanceof ApiError ? err.status : undefined,
        error:
          err instanceof Error ? err.message.slice(0, 560) : "Request failed",
      });
    }
    options?.onProgress?.(i + 1, cities.length);
  }

  return settled.sort((a, b) => a.city.localeCompare(b.city));
}
