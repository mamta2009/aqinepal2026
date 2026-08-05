"use client";

import { AlertTriangle, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardKicker } from "@/components/ui/card";
import { useEnvironmentOverview } from "@/hooks/use-environment-overview";
import type { EnvironmentOverviewItem } from "@/lib/api/types";

function statusLabel(item: EnvironmentOverviewItem) {
  const value = item.air_quality.aqi;
  if (typeof value === "number") {
    if (value <= 50) return "Good";
    if (value <= 100) return "Moderate";
    if (value <= 150) return "Use extra care";
    return "Unhealthy";
  }
  if (item.air_quality.pm25_ug_m3 == null) return "No air data";
  return item.air_quality.status || item.status || "Reading available";
}

function markerClass(item: EnvironmentOverviewItem) {
  const label = statusLabel(item).toLowerCase();
  if (label.includes("unhealthy")) return "fill-aq-unhealthy";
  if (label.includes("extra care")) return "fill-aq-sensitive";
  if (label.includes("moderate")) return "fill-aq-moderate";
  if (label.includes("good")) return "fill-aq-good";
  return "fill-muted";
}

function position(
  item: EnvironmentOverviewItem,
  cities: EnvironmentOverviewItem[],
) {
  const lats = cities.map((city) => city.lat);
  const lons = cities.map((city) => city.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    x: 30 + ((item.lon - minLon) / Math.max(maxLon - minLon, 0.01)) * 340,
    y: 220 - ((item.lat - minLat) / Math.max(maxLat - minLat, 0.01)) * 180,
  };
}

export function EnvironmentOverview() {
  const query = useEnvironmentOverview();

  if (query.isPending) {
    return (
      <div
        className="h-80 animate-pulse rounded-3xl bg-sky-soft"
        role="status"
        aria-label="Loading environment overview"
      />
    );
  }

  if (query.isError || !query.data) {
    return (
      <Card className="text-center">
        <AlertTriangle className="mx-auto text-alert-red" aria-hidden />
        <h2 className="mt-3 text-2xl font-bold">Geographic overview unavailable</h2>
        <p className="mt-2 text-muted">
          No city status should be inferred while the overview service is unavailable.
        </p>
        <Button className="mt-5" onClick={() => query.refetch()}>
          <RefreshCw size={17} /> Try again
        </Button>
      </Card>
    );
  }

  const cities = query.data.cities ?? [];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Overview status: {query.data.status}. Each city reports air and heat
          sources separately.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw className={query.isFetching ? "animate-spin" : ""} size={16} />{" "}
          Refresh
        </Button>
      </div>

      {cities.length === 0 ? (
        <Card className="mt-5">
          <h2 className="text-xl font-bold">No city readings</h2>
          <p className="mt-2 text-muted">
            The service responded but did not provide locations.
          </p>
        </Card>
      ) : (
        <>
          <section
            className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]"
            aria-labelledby="map-heading"
          >
            <Card className="overflow-hidden p-3 sm:p-5">
              <h2 id="map-heading" className="px-2 text-xl font-bold">
                Nepal geographic overview
              </h2>
              <p className="px-2 text-sm text-muted">
                Marker labels and the list provide the status; color is
                supplementary.
              </p>
              <svg
                className="mt-3 h-auto w-full rounded-2xl bg-sky-soft"
                viewBox="0 0 400 250"
                role="img"
                aria-labelledby="map-title map-description"
              >
                <title id="map-title">Environmental readings by city</title>
                <desc id="map-description">
                  A schematic geographic plot based on city latitude and
                  longitude across Nepal. Use the city list and table for
                  complete values.
                </desc>
                <path
                  d="M27 177 C52 120 83 75 137 60 C199 41 247 67 287 54 C337 38 371 73 376 120 C380 165 343 205 294 211 C236 220 194 195 142 211 C89 227 47 213 27 177Z"
                  className="fill-white stroke-border-strong"
                  strokeWidth="2"
                />
                {cities.map((city) => {
                  const { x, y } = position(city, cities);
                  return (
                    <g key={city.city} transform={`translate(${x} ${y})`}>
                      <circle
                        r="8"
                        className={`${markerClass(city)} stroke-white`}
                        strokeWidth="3"
                      />
                      <text
                        y="-13"
                        textAnchor="middle"
                        className="fill-ink text-[9px] font-bold"
                      >
                        {city.city}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {cities.map((city) => {
                const heat =
                  city.heat.effective_temp_c ?? city.heat.temp_c ?? null;
                const aqi = city.air_quality.aqi;
                const pm25 = city.air_quality.pm25_ug_m3;
                return (
                  <article
                    className="rounded-2xl border border-border bg-white p-4 shadow-sm"
                    key={city.city}
                  >
                    <div className="flex items-start gap-3">
                      <MapPin
                        className="mt-0.5 shrink-0 text-forest"
                        size={19}
                        aria-hidden
                      />
                      <div>
                        <h3 className="font-bold">{city.city}</h3>
                        <p className="text-sm font-extrabold">
                          {statusLabel(city)}
                        </p>
                        <p className="mt-1 text-sm font-bold text-ink-soft">
                          AQI score {aqi ?? "—"}
                          {heat != null ? ` · Heat ${heat}°C` : ""}
                        </p>
                        {pm25 != null && (
                          <p className="mt-0.5 text-xs text-muted">
                            Fine particles (PM2.5): {pm25} µg/m³
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <Card className="mt-5 overflow-hidden p-0">
            <div className="p-5">
              <CardKicker>Accessible data view</CardKicker>
              <h2 className="text-xl font-bold">All city readings</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[700px] w-full text-left text-sm">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-5 py-3">City</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">AQI score</th>
                    <th className="px-5 py-3">Heat</th>
                    <th className="px-5 py-3">PM2.5 (detail)</th>
                    <th className="px-5 py-3">Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((city) => (
                    <tr className="border-t border-border" key={city.city}>
                      <th className="px-5 py-3">{city.city}</th>
                      <td className="px-5 py-3 font-bold">
                        {statusLabel(city)}
                      </td>
                      <td className="px-5 py-3">
                        {city.air_quality.aqi ?? "No data"}
                      </td>
                      <td className="px-5 py-3">
                        {city.heat.effective_temp_c ??
                          city.heat.temp_c ??
                          "No data"}
                        {city.heat.effective_temp_c != null ||
                          city.heat.temp_c != null
                          ? "°C"
                          : ""}
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {city.air_quality.pm25_ug_m3 != null
                          ? `${city.air_quality.pm25_ug_m3} µg/m³`
                          : "No data"}
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {city.air_quality.source || "Air source unavailable"};{" "}
                        {city.heat.source || "heat source unavailable"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      <p className="mt-5 text-center text-xs text-muted" role="status">
        Generated{" "}
        {query.data.generated_at
          ? new Date(query.data.generated_at).toLocaleString()
          : "at an unreported time"}
        . Automatically refreshes every 30 minutes.
      </p>
    </>
  );
}
