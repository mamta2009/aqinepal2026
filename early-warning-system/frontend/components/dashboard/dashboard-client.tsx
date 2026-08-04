"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleHelp,
  Download,
  HeartHandshake,
  RefreshCw,
  Stethoscope,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ScenarioSandbox } from "./scenario-sandbox";
import { WeatherContext } from "@/components/weather/weather-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardKicker } from "@/components/ui/card";
import { useDashboard } from "@/hooks/use-dashboard";
import { cityNames, type DashboardData } from "@/lib/api/dashboard";
import {
  getClimateGuidance,
  type AirQualityBand,
} from "@/lib/climate-guidance";

const DashboardTrendChart = dynamic(
  () => import("@/components/charts/dashboard-trend-chart"),
  {
    ssr: false,
    loading: () => <div className="h-72 animate-pulse rounded-xl bg-surface" />,
  },
);

const BAND_STYLE: Record<AirQualityBand, string> = {
  good: "border-aq-good/30 bg-green-50 text-aq-good",
  moderate: "border-aq-moderate/30 bg-yellow-50 text-aq-moderate",
  sensitive: "border-aq-sensitive/30 bg-orange-50 text-aq-sensitive",
  unhealthy: "border-aq-unhealthy/30 bg-red-50 text-aq-unhealthy",
  "no-data": "border-border-strong bg-surface text-ink",
};

function numberFrom(
  value: Record<string, unknown> | undefined,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const current = value?.[key];
    if (typeof current === "number" && Number.isFinite(current)) return current;
  }
  return null;
}

function heatValue(data: DashboardData | undefined): number | null {
  const direct = data?.heat?.heat_temperature_display;
  if (typeof direct === "number") return direct;
  return numberFrom(
    data?.heat?.heat,
    "effective_temp_c",
    "feelslike_c",
    "temp_c",
    "temperature_c",
  );
}

function provenanceText(value?: Record<string, unknown>): string {
  const confidence = value?.confidence;
  if (confidence && typeof confidence === "object") {
    const tier = (confidence as Record<string, unknown>).tier;
    if (typeof tier === "string") return `Confidence: ${tier}`;
  }
  const role = value?.deployment_role;
  return typeof role === "string" ? role.replaceAll("_", " ") : "Provenance details unavailable";
}

