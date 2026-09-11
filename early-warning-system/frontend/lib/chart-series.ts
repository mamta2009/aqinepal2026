/**
 * Deterministic intra-day variation around the latest air reading.
 * Not observed hourly station history — seeded by city + calendar day.
 */
function seedUnit01(seedStr: string, idx: number): number {
  let h = 2166136261 >>> 0;
  const s = `${seedStr}:${idx}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const t = ((h >>> 0) % 1000) / 1000 + idx * 0.17;
  return 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
}

export type AirReadingMetric = "pm25" | "aqi";

/** Prefer true PM2.5 µg/m³; fall back to station AQI so the illustrative chart still draws. */
export function resolveAirChartBaseline(input: {
  pm25?: number | null;
  aqi?: number | null;
}): { value: number; metric: AirReadingMetric } | null {
  if (typeof input.pm25 === "number" && Number.isFinite(input.pm25)) {
    return { value: input.pm25, metric: "pm25" };
  }
  if (typeof input.aqi === "number" && Number.isFinite(input.aqi)) {
    return { value: input.aqi, metric: "aqi" };
  }
  return null;
}

export function generate24hFromReading(
  reading: number | null | undefined,
  cityLabel: string,
): number[] {
  if (typeof reading !== "number" || Number.isNaN(reading)) return [];
  const dayStamp = new Date().toISOString().slice(0, 10);
  const seed = `${cityLabel}|${dayStamp}`;
  return Array.from({ length: 24 }, (_, i) => {
    const wobble = seedUnit01(seed, i);
    const band = reading * 0.38;
    const v = reading + (wobble - 0.5) * 2 * band;
    return Math.max(5, Math.round(v));
  });
}
