"use client";

import { useQuery } from "@tanstack/react-query";
import { BellRing, CheckCircle2, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardKicker } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { useSelectedCity } from "@/hooks/use-selected-city";
import { api } from "@/lib/api/endpoints";
import { cityNames } from "@/lib/api/dashboard";
import { queryKeys } from "@/lib/api/query-keys";
import type { AlertLatest } from "@/lib/api/types";

function formatHazard(hazard?: string) {
  if (!hazard) return "Environmental";
  if (hazard === "respiratory_surge") return "Respiratory surge";
  return hazard.charAt(0).toUpperCase() + hazard.slice(1);
}

function DeliveryResults({
  results,
}: {
  results?: AlertLatest["delivery_results"];
}) {
  if (!results || Object.keys(results).length === 0) {
    return (
      <p className="text-sm text-muted">
        Delivery channel counts were not stored for this broadcast.
      </p>
    );
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {Object.entries(results).map(([channel, counts]) => (
        <div
          key={channel}
          className="rounded-xl border border-border bg-surface px-4 py-3"
        >
          <dt className="text-xs font-extrabold tracking-wide text-ink-soft uppercase">
            {channel}
          </dt>
          <dd className="mt-1 text-sm font-bold text-ink">
            Sent {counts?.sent ?? 0} · Failed {counts?.failed ?? 0}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AlertsDetail() {
  const { selectedCity: city, setSelectedCity } = useSelectedCity();
  const citiesQuery = useQuery({
    queryKey: queryKeys.cities,
    queryFn: api.cities.list,
    staleTime: 30 * 60_000,
  });
  const cities = useMemo(
    () => cityNames(citiesQuery.data),
    [citiesQuery.data],
  );
  const cityOptions = cities.includes(city) ? cities : [city, ...cities];

  const alertQuery = useQuery({
    queryKey: queryKeys.alertsLatest(city),
    queryFn: () => api.alerts.latest(city),
    enabled: Boolean(city),
    staleTime: 5 * 60_000,
  });

  const data = alertQuery.data;
  const hasBroadcast = data?.source === "alert_broadcasts";
  const level = data?.level || data?.severity_level || data?.aqi_level;

  return (
    <div className="space-y-6">
      <Reveal>
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardKicker>Filter</CardKicker>
              <h2 className="text-xl font-bold">Place</h2>
              <p className="mt-1 text-sm text-muted">
                Uses the same saved city as Today&apos;s conditions. Change it
                here or on the dashboard — it is stored for your next visit.
              </p>
            </div>
            <label className="grid gap-1 text-sm font-bold">
              City
              <select
                className="min-h-11 min-w-[14rem] rounded-xl border border-border-strong bg-white px-3 font-bold text-ink"
                value={city}
                onChange={(event) => setSelectedCity(event.target.value)}
              >
                {cityOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.05}>
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardKicker>Stored broadcast</CardKicker>
              <h2 className="text-2xl font-bold">Latest public alert detail</h2>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={alertQuery.isFetching}
              onClick={() => void alertQuery.refetch()}
            >
              <RefreshCw
                size={16}
                className={alertQuery.isFetching ? "animate-spin" : undefined}
              />
              Refresh
            </Button>
          </div>

          {alertQuery.isPending ? (
            <p className="mt-6 text-sm text-muted">Loading latest alert…</p>
          ) : alertQuery.isError ? (
            <p className="mt-6 text-sm text-alert-red" role="alert">
              Could not load the latest alert. Check the API and try again.
            </p>
          ) : hasBroadcast ? (
            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-sky-soft text-link">
                  {formatHazard(data.hazard_type)}
                </Badge>
                {level ? (
                  <Badge className="bg-surface-tint text-forest">{level}</Badge>
                ) : null}
              </div>
              <div>
                <p className="text-3xl font-extrabold tracking-tight">
                  {formatHazard(data.hazard_type)} alert
                  {level ? ` · ${level}` : ""}
                </p>
                <p className="mt-2 text-base font-bold text-ink-soft">
                  {data.city || city || "Location not recorded"}
                  {" · "}
                  {data.timestamp
                    ? new Date(data.timestamp).toLocaleString()
                    : "Time unavailable"}
                </p>
                {data.heat_headline_display ? (
                  <p className="mt-2 text-sm text-muted">
                    Heat headline: {data.heat_headline_display}
                  </p>
                ) : null}
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface px-4 py-3">
                  <dt className="text-xs font-extrabold tracking-wide text-ink-soft uppercase">
                    Recipients targeted
                  </dt>
                  <dd className="mt-1 text-2xl font-extrabold">
                    {data.total_recipients ?? "—"}
                  </dd>
                </div>
                <div className="rounded-xl border border-border bg-surface px-4 py-3">
                  <dt className="text-xs font-extrabold tracking-wide text-ink-soft uppercase">
                    Source collection
                  </dt>
                  <dd className="mt-1 text-sm font-bold">
                    MongoDB alert_broadcasts
                  </dd>
                </div>
              </dl>
              <div>
                <h3 className="text-sm font-extrabold tracking-wide text-ink-soft uppercase">
                  Delivery results
                </h3>
                <div className="mt-3">
                  <DeliveryResults results={data.delivery_results} />
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex gap-3">
              <CheckCircle2
                className="mt-0.5 shrink-0 text-forest"
                aria-hidden
              />
              <div>
                <p className="text-xl font-bold">No stored broadcast to show</p>
                <p className="mt-2 text-sm text-muted">
                  {data?.message ||
                    "No broadcasts yet. After air, heat, or surge evaluate/broadcast runs and writes to alert_broadcasts, the latest summary appears here and in the navbar."}
                </p>
              </div>
            </div>
          )}
        </Card>
      </Reveal>

      <Reveal delay={0.08}>
        <Card className="border-sky/40 bg-sky-soft/40">
          <div className="flex gap-3">
            <BellRing className="mt-0.5 shrink-0 text-link" aria-hidden />
            <div>
              <CardKicker>When do alerts appear?</CardKicker>
              <h2 className="text-xl font-bold">
                Only after a real outbound broadcast is stored
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-muted">
                <li>
                  Operators or cron call air evaluate, heat evaluate, manual
                  broadcast, or a respiratory surge hook.
                </li>
                <li>
                  Air/heat evaluate only send when the mapped level meets the
                  minimum (default MODERATE) and the per-city cooldown allows it
                  (unless force is used).
                </li>
                <li>
                  Eligible registered contacts who consented for that city and
                  hazard then receive SMS, WhatsApp, and/or email.
                </li>
                <li>
                  A row is saved in alert_broadcasts; GET /api/alerts/latest and
                  this page read that row. Empty means nothing has been broadcast
                  yet (or MongoDB is not configured).
                </li>
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <ButtonLink href="/dashboard" variant="secondary" size="sm">
                  Today&apos;s conditions
                </ButtonLink>
                <ButtonLink href="/registration" size="sm">
                  Register for alerts
                </ButtonLink>
              </div>
            </div>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
