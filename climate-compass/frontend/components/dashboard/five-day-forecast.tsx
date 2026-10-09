"use client";

import { useMemo } from "react";
import { Card, CardKicker } from "@/components/ui/card";
import { DefinitionHelp } from "@/components/ui/definition-help";
import {
  buildFiveDayForecast,
  resolveForecastBaseline,
  type WeekForecastTrend,
} from "@/lib/forecast-days";

export function FiveDayForecast({
  city,
  pm25,
  aqi,
  weekTrend,
}: {
  city: string;
  pm25?: number | null;
  aqi?: number | null;
  weekTrend?: WeekForecastTrend | null;
}) {
  const baseline = useMemo(
    () => resolveForecastBaseline({ pm25, aqi }),
    [aqi, pm25],
  );
  const days = useMemo(() => {
    const trend = weekTrend
      ? {
        ...weekTrend,
        next_day_estimate:
          weekTrend.next_day_estimate ?? weekTrend.predicted_next_day,
      }
      : undefined;
    return buildFiveDayForecast(trend, baseline?.value);
  }, [baseline?.value, weekTrend]);
  const modelLabel = weekTrend?.model ? ` · ${weekTrend.model}` : "";
  const unitLabel = baseline?.metric === "aqi" ? "AQI" : "µg/m³ PM2.5";
  const readingWord =
    baseline?.metric === "aqi" ? "station air score" : "air quality";

  return (
    <Card className="h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardKicker>AI powered</CardKicker>
          <h2 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            5-day forecast
            <DefinitionHelp label="5-day forecast">
              Cards for the next five days with example {unitLabel} and
              breathing-related case guesses for {city}, starting from
              today&apos;s reading when we have one.
              <span className="mt-2 block text-xs">
                Demo / discussion only — not an official forecast.
              </span>
            </DefinitionHelp>
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Predicted respiratory cases based on {readingWord} and the weekly
            case trend for {city}.
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        {city}
        {modelLabel}
        {typeof weekTrend?.next_day_estimate === "number"
          ? ` · next-day case estimate ${weekTrend.next_day_estimate}`
          : ""}
      </p>

      <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {days.map((day) => (
          <article
            key={day.day}
            className="rounded-2xl border border-sky/35 bg-sky-soft/60 px-3 py-3 text-center sm:px-4 sm:py-4"
          >
            <p className="text-[11px] font-extrabold tracking-wide text-muted uppercase">
              Day {day.day}
            </p>
            <p className="mt-2 font-heading text-2xl font-extrabold text-ink sm:text-3xl">
              {day.value}
            </p>
            <p className="text-xs text-muted">{unitLabel}</p>
            <p className="mt-2 text-sm font-extrabold text-forest">
              {day.cases} cases
            </p>
          </article>
        ))}
      </div>
    </Card>
  );
}
