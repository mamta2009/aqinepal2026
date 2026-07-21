import type { ForecastDay, WeekForecastTrend } from "@/types/forecast";

/**
 * Mirrors `loadAIForecasts()` in `frontend/index.html`: expands
 * `forecast.next_day_estimate` (+ optional live PM2.5 baseline) into 5 day cells.
 */
export function buildFiveDayForecast(
  forecast: WeekForecastTrend | undefined,
  pm25Baseline: number | null | undefined,
): ForecastDay[] {
  const next =
    typeof forecast?.next_day_estimate === "number"
      ? forecast.next_day_estimate
      : 12;

  const days: ForecastDay[] = [];
  for (let day = 1; day <= 5; day++) {
    const cases = Math.max(0, Math.round(next * (1 + (day - 1) * 0.04)));
    let pm25Day: number;
    if (typeof pm25Baseline === "number" && !Number.isNaN(pm25Baseline)) {
      pm25Day = Math.min(
        280,
        Math.round(pm25Baseline * (1 + (day - 1) * 0.035) + (day - 1) * 2),
      );
    } else {
      pm25Day = Math.min(280, Math.round(cases * 12 + day * 3));
    }
    days.push({ day, pm25: pm25Day, cases });
  }
  return days;
}
