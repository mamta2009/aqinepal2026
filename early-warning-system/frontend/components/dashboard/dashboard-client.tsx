"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  HeartHandshake,
  RefreshCw,
  Stethoscope,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { ScenarioSandbox } from "./scenario-sandbox";
import { CityAirCompare } from "./city-air-compare";
import { FiveDayForecast } from "./five-day-forecast";
import { AirQuality24h } from "./air-quality-24h";
import { RainStatusIcon } from "./rain-status-icon";
import { WeatherContext } from "@/components/weather/weather-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardKicker } from "@/components/ui/card";
import { DefinitionHelp } from "@/components/ui/definition-help";
import { Reveal } from "@/components/ui/reveal";
import { useDashboard } from "@/hooks/use-dashboard";
import { useSelectedCity } from "@/hooks/use-selected-city";
import { cityNames, type DashboardData } from "@/lib/api/dashboard";
import {
  getClimateGuidance,
  type AirQualityBand,
} from "@/lib/climate-guidance";
import { DEFAULT_SELECTED_CITY } from "@/lib/store/location-slice";
import {
  briefAirMeasurement,
  explainAirMeasurement,
} from "@/lib/pm25-aqi";
import { extractRainIndicator } from "@/lib/weather-rain";

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
  const { selectedCity: city, setSelectedCity } = useSelectedCity();
  const [cityOptions, setCityOptions] = useState<string[]>([DEFAULT_SELECTED_CITY]);
  const query = useDashboard(city);
  const data = query.data;
  const refreshingContent =
    Boolean(data) && query.isFetching && query.isPlaceholderData;
  const initialLoad = query.isPending && !data;

  useEffect(() => {
    if (!data?.cities) return;
    const names = cityNames(data.cities);
    if (names.length) setCityOptions(names);
  }, [data?.cities]);

  const pm25 = numberFrom(data?.air?.air_quality, "pm25_ug_m3", "pm25", "pm2_5");
  // Continuous 0–500-style score only — never WeatherAPI us_epa_index (1–6).
  const aqiScore = numberFrom(data?.air?.air_quality, "aqi");
  const usEpaIndex = numberFrom(data?.air?.air_quality, "us_epa_index");
  const effectiveHeat = heatValue(data);
  const rain = useMemo(
    () => extractRainIndicator(data?.weather?.weather ?? null),
    [data?.weather?.weather],
  );
  const guidance = useMemo(
    () =>
      getClimateGuidance({
        aqi: aqiScore,
        pm25,
        usEpaIndex,
        effectiveTemperatureC: effectiveHeat,
      }),
    [aqiScore, effectiveHeat, pm25, usEpaIndex],
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
  const airMeasurementBrief = useMemo(
    () => briefAirMeasurement({ pm25, aqiScore }),
    [aqiScore, pm25],
  );
  const airMeasurementHelp = useMemo(
    () => explainAirMeasurement({ pm25, aqiScore }),
    [aqiScore, pm25],
  );

  return (
    <div className="page-shell py-6 sm:py-10">
      <Reveal>
        <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Today&apos;s health decision</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Can we go outside?</h1>
            <p className="mt-2 text-muted">
              Clear public guidance for air, heat, and rain — separate from
              operator alert rules.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto]">
            <label className="text-sm font-extrabold">
              City
              <select
                className="form-control mt-1"
                value={city}
                onChange={(event) => setSelectedCity(event.target.value)}
                disabled={initialLoad}
              >
                {(cityOptions.includes(city) ? cityOptions : [city, ...cityOptions]).map(
                  (name) => (
                    <option key={name}>{name}</option>
                  ),
                )}
              </select>
            </label>
            <Button
              className="self-end"
              variant="secondary"
              onClick={() => query.refetch()}
              disabled={!data || query.isFetching}
            >
              <RefreshCw className={query.isFetching ? "animate-spin" : ""} size={17} />
              Refresh
            </Button>
          </div>
        </header>
      </Reveal>

      {initialLoad ? (
        <div className="mt-6" role="status" aria-live="polite">
          <div className="h-64 animate-pulse rounded-3xl bg-sky-soft" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-2xl bg-sky-soft" />
            ))}
          </div>
          <p className="mt-3 font-bold">Loading today&apos;s decision guidance…</p>
        </div>
      ) : null}

      {query.isError && !data ? (
        <Reveal className="mt-6">
          <Card className="mx-auto max-w-2xl text-center">
            <AlertTriangle className="mx-auto text-alert-red" aria-hidden />
            <h2 className="mt-3 text-2xl font-bold">Dashboard data is unavailable</h2>
            <p className="mt-2 text-muted">
              We cannot provide a reliable outdoor recommendation. Try again or use
              official local advice.
            </p>
            <Button className="mt-5" onClick={() => query.refetch()}>
              <RefreshCw size={18} /> Try again
            </Button>
          </Card>
        </Reveal>
      ) : null}

      {data ? (
        <div key={city} className="relative mt-0" aria-busy={refreshingContent}>
          {refreshingContent ? (
            <div
              className="absolute inset-0 z-20 flex items-start justify-center rounded-3xl bg-white/55 pt-24 backdrop-blur-[1px]"
              role="status"
              aria-live="polite"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-extrabold text-ink shadow-sm">
                <RefreshCw className="animate-spin text-forest" size={16} aria-hidden />
                Updating {city}…
              </div>
            </div>
          ) : null}
          <div
            className={
              refreshingContent
                ? "pointer-events-none opacity-55 transition-opacity"
                : "transition-opacity"
            }
          >

            {data.failures.length > 0 && (
              <Reveal>
                <div className="mt-5 rounded-xl border border-aq-moderate/40 bg-yellow-50 p-4 text-sm" role="status">
                  <strong>Some information is unavailable:</strong> {data.failures.join(", ")}.
                  Guidance only uses the readings shown below.
                </div>
              </Reveal>
            )}

            <Reveal>
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
                  <div className="min-w-[9rem] rounded-xl border border-current/20 bg-white/75 px-4 py-3">
                    <dt className="flex w-full items-center justify-between gap-2 text-xs font-extrabold uppercase">
                      Air quality
                      <DefinitionHelp label="Air quality" align="end">
                        The big word here is a simple level for how clean or
                        dirty the air is: Good, Moderate, Use extra care, or
                        Unhealthy.
                        <span className="mt-2 block text-xs">
                          The small line may show PM2.5 (tiny pollution particles
                          in the air) and ~AQI (a common air score from about 0 to
                          500). Higher PM2.5 or AQI usually means dirtier air.
                        </span>
                        {airMeasurementHelp ? (
                          <span className="mt-2 block text-xs">
                            {airMeasurementHelp}
                          </span>
                        ) : null}
                        <span className="mt-2 block text-xs">
                          Source: {data.air?.source || "Unavailable"} ·{" "}
                          {provenanceText(data.air?.provenance)}
                        </span>
                      </DefinitionHelp>
                    </dt>
                    <dd className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                      {guidance.airBand === "no-data" ? "—" : guidance.label}
                    </dd>
                    {airMeasurementBrief ? (
                      <p className="mt-1 text-xs font-bold text-current/70">
                        {airMeasurementBrief}
                      </p>
                    ) : guidance.airBand === "no-data" ? (
                      <p className="mt-1 text-xs font-bold text-current/70">
                        Reading unavailable for this place
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-[9rem] rounded-xl border border-current/20 bg-white/75 px-4 py-3">
                    <dt className="flex w-full items-center justify-between gap-2 text-xs font-extrabold uppercase">
                      Heat
                      <DefinitionHelp label="Heat" align="end">
                        The big number is how warm it feels outside in °C
                        (Celsius). We use a feels-like temperature when the
                        weather source provides one.
                        <span className="mt-2 block text-xs">
                          Higher numbers mean hotter conditions. Plan shade,
                          water, and rest when it feels especially hot.
                        </span>
                        <span className="mt-2 block text-xs">
                          Source: {data.heat?.source || "Unavailable"} ·{" "}
                          {provenanceText(data.heat?.provenance)}
                        </span>
                      </DefinitionHelp>
                    </dt>
                    <dd className="text-4xl font-extrabold tracking-tight">
                      {effectiveHeat ?? "—"}
                      {effectiveHeat != null ? (
                        <span className="text-2xl">°C</span>
                      ) : null}
                    </dd>
                    <p className="mt-1 text-xs font-bold text-current/70">
                      How hot it feels outdoors
                    </p>
                  </div>
                  <div className="min-w-[9rem] rounded-xl border border-current/20 bg-white/75 px-4 py-3">
                    <dt className="flex w-full items-center justify-between gap-2 text-xs font-extrabold uppercase">
                      Rain
                      <DefinitionHelp label="Rain" align="end">
                        The icon shows if it looks rainy, a little wet, or dry
                        at the place you selected right now.
                        <span className="mt-2 block text-xs">
                          The small text may show how much rain was reported (in
                          mm) or a short weather note such as light rain or clear
                          skies.
                        </span>
                        <span className="mt-2 block text-xs">
                          Source: {data.weather?.source || "Unavailable"} ·{" "}
                          {provenanceText(data.weather?.provenance)}
                        </span>
                      </DefinitionHelp>
                    </dt>
                    <dd className="mt-1 flex items-center gap-2">
                      <RainStatusIcon status={rain.status} />
                      <span className="text-sm font-extrabold text-current/80">
                        {rain.status}
                      </span>
                    </dd>
                    <p className="mt-1 text-xs font-bold text-current/70">
                      {rain.summary}
                    </p>
                  </div>
                </dl>
              </section>
            </Reveal>

            <section className="mt-8" aria-labelledby="recommendations-title">
              <Reveal>
                <h2 id="recommendations-title" className="text-2xl font-bold">Five things to do today</h2>
              </Reveal>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {guidance.recommendations.map((item, index) => (
                  <Reveal key={item.title} delay={0.06 * index} className="h-full">
                    <Card className="h-full p-4">
                      <span className="grid size-8 place-items-center rounded-full bg-forest text-sm font-extrabold text-white">
                        {index + 1}
                      </span>
                      <h3 className="mt-3 font-bold">{item.title}</h3>
                      <p className="mt-1 text-sm text-muted">{item.action}</p>
                    </Card>
                  </Reveal>
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
              ].map(([Icon, title, advice], index) => {
                const AdviceIcon = Icon as typeof Building2;
                return (
                  <Reveal key={title as string} delay={0.07 * index} className="h-full">
                    <Card className="h-full">
                      <AdviceIcon className="text-forest" aria-hidden />
                      <h3 className="mt-3 text-xl font-bold">{title as string}</h3>
                      <p className="mt-2 text-sm text-muted">{advice as string}</p>
                    </Card>
                  </Reveal>
                );
              })}
            </section>

            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <Reveal>
                <WeatherContext weather={data.weather?.weather} source={data.weather?.source} />
              </Reveal>
              <Reveal delay={0.08}>
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
                      <p className="mt-4">
                        <Link
                          href="/alerts"
                          className="text-sm font-extrabold text-link underline-offset-2 hover:underline"
                        >
                          View alert details
                        </Link>
                      </p>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="text-forest" aria-hidden />
                      <h2 className="mt-2 text-xl font-bold">No stored broadcast to show</h2>
                      <p className="mt-2 text-sm text-muted">
                        {data.latestAlert?.message || "The latest-alert service returned no broadcast."}
                      </p>
                      <p className="mt-4">
                        <Link
                          href="/alerts"
                          className="text-sm font-extrabold text-link underline-offset-2 hover:underline"
                        >
                          Why alerts appear · open Alerts
                        </Link>
                      </p>
                    </>
                  )}
                  <p className="mt-4 border-t border-border pt-3 text-xs text-muted">{guidance.operatorAlertNote}</p>
                </Card>
              </Reveal>
            </div>

            <section className="mt-8 grid gap-5 lg:grid-cols-2" aria-labelledby="trends-title">
              <Reveal className="lg:col-span-2">
                <AirQuality24h
                  city={city}
                  pm25={pm25}
                  source={data.air?.source}
                />
              </Reveal>

              <Reveal delay={0.04} className="lg:col-span-2">
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <CardKicker>Trend and cases</CardKicker>
                      <h2
                        id="trends-title"
                        className="flex flex-wrap items-center gap-2 text-2xl font-bold"
                      >
                        Respiratory cases this week
                        <DefinitionHelp label="Respiratory cases chart">
                          The bars show an example count of breathing-related
                          clinic visits for about the last week in this city.
                          The dashed line is a simple guess for the next few days.
                          <span className="mt-2 block text-xs">
                            This is practice / demo data for now — not live
                            hospital numbers.
                          </span>
                          <span className="mt-2 block text-xs">
                            Source: {data.cases?.source || "Unavailable"}
                          </span>
                        </DefinitionHelp>
                      </h2>
                      <p className="mt-1 text-sm text-muted">
                        {data.cases?.note || "Case-series context is unavailable."}
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
              </Reveal>

              <Reveal delay={0.06}>
                <Card>
                  <CardKicker>Illustrative forecast</CardKicker>
                  <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold">
                    Possible 3–5 day pressure
                    <DefinitionHelp label="Illustrative forecast">
                      A simple 0–100 score that guesses how busy next few days
                      might look using the example case chart above. Higher means
                      more pressure in the demo model.
                      <span className="mt-2 block text-xs">
                        For learning and discussion only — not a real health or
                        weather forecast.
                      </span>
                    </DefinitionHelp>
                  </h2>
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
              </Reveal>

              <Reveal delay={0.1}>
                <Card>
                  <CardKicker>City comparison</CardKicker>
                  <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold">
                    Weekly synthetic cases
                    <DefinitionHelp label="Weekly city comparison">
                      Compares example (demo) breathing-related case totals for
                      each city this week. Helpful for practice conversations —
                      real counts can replace this later.
                    </DefinitionHelp>
                  </h2>
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
              </Reveal>

              <Reveal delay={0.08} className="h-full">
                <FiveDayForecast
                  city={city}
                  pm25={pm25}
                  weekTrend={data.forecast?.legacy_week_trend}
                />
              </Reveal>

              <Reveal delay={0.1} className="h-full">
                <ScenarioSandbox key={city} city={city} livePm25={pm25} liveHeat={effectiveHeat} caseDays={caseDays} />
              </Reveal>

              <Reveal delay={0.12} className="lg:col-span-2">
                <CityAirCompare cities={cityOptions} currentCity={city} />
              </Reveal>
            </section>

            <Reveal delay={0.05}>
              <p className="mt-5 text-center text-xs text-muted" role="status">
                Last refreshed {new Date(data.refreshedAt).toLocaleString()}. Automatically checks every 30 minutes.
              </p>
            </Reveal>
          </div>
        </div>
      ) : null}
    </div>
  );
}
