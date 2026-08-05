"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { Card, CardKicker } from "@/components/ui/card";
import { DefinitionHelp } from "@/components/ui/definition-help";
import { generate24hFromReading } from "@/lib/chart-series";

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
  source,
}: {
  city: string;
  pm25?: number | null;
  source?: string;
}) {
  const values = useMemo(
    () => generate24hFromReading(pm25, city),
    [city, pm25],
  );
  const labels = useMemo(
    () => Array.from({ length: 24 }, (_, hour) => `${hour}:00`),
    [],
  );
  const sourceLabel = source || "latest air reading";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardKicker>Air quality</CardKicker>
          <h2 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            Air quality — 24h — {city}
            <DefinitionHelp label="Air quality 24h chart">
              Uses the latest live PM2.5 for {city}, then draws 24 hourly-looking
              points as deterministic variation around that reading (± about 38%),
              seeded by city and calendar day. The current reading is
              place-based; the hourly shape is illustrative — not observed
              hourly station history.
            </DefinitionHelp>
          </h2>
          <p className="mt-1 text-sm text-muted">
            Illustrative intra-day shape around the current live PM2.5 for {city}.
          </p>
        </div>
      </div>

      {values.length > 0 ? (
        <div className="mt-4">
          <AirQuality24hChart labels={labels} values={values} />
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-surface p-4 text-muted">
          No PM2.5 reading yet for {city}.
        </p>
      )}

      <p className="mt-3 text-xs text-muted">
        Deterministic intra-day variation around the latest {sourceLabel} —
        not observed hourly AQ.
      </p>
    </Card>
  );
}
