"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardKicker } from "@/components/ui/card";
import { DefinitionHelp } from "@/components/ui/definition-help";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function airFactor(pm25: number) {
  return 1 + 0.5 * (clamp((Math.max(5, pm25) - 12) / 125, 0, 1) * 1.4);
}

function heatFactor(temperature: number) {
  return 1 + 0.55 * (clamp((temperature - 26) / 14, 0, 1) * 1.25);
}

export function ScenarioSandbox({
  city,
  livePm25,
  liveHeat,
  caseDays,
}: {
  city: string;
  livePm25?: number | null;
  liveHeat?: number | null;
  caseDays: number[];
}) {
  const liveValues = useMemo(
    () => ({
      pm25: clamp(Math.round(livePm25 ?? 72), 5, 320),
      heat: Math.round(clamp(liveHeat ?? 30, 22, 46) * 2) / 2,
    }),
    [liveHeat, livePm25],
  );
  const [pm25Override, setPm25Override] = useState<number | null>(null);
  const [heatOverride, setHeatOverride] = useState<number | null>(null);
  const pm25 = pm25Override ?? liveValues.pm25;
  const heat = heatOverride ?? liveValues.heat;
  const changed = pm25Override !== null || heatOverride !== null;

  const result = useMemo(() => {
    const average =
      caseDays.length > 0
        ? caseDays.reduce((sum, value) => sum + value, 0) / caseDays.length
        : null;
    const air = airFactor(pm25);
    const heatMultiplier = heatFactor(heat);
    const combined = air * heatMultiplier;
    return {
      average,
      air,
      heatMultiplier,
      combined,
      load: Math.min(
        100,
        Math.round(
          52 * clamp((pm25 - 12) / 125, 0, 1) +
          48 * clamp((heat - 26) / 14, 0, 1),
        ),
      ),
      daily: average === null ? null : Math.max(0, Math.round(average * combined)),
    };
  }, [caseDays, heat, pm25]);

  function reset() {
    setPm25Override(null);
    setHeatOverride(null);
  }

  return (
    <Card className="h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardKicker>Explore, do not predict</CardKicker>
          <h2 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            Stress scenario sandbox
            <DefinitionHelp label="Stress scenario sandbox">
              Try &quot;what if&quot; changes for {city}: move the PM2.5 and heat
              sliders to see how the demo case numbers might change.
              <span className="mt-2 block text-xs">
                For learning and discussion only — not a real prediction.
              </span>
            </DefinitionHelp>
          </h2>
        </div>
        <Button variant="secondary" size="sm" onClick={reset} disabled={!changed}>
          Use current readings
        </Button>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Change pollution and heat to discuss possible pressure on services in {city}.
        This applies simple multipliers to synthetic case data; it is not a validated
        clinical forecast.
      </p>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <label className="font-bold">
          <span className="flex justify-between gap-3">
            PM2.5 burden <output>{pm25} µg/m³</output>
          </span>
          <input
            className="mt-3 w-full accent-forest"
            type="range"
            min="5"
            max="320"
            value={pm25}
            onChange={(event) => {
              setPm25Override(Number(event.target.value));
            }}
          />
        </label>
        <label className="font-bold">
          <span className="flex justify-between gap-3">
            Effective heat <output>{heat}°C</output>
          </span>
          <input
            className="mt-3 w-full accent-forest"
            type="range"
            min="22"
            max="46"
            step="0.5"
            value={heat}
            onChange={(event) => {
              setHeatOverride(Number(event.target.value));
            }}
          />
        </label>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
        {[
          ["Synthetic baseline", result.average === null ? "—" : `${Math.round(result.average)}/day`],
          ["Illustrative load", `${result.load}/100`],
          ["Combined multiplier", `${result.combined.toFixed(2)}×`],
          [
            "Rough scenario",
            result.daily === null ? "Cases unavailable" : `${result.daily}/day · ${result.daily * 7}/week`,
          ],
        ].map(([label, value]) => (
          <div className="rounded-xl border border-border bg-surface p-4" key={label}>
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 font-heading text-lg font-bold">{value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
