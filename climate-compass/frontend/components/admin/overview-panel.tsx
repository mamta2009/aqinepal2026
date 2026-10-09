"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminApi, JsonObject } from "@/lib/api/admin";
import { thresholdSchema } from "@/lib/validation/admin";
import {
  ErrorMessage,
  fieldClass,
  helpClass,
  labelClass,
  SummaryJsonCard,
} from "./admin-ui";

type HealthState = "ok" | "warn" | "bad" | "loading";
type HealthStory = { state: HealthState; title: string; body: string };

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function asList(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
      (item): item is JsonObject => Boolean(item) && typeof item === "object",
    )
    : [];
}

function truthy(value: unknown) {
  return value === true || value === "true" || value === 1;
}

function mongoStory(mongo: JsonObject | undefined): HealthStory {
  if (!mongo) {
    return {
      state: "loading",
      title: "Checking",
      body: "Asking the server whether the records database is reachable.",
    };
  }
  if (truthy(mongo.ok)) {
    return {
      state: "ok",
      title: "Working",
      body: "The records database is connected. Registrations, alert history, and this warning-line setting are stored here.",
    };
  }
  if (truthy(mongo.url_looks_like_template)) {
    return {
      state: "warn",
      title: "Sample address still in place",
      body: "The database address in server settings looks like a placeholder. A technician needs to put the real MongoDB Atlas connection string in MONGODB_URL and restart the API.",
    };
  }
  if (!truthy(mongo.configured)) {
    return {
      state: "warn",
      title: "Not set up yet",
      body: "No database address is configured. New registrations and saved settings cannot be stored until MONGODB_URL is set.",
    };
  }
  const detail = String(mongo.detail || mongo.last_error || "").trim();
  if (!truthy(mongo.client_attached)) {
    return {
      state: "bad",
      title: "Could not connect",
      body:
        detail ||
        "The server has a database address but could not open it. Typical causes: wrong password, Atlas IP allow list, or the API was not restarted after changing .env.",
    };
  }
  return {
    state: "bad",
    title: "Not responding",
    body:
      detail ||
      "The database address is set, but a health check failed. Check Atlas status, network access, and API logs.",
  };
}

function weatherStory(weather: JsonObject | undefined): HealthStory {
  if (!weather) {
    return {
      state: "loading",
      title: "Checking",
      body: "Asking the server whether live weather can be fetched.",
    };
  }
  if (weather.configured === false) {
    return {
      state: "warn",
      title: "Not set up yet",
      body: "No weather key is configured. The public dashboard cannot show live air or heat until a WeatherAPI, RapidAPI, or OpenWeather key is added.",
    };
  }
  if (truthy(weather.ok)) {
    return {
      state: "ok",
      title: "Working",
      body: "Live weather and air feeds can be reached. The public dashboard uses these for the selected municipality.",
    };
  }
  return {
    state: "bad",
    title: "Not responding",
    body:
      String(weather.detail || weather.mode || "").trim() ||
      "A weather key is present but the live check failed. Confirm the key is valid and the API can reach the internet.",
  };
}

const INTEGRATION_LABELS: Record<string, string> = {
  sparrow_sms_configured: "SMS (Sparrow, Nepal)",
  twilio_configured: "WhatsApp / Twilio",
  sms_configured: "Text messages ready",
  sms_provider: "SMS service in use",
  sendgrid_email_ready: "Email (SendGrid)",
  resend_email_ready: "Email (SendGrid)",
  waqi_configured: "Air quality (WAQI)",
  weatherapi_com_direct_configured: "WeatherAPI.com",
  rapidapi_weather_configured: "RapidAPI weather",
  openweathermap_configured: "OpenWeatherMap",
  openrouter_configured: "AI helper (OpenRouter)",
};

function integrationRows(status: JsonObject | undefined): { label: string; value: string }[] {
  const integrations = asObject(status?.integrations) || {};
  const mongodb = asObject(status?.mongodb);
  const rows: { label: string; value: string }[] = [
    {
      label: "Records database",
      value: mongodb
        ? truthy(mongodb.ping_ok)
          ? "Connected"
          : truthy(mongodb.configured)
            ? "Not responding"
            : "Not set up"
        : "Unknown",
    },
  ];
  const seen = new Set<string>();
  for (const [key, label] of Object.entries(INTEGRATION_LABELS)) {
    if (!(key in integrations) || seen.has(label)) continue;
    seen.add(label);
    const raw = integrations[key];
    if (typeof raw === "string") {
      rows.push({ label, value: raw });
    } else {
      rows.push({ label, value: truthy(raw) ? "Ready" : "Not set up" });
    }
  }
  return rows;
}

