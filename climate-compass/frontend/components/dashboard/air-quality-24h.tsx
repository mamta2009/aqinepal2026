"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { Card, CardKicker } from "@/components/ui/card";
import { DefinitionHelp } from "@/components/ui/definition-help";
import {
  generate24hFromReading,
  resolveAirChartBaseline,
} from "@/lib/chart-series";

const AirQuality24hChart = dynamic(
  () => import("@/components/charts/air-quality-24h-chart"),
  {
    ssr: false,
    loading: () => <div className="h-72 animate-pulse rounded-xl bg-surface" />,
  },
);

export function AirQuality24h({
  city,
  pm25,
  aqi,
  source,
}: {
  city: string;
  pm25?: number | null;
  aqi?: number | null;
  source?: string;
}) {
  const baseline = useMemo(
    () => resolveAirChartBaseline({ pm25, aqi }),
    [aqi, pm25],
  );
  const values = useMemo(
    () => generate24hFromReading(baseline?.value, city),
    [baseline?.value, city],
  );
  const labels = useMemo(
    () => Array.from({ length: 24 }, (_, hour) => `${hour}:00`),
    [],
  );
  const sourceLabel = source || "latest air reading";
  const metric = baseline?.metric ?? "pm25";
  const readingWord =
    metric === "aqi" ? "station air score (AQI)" : "live PM2.5";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardKicker>Air quality</CardKicker>
          <h2 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            Air quality — 24h — {city}
            <DefinitionHelp label="Air quality 24h chart">
              Starts from today&apos;s live reading for {city} (PM2.5 when
              available, otherwise station AQI), then draws a day-long wavy line
              so you can picture how levels might vary hour to hour.
              <span className="mt-2 block text-xs">
                The shape is an illustration — not a real hour-by-hour history.
              </span>
            </DefinitionHelp>
          </h2>
          <p className="mt-1 text-sm text-muted">
            {values.length > 0
              ? `Illustrative intra-day shape around the current ${readingWord} for ${city}.`
              : `Waiting for a live air reading for ${city}.`}
          </p>
        </div>
      </div>

      {values.length > 0 && baseline ? (
        <div className="mt-4">
          <AirQuality24hChart
            labels={labels}
            values={values}
            metric={baseline.metric}
          />
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-surface p-4 text-muted">
          No live air reading yet for {city}.
        </p>
      )}

      <p className="mt-3 text-xs text-muted">
        {values.length > 0
          ? `Deterministic intra-day variation around the latest ${sourceLabel} — not observed hourly AQ.`
          : `Source: ${sourceLabel}.`}
      </p>
    </Card>
  );
}
