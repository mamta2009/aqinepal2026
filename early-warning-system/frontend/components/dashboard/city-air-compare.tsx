"use client";

import dynamic from "next/dynamic";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardKicker } from "@/components/ui/card";
import { DefinitionHelp } from "@/components/ui/definition-help";
import { browserApi } from "@/lib/api/browser";
import {
  compareRowPm25,
  compareSourceLabel,
  DEFAULT_PM25_THRESHOLD_UGM3,
  fetchAirCompareSequential,
  formatCompareAirIndexCell,
  formatCompareThreshold,
  type CompareCityRow,
} from "@/lib/compare-cities";
import { cn } from "@/lib/utils/cn";

const ComparePm25Chart = dynamic(() => import("@/components/charts/compare-pm25-chart"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-surface" />,
});

type CityAirCompareProps = {
  cities: string[];
  currentCity: string;
};

export function CityAirCompare({ cities, currentCity }: CityAirCompareProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [rows, setRows] = useState<CompareCityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [threshold, setThreshold] = useState(DEFAULT_PM25_THRESHOLD_UGM3);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await browserApi<{
          dashboard?: { pm25_alert_threshold_ugm3?: number };
        }>("api/runtime-config");
        const value = Number(config.dashboard?.pm25_alert_threshold_ugm3);
        if (!cancelled && Number.isFinite(value) && value > 0) {
          setThreshold(value);
        }
      } catch {
        // Keep default threshold when runtime config is unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelected((prev) => {
      const allowed = new Set(cities);
      const next = prev.filter((city) => allowed.has(city));
      if (next.length) return next;
      return cities.includes(currentCity) ? [currentCity] : cities.slice(0, 1);
    });
  }, [cities, currentCity]);

  const chartRows = useMemo(
    () => rows.filter((row) => row.ok && compareRowPm25(row) != null),
    [rows],
  );

  async function runCompare(cityList: string[], signal?: AbortSignal) {
    if (!cityList.length) {
      setRows([]);
      setProgress("");
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(`Fetching 0 / ${cityList.length}…`);
    try {
      const settled = await fetchAirCompareSequential(cityList, {
        signal,
        onProgress: (done, total) => {
          if (!signal?.aborted) setProgress(`Fetching ${done} / ${total}…`);
        },
      });
      if (signal?.aborted) return;
      setRows(settled);
      setProgress(
        `Updated ${settled.length} city snapshot${settled.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Comparison failed.");
      setProgress("");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  const selectedKey = selected.join("|");

  useEffect(() => {
    const controller = new AbortController();
    void runCompare(selected, controller.signal);
    return () => controller.abort();
    // selectedKey captures the selected cities list for the sequential fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  function toggleCity(city: string) {
    setSelected((prev) =>
      prev.includes(city)
        ? prev.filter((item) => item !== city)
        : [...prev, city].sort((a, b) => a.localeCompare(b)),
    );
  }

  function selectAll() {
    setSelected([...cities].sort((a, b) => a.localeCompare(b)));
  }

  function clearAll() {
    setSelected([]);
    setRows([]);
    setProgress("");
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <CardKicker>Live air check</CardKicker>
          <h2 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            Compare cities · live PM2.5
            <DefinitionHelp label="City air comparison chart">
              Pick cities to compare their live PM2.5 (tiny pollution particles)
              side by side. The dashed line is an alert guide line at about{" "}
              {threshold} µg/m³.
              <span className="mt-2 block text-xs">
                Read the numbers in the table too — do not rely on colour alone.
              </span>
            </DefinitionHelp>
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Select cities to fetch live PM2.5 side by side. Requests run one at a
            time to limit upstream rate pressure. Threshold band uses{" "}
            {threshold} µg/m³ (operator runtime setting when available).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" type="button" onClick={selectAll}>
            Select all
          </Button>
          <Button size="sm" variant="secondary" type="button" onClick={clearAll}>
            Clear
          </Button>
          <Button
            size="sm"
            variant="secondary"
            type="button"
            disabled={loading || selected.length === 0}
            onClick={() => void runCompare(selected)}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
            Refresh
          </Button>
        </div>
      </div>

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Cities to include in comparison"
      >
        {cities.map((city) => {
          const checked = selected.includes(city);
          return (
            <label
              key={city}
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold transition-colors",
                checked
                  ? "border-forest bg-forest text-white"
                  : "border-border-strong bg-white text-ink hover:border-forest",
                city === currentCity && !checked && "ring-2 ring-sky/40",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => toggleCity(city)}
              />
              {city}
            </label>
          );
        })}
      </div>

      <p className="mt-3 flex min-h-6 items-center gap-2 text-sm text-muted" role="status">
        {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
        {error ||
          progress ||
          (selected.length
            ? "Ready to compare selected cities."
            : "Select one or more cities above to compare air readings.")}
      </p>

      {chartRows.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-surface/60 p-4">
          <p className="mb-3 text-xs font-extrabold tracking-wide text-ink-muted uppercase">
            PM2.5 bars with dashed threshold · current dashboard city highlighted when selected
          </p>
          <ComparePm25Chart
            labels={chartRows.map((row) => row.city)}
            values={chartRows.map((row) => compareRowPm25(row))}
            threshold={threshold}
            currentCity={currentCity}
          />
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-3 py-2.5 font-extrabold">City</th>
              <th className="px-3 py-2.5 font-extrabold">PM2.5</th>
              <th className="px-3 py-2.5 font-extrabold">Air index</th>
              <th className="px-3 py-2.5 font-extrabold">Source / confidence</th>
              <th className="px-3 py-2.5 font-extrabold">vs threshold</th>
            </tr>
          </thead>
          <tbody>
            {!selected.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  Select one or more cities above to compare.
                </td>
              </tr>
            ) : loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  Fetching city snapshots…
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const pm25 = compareRowPm25(row);
                const isCurrent = row.city === currentCity;
                return (
                  <tr
                    key={row.city}
                    className={cn(
                      "border-b border-border last:border-0",
                      isCurrent && "bg-surface-tint font-extrabold",
                      !row.ok && "bg-red-50 text-alert-red",
                    )}
                  >
                    <td className="px-3 py-2.5">{row.city}</td>
                    <td className="px-3 py-2.5 font-mono">
                      {pm25 != null ? `${pm25} µg/m³` : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.ok
                        ? formatCompareAirIndexCell(row.source, row.aq)
                        : row.error || `HTTP ${row.http ?? "error"}`}
                    </td>
                    <td className="px-3 py-2.5">{compareSourceLabel(row)}</td>
                    <td className="px-3 py-2.5">
                      {row.ok ? formatCompareThreshold(pm25, threshold) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