function activityRows(activity: JsonObject | undefined): { label: string; value: string }[] {
  if (!activity) return [];
  const num = (key: string) => {
    const value = activity[key];
    return typeof value === "number" ? String(value) : "0";
  };
  return [
    { label: "People registered", value: num("contacts_total") },
    { label: "Verified (can get alerts)", value: num("contacts_verified") },
    { label: "Still waiting to verify", value: num("contacts_pending_verify") },
    { label: "Facility actions logged (24h)", value: num("action_logs_last_24h") },
    { label: "Messages sent (24h)", value: num("notification_logs_last_24h") },
  ];
}

function logLines(logs: unknown): { when: string; what: string }[] {
  const payload = asObject(logs);
  const entries = asList(payload?.entries).length
    ? asList(payload?.entries)
    : asList(logs);
  return entries.slice(0, 12).map((entry) => {
    const when = String(entry.timestamp || entry.created_at || entry.time || "")
      .replace("T", " ")
      .slice(0, 16);
    const what = [
      entry.action_type || entry.type || entry.event,
      entry.city || entry.facility_name,
    ]
      .filter(Boolean)
      .map(String)
      .join(" · ");
    return { when: when || "Recently", what: what || "Facility action" };
  });
}

export function OverviewPanel() {
  const queryClient = useQueryClient();
  const runtime = useQuery({
    queryKey: ["admin", "runtime"],
    queryFn: adminApi.runtimeConfig,
  });
  const connection = useQuery({
    queryKey: ["admin", "connections"],
    queryFn: adminApi.connectionStatus,
    refetchInterval: 60_000,
  });
  const status = useQuery({
    queryKey: ["admin", "system-status"],
    queryFn: adminApi.systemStatus,
  });
  const activity = useQuery({
    queryKey: ["admin", "activity"],
    queryFn: adminApi.activitySummary,
  });
  const logs = useQuery({
    queryKey: ["admin", "logs"],
    queryFn: adminApi.recentLogs,
  });

  const dashboard = asObject(runtime.data?.dashboard);
  const initial = Number(dashboard?.pm25_alert_threshold_ugm3 ?? 150);
  const form = useForm<{ threshold: number }>({
    resolver: zodResolver(thresholdSchema),
    values: { threshold: Number.isFinite(initial) ? initial : 150 },
  });
  const save = useMutation({
    mutationFn: adminApi.patchThreshold,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "runtime"] }),
  });

  const mongoUi = mongoStory(asObject(connection.data?.mongodb));
  const weatherUi = weatherStory(asObject(connection.data?.weather));
  const activityItems = activityRows(asObject(activity.data));
  const logItems = logLines(logs.data);

  return (
    <div className="grid gap-5">
      <p className={helpClass}>
        This page is a health check for operators. It does not send alerts by
        itself. Use Enrollees to manage people, and the public dashboard to see
        what residents see.
      </p>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Service health">
        <Card className="!p-5">
          <h2 className="text-xl font-extrabold">Is the system working?</h2>
          <p className={`${helpClass} mt-1`}>
            Two pieces must be up: the records database (registrations and
            history) and the weather feed (live air and heat on the public
            dashboard).
          </p>
          {connection.isPending ? (
            <p className={`${helpClass} mt-4`}>Checking services…</p>
          ) : connection.isError ? (
            <ErrorMessage message={errorText(connection.error)} />
          ) : (
            <div className="mt-4 grid gap-3">
              <HealthCard
                name="Records database"
                technical="MongoDB"
                story={mongoUi}
              />
              <HealthCard
                name="Live weather and air"
                technical="Weather API"
                story={weatherUi}
              />
            </div>
          )}
        </Card>

        <Card className="!p-5">
          <h2 className="text-xl font-extrabold">Public dashboard warning line</h2>
          <p className={`${helpClass} mt-1`}>
            This number is the PM2.5 line (fine dust, µg/m³) used on the{" "}
            <Link href="/dashboard" className="font-bold text-link underline">
              public dashboard
            </Link>{" "}
            and city comparison table. When a city’s reading is above this value,
            the dashboard marks air as elevated.
          </p>
          <p className={`${helpClass} mt-2`}>
            It does not send SMS or email. Those alerts use a separate evaluate
            process with their own air and heat bands.
          </p>
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={form.handleSubmit(({ threshold }) => save.mutate(threshold))}
          >
            <label className={`${labelClass} max-w-52`}>
              Warning line (µg/m³)
              <input
                className={fieldClass}
                type="number"
                min={5}
                max={600}
                inputMode="numeric"
                {...form.register("threshold", { valueAsNumber: true })}
              />
            </label>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save warning line"}
            </Button>
          </form>
          <ErrorMessage
            message={
              form.formState.errors.threshold?.message ??
              (save.isError ? errorText(save.error) : undefined)
            }
          />
          {save.isSuccess ? (
            <p className="mt-2 text-sm font-bold text-aq-good" role="status">
              Warning line saved. Refresh the public dashboard to see it.
            </p>
          ) : null}
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3" aria-label="Operational data">
        <SummaryJsonCard
          title="What is turned on"
          description="Which message and weather services are ready. This is setup status, not live sending."
          pending={status.isPending}
          error={status.error}
          data={status.data}
          onRefresh={() =>
            queryClient.invalidateQueries({ queryKey: ["admin", "system-status"] })
          }
        >
          <FactList rows={integrationRows(asObject(status.data))} empty="No status yet." />
        </SummaryJsonCard>
        <SummaryJsonCard
          title="Last 24 hours"
          description="How many people are on the list and how much activity happened recently."
          pending={activity.isPending}
          error={activity.error}
          data={activity.data}
          onRefresh={() =>
            queryClient.invalidateQueries({ queryKey: ["admin", "activity"] })
          }
        >
          <FactList rows={activityItems} empty="No activity counts yet." />
        </SummaryJsonCard>
        <SummaryJsonCard
          title="Recent facility reports"
          description="Actions health workers logged (stock checks, briefings). Empty until someone files a report."
          pending={logs.isPending}
          error={logs.error}
          data={logs.data}
          onRefresh={() =>
            queryClient.invalidateQueries({ queryKey: ["admin", "logs"] })
          }
        >
          {logItems.length ? (
            <ul className="grid gap-2">
              {logItems.map((item, index) => (
                <li
                  key={`${item.when}-${index}`}
                  className="rounded-xl border border-border bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="block font-extrabold text-ink">{item.what}</span>
                  <span className="text-muted">{item.when}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={helpClass}>No facility reports yet.</p>
          )}
        </SummaryJsonCard>
      </section>
    </div>
  );
}

function HealthCard({
  name,
  technical,
  story,
}: {
  name: string;
  technical: string;
  story: HealthStory;
}) {
  const tone =
    story.state === "ok"
      ? "border-green-200 bg-green-50"
      : story.state === "warn"
        ? "border-amber-300 bg-amber-50"
        : story.state === "loading"
          ? "border-border bg-slate-50"
          : "border-alert-red/40 bg-red-50";
  const badge =
    story.state === "ok"
      ? "Working"
      : story.state === "warn"
        ? "Needs setup"
        : story.state === "loading"
          ? "Checking"
          : "Needs attention";
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="m-0 text-lg font-extrabold text-ink">{name}</p>
          <p className="m-0 text-xs font-bold tracking-wide text-muted uppercase">
            {technical}
          </p>
        </div>
        <span className="text-sm font-extrabold">{badge}</span>
      </div>
      <p className="mt-2 text-sm font-extrabold text-ink">{story.title}</p>
      <p className="mt-1 text-sm leading-6 text-ink-soft">{story.body}</p>
    </div>
  );
}

function FactList({
  rows,
  empty,
}: {
  rows: { label: string; value: string }[];
  empty: string;
}) {
  if (!rows.length) {
    return <p className={helpClass}>{empty}</p>;
  }
  return (
    <dl className="grid gap-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
        >
          <dt className="text-sm text-ink-soft">{row.label}</dt>
          <dd className="m-0 text-right text-sm font-extrabold text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
