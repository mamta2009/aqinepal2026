"use client";

import { useMemo } from "react";
import { Card, CardKicker } from "@/components/ui/card";
import { DefinitionHelp } from "@/components/ui/definition-help";
import {
  buildFiveDayForecast,
  type WeekForecastTrend,
} from "@/lib/forecast-days";

export function FiveDayForecast({
  city,
  pm25,
  weekTrend,
}: {
  city: string;
  pm25?: number | null;
  weekTrend?: WeekForecastTrend | null;
}) {
  const days = useMemo(() => {
    const trend = weekTrend
      ? {
        ...weekTrend,
        next_day_estimate:
          weekTrend.next_day_estimate ?? weekTrend.predicted_next_day,
      }
      : undefined;
    return buildFiveDayForecast(trend, pm25);
  }, [pm25, weekTrend]);
  const modelLabel = weekTrend?.model ? ` · ${weekTrend.model}` : "";

  return (
    <Card className="h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardKicker>AI powered</CardKicker>
          <h2 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            5-day forecast
            <DefinitionHelp label="5-day forecast">
              Day cards show illustrative PM2.5 and respiratory case estimates
              for the next five days, grown gently from the week-trend model and
              today&apos;s live PM2.5 when available. For discussion and demo only
              — not a validated clinical or official forecast.
            </DefinitionHelp>
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Predicted respiratory cases based on air quality and the weekly case
            trend for {city}.
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
              {day.pm25}
            </p>
            <p className="text-xs text-muted">µg/m³ PM2.5</p>
            <p className="mt-2 text-sm font-extrabold text-forest">
              {day.cases} cases
            </p>
          </article>
        ))}
      </div>
    </Card>
  );
}