function DefinitionHelp({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span className="relative inline-flex" ref={rootRef}>
      <button
        type="button"
        className="inline-grid size-6 place-items-center rounded-full border border-current/25 bg-white/90 text-current transition hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest/25"
        aria-label={`What does ${label} mean?`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <CircleHelp aria-hidden size={14} />
      </button>
      {open ? (
        <span
          id={panelId}
          role="dialog"
          aria-label={`${label} definition`}
          className="absolute top-full left-0 z-40 mt-2 w-64 rounded-xl border border-border bg-white p-3 text-left text-sm leading-relaxed text-ink shadow-lg sm:w-72"
        >
          <span className="block font-extrabold text-ink">{label}</span>
          <span className="mt-1.5 block text-muted">{children}</span>
        </span>
      ) : null}
    </span>
  );
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportCsv(data: DashboardData) {
  const rows = [["date", "city", "cases", "data_type"]];
  const days = data.cases?.data;
  if (days?.length) {
    for (const day of days) {
      rows.push([day.date, data.city, String(day.cases), "synthetic_cases"]);
    }
  } else {
    (data.cases?.days ?? []).forEach((cases, index) =>
      rows.push([`day-${index + 1}`, data.city, String(cases), "synthetic_cases"]),
    );
  }
  download(
    `${data.city.toLowerCase()}-climate-dashboard.csv`,
    rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n"),
    "text/csv;charset=utf-8",
  );
}

export function DashboardClient() {
  const [city, setCity] = useState("Kathmandu");
  const query = useDashboard(city);
  const data = query.data;
  const pm25 = numberFrom(data?.air?.air_quality, "pm25_ug_m3", "pm25", "pm2_5");
  const aqi = numberFrom(data?.air?.air_quality, "aqi", "us_epa_aqi", "us_epa_index");
  const effectiveHeat = heatValue(data);
  const guidance = useMemo(
    () => getClimateGuidance({ aqi, pm25, effectiveTemperatureC: effectiveHeat }),
    [aqi, effectiveHeat, pm25],
  );
  const caseDays = data?.cases?.days ?? [];
  const dates =
    data?.cases?.data?.map((day) =>
      new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(day.date)),
    ) ?? caseDays.map((_, index) => `Day ${index + 1}`);
  const forecastMap = data?.forecast?.surge_forecast?.predicted_cases_by_horizon_day;
  const forecastValues = forecastMap
    ? Object.values(forecastMap).filter(
      (value): value is number | null => value === null || typeof value === "number",
    )
    : [];

  if (query.isPending) {
    return (
      <div className="page-shell py-10" role="status">
        <div className="h-64 animate-pulse rounded-3xl bg-sky-soft" />
        <p className="mt-3 font-bold">Loading today&apos;s decision guidance…</p>
      </div>
    );
  }

  if (query.isError || !data) {
    return (
      <div className="page-shell py-12">
        <Card className="mx-auto max-w-2xl text-center">
          <AlertTriangle className="mx-auto text-alert-red" aria-hidden />
          <h1 className="mt-3 text-2xl font-bold">Dashboard data is unavailable</h1>
          <p className="mt-2 text-muted">
            We cannot provide a reliable outdoor recommendation. Try again or use
            official local advice.
          </p>
          <Button className="mt-5" onClick={() => query.refetch()}>
            <RefreshCw size={18} /> Try again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-shell py-6 sm:py-10">
      <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Today&apos;s health decision</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Can we go outside?</h1>
          <p className="mt-2 text-muted">
            Clear public guidance for air quality and heat — separate from operator alert rules.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto]">
          <label className="text-sm font-extrabold">
            City
            <select className="form-control mt-1" value={city} onChange={(event) => setCity(event.target.value)}>
              {cityNames(data.cities).map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <Button
            className="self-end"
            variant="secondary"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={query.isFetching ? "animate-spin" : ""} size={17} />
            Refresh
          </Button>
        </div>
      </header>

      {data.failures.length > 0 && (
        <div className="mt-5 rounded-xl border border-aq-moderate/40 bg-yellow-50 p-4 text-sm" role="status">
          <strong>Some information is unavailable:</strong> {data.failures.join(", ")}.
          Guidance only uses the readings shown below.
        </div>
      )}

      <section className={`mt-6 rounded-3xl border-2 p-5 sm:p-8 ${BAND_STYLE[guidance.airBand]}`} aria-labelledby="today-answer">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="bg-white/80 text-current">{guidance.label}</Badge>
          <span className="text-sm font-extrabold">For {city}</span>
        </div>
        <h2 id="today-answer" className="mt-4 max-w-4xl text-3xl font-extrabold leading-tight sm:text-5xl">
          {guidance.outdoorAnswer}
        </h2>
        <p className="mt-4 max-w-3xl text-base font-bold sm:text-lg">{guidance.summary}</p>
        <dl className="mt-6 flex flex-wrap gap-3">
          <div className="rounded-xl border border-current/20 bg-white/75 px-4 py-3">
            <dt className="flex items-center gap-1.5 text-xs font-extrabold uppercase">
              AQI
              <DefinitionHelp label="AQI">
                A health communication index. Higher values mean greater
                pollution-related health concern.
                <span className="mt-2 block text-xs">
                  Source: {data.air?.source || "Unavailable"} ·{" "}
                  {provenanceText(data.air?.provenance)}
                </span>
              </DefinitionHelp>
            </dt>
            <dd className="text-2xl font-extrabold">{aqi ?? "—"}</dd>
          </div>
          <div className="rounded-xl border border-current/20 bg-white/75 px-4 py-3">
            <dt className="flex items-center gap-1.5 text-xs font-extrabold uppercase">
              PM2.5
              <DefinitionHelp label="PM2.5">
                Fine particles 2.5 micrometres or smaller, reported in
                micrograms per cubic metre (µg/m³).
                <span className="mt-2 block text-xs">
                  Source: {data.air?.source || "Unavailable"} ·{" "}
                  {provenanceText(data.air?.provenance)}
                </span>
              </DefinitionHelp>
            </dt>
            <dd className="text-2xl font-extrabold">
              {pm25 ?? "—"} <span className="text-sm">µg/m³</span>
            </dd>
          </div>
          <div className="rounded-xl border border-current/20 bg-white/75 px-4 py-3">
            <dt className="flex items-center gap-1.5 text-xs font-extrabold uppercase">
              Effective heat
              <DefinitionHelp label="Effective heat">
                The greater of ambient and feels-like temperature when supplied
                by the data source.
                <span className="mt-2 block text-xs">
                  Source: {data.heat?.source || "Unavailable"} ·{" "}
                  {provenanceText(data.heat?.provenance)}
                </span>
              </DefinitionHelp>
            </dt>
            <dd className="text-2xl font-extrabold">{effectiveHeat ?? "—"}°C</dd>
          </div>
        </dl>
      </section>

      <section className="mt-8" aria-labelledby="recommendations-title">
        <h2 id="recommendations-title" className="text-2xl font-bold">Five things to do today</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {guidance.recommendations.map((item, index) => (
            <Card className="p-4" key={item.title}>
              <span className="grid size-8 place-items-center rounded-full bg-forest text-sm font-extrabold text-white">
                {index + 1}
              </span>
              <h3 className="mt-3 font-bold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted">{item.action}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3" aria-labelledby="people-title">
        <h2 id="people-title" className="sr-only">
          Advice for facilities, families, and health settings
        </h2>
        {[
          [Building2, "Facilities & sites", guidance.audienceAdvice.school],
          [HeartHandshake, "Families", guidance.audienceAdvice.parent],
          [Stethoscope, "Health settings", guidance.audienceAdvice.student],
        ].map(([Icon, title, advice]) => {
          const AdviceIcon = Icon as typeof Building2;
          return (
            <Card key={title as string}>
              <AdviceIcon className="text-forest" aria-hidden />
              <h3 className="mt-3 text-xl font-bold">{title as string}</h3>
              <p className="mt-2 text-sm text-muted">{advice as string}</p>
            </Card>
          );
        })}
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <WeatherContext weather={data.weather?.weather} source={data.weather?.source} />
        <Card>
          <CardKicker>Latest public broadcast</CardKicker>
          {data.latestAlert?.source === "alert_broadcasts" ? (
            <>
              <h2 className="text-xl font-bold">
                {data.latestAlert.hazard_type || "Environmental"} alert · {data.latestAlert.level || "level not reported"}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {data.latestAlert.city || city} · {data.latestAlert.timestamp
                  ? new Date(data.latestAlert.timestamp).toLocaleString()
                  : "Time unavailable"}
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="text-forest" aria-hidden />
              <h2 className="mt-2 text-xl font-bold">No stored broadcast to show</h2>
              <p className="mt-2 text-sm text-muted">
                {data.latestAlert?.message || "The latest-alert service returned no broadcast."}
              </p>
            </>
          )}
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted">{guidance.operatorAlertNote}</p>
        </Card>
      </div>

      <section className="mt-8 grid gap-5 lg:grid-cols-2" aria-labelledby="trends-title">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardKicker>Trend and cases</CardKicker>
              <h2 id="trends-title" className="text-2xl font-bold">Respiratory cases this week</h2>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span>{data.cases?.note || "Case-series context is unavailable."}</span>
                <DefinitionHelp label="Case data">
                  Source: {data.cases?.source || "Unavailable"} — labelled
                  synthetic until a live health feed is connected.
                </DefinitionHelp>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => exportCsv(data)}>
                <Download size={16} /> CSV
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  download(
                    `${city.toLowerCase()}-climate-dashboard.json`,
                    JSON.stringify(data, null, 2),
                    "application/json",
                  )
                }
              >
                <Download size={16} /> JSON
              </Button>
            </div>
          </div>
          {caseDays.length > 0 ? (
            <>
              <DashboardTrendChart labels={dates} cases={caseDays} forecast={forecastValues} />
              <p className="mt-3 text-sm text-muted">
                Text summary: {caseDays.reduce((sum, value) => sum + value, 0)} synthetic
                cases over seven days. The latest day has {caseDays.at(-1)} cases,
                compared with {caseDays[0]} on the first day shown.
              </p>
            </>
          ) : (
            <p className="mt-5 rounded-xl bg-surface p-4 text-muted">No case series is available to chart.</p>
          )}
        </Card>

        <Card>
          <CardKicker>Illustrative forecast</CardKicker>
          <h2 className="text-xl font-bold">Possible 3–5 day pressure</h2>
          <p className="mt-3 text-3xl font-extrabold">
            {data.forecast?.surge_forecast?.risk_score_0_100 ?? "—"}
            <span className="text-base text-muted"> / 100 risk score</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            {data.forecast?.surge_forecast?.disclaimer ||
              "No forecast explanation is available. Do not use this as a clinical prediction."}
          </p>
          <Badge className="mt-4">Synthetic input</Badge>
        </Card>

        <Card>
          <CardKicker>City comparison</CardKicker>
          <h2 className="text-xl font-bold">Weekly synthetic cases</h2>
          {data.allCases?.cities ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-border"><th className="py-2">City</th><th className="py-2 text-right">Cases</th></tr></thead>
                <tbody>
                  {Object.entries(data.allCases.cities)
                    .sort(([, a], [, b]) => (b.total ?? 0) - (a.total ?? 0))
                    .map(([name, value]) => (
                      <tr className={name === city ? "bg-surface-tint font-extrabold" : "border-b border-border"} key={name}>
                        <td className="px-2 py-2">{name}</td><td className="px-2 py-2 text-right">{value.total ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-3 text-muted">Comparison data are unavailable.</p>}
        </Card>

        <ScenarioSandbox key={city} city={city} livePm25={pm25} liveHeat={effectiveHeat} caseDays={caseDays} />
      </section>

      <p className="mt-5 text-center text-xs text-muted" role="status">
        Last refreshed {new Date(data.refreshedAt).toLocaleString()}. Automatically checks every 30 minutes.
      </p>
    </div>
  );
}
