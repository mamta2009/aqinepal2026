export type WeekForecastTrend = {
  model?: string;
  next_day_estimate?: number;
  predicted_next_day?: number;
  week_total_estimate?: number;
  confidence?: string;
  r2_score?: number;
};

export type ForecastDay = {
  day: number;
  value: number;
  cases: number;
};

export type ForecastMetric = "pm25" | "aqi";

/**
 * Expands a week-trend next-day estimate (+ optional live air baseline)
 * into five day cells — same approach as the legacy dashboard strip.
 * Prefer PM2.5 µg/m³; fall back to station AQI so cards still populate.
 */
export function buildFiveDayForecast(
  forecast: WeekForecastTrend | undefined,
  baseline: number | null | undefined,
): ForecastDay[] {
  const nextRaw = forecast?.next_day_estimate ?? forecast?.predicted_next_day;
  const next = typeof nextRaw === "number" ? nextRaw : 12;

  const days: ForecastDay[] = [];
  for (let day = 1; day <= 5; day++) {
    const cases = Math.max(0, Math.round(next * (1 + (day - 1) * 0.04)));
    let valueDay: number;
    if (typeof baseline === "number" && !Number.isNaN(baseline)) {
      valueDay = Math.min(
        280,
        Math.round(baseline * (1 + (day - 1) * 0.035) + (day - 1) * 2),
      );
    } else {
      valueDay = Math.min(280, Math.round(cases * 12 + day * 3));
    }
    days.push({ day, value: valueDay, cases });
  }
  return days;
}

/** @deprecated Use `day.value` — kept for callers that still read `pm25`. */
export function withLegacyPm25Field(
  days: ForecastDay[],
): Array<ForecastDay & { pm25: number }> {
  return days.map((day) => ({ ...day, pm25: day.value }));
}

export function resolveForecastBaseline(input: {
  pm25?: number | null;
  aqi?: number | null;
}): { value: number; metric: ForecastMetric } | null {
  if (typeof input.pm25 === "number" && Number.isFinite(input.pm25)) {
    return { value: input.pm25, metric: "pm25" };
  }
  if (typeof input.aqi === "number" && Number.isFinite(input.aqi)) {
    return { value: input.aqi, metric: "aqi" };
  }
  return null;
}
