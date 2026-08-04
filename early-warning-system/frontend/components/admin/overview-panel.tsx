"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminApi, AdminApiError, JsonObject } from "@/lib/api/admin";
import { thresholdSchema } from "@/lib/validation/admin";
import {
  ErrorMessage,
  fieldClass,
  helpClass,
  JsonPanel,
  labelClass,
} from "./admin-ui";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
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

  const dashboard = runtime.data?.dashboard as JsonObject | undefined;
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

  const mongo = connection.data?.mongodb as JsonObject | undefined;
  const weather = connection.data?.weather as JsonObject | undefined;

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-2" aria-label="Service health">
        <Card className="!p-5">
          <h2 className="text-xl font-extrabold">Connection status</h2>
          {connection.isPending ? (
            <p className={helpClass}>Checking services…</p>
          ) : connection.isError ? (
            <ErrorMessage message={errorText(connection.error)} />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatusPill
                label="MongoDB"
                ok={Boolean(mongo?.ok)}
                detail={String(mongo?.detail ?? mongo?.last_error ?? "")}
              />
              <StatusPill
                label="Weather API"
                ok={Boolean(weather?.ok)}
                neutral={weather?.configured === false}
                detail={String(weather?.detail ?? weather?.mode ?? "")}
              />
            </div>
          )}
        </Card>
        <Card className="!p-5">
          <h2 className="text-xl font-extrabold">Dashboard threshold</h2>
          <p className={helpClass}>
            This MongoDB value controls the public PM2.5 alert line.
          </p>
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={form.handleSubmit(({ threshold }) => save.mutate(threshold))}
          >
            <label className={`${labelClass} max-w-52`}>
              PM2.5 (µg/m³)
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
              {save.isPending ? "Saving…" : "Save threshold"}
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
              Threshold saved.
            </p>
          ) : null}
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3" aria-label="Operational data">
        <DataCard
          title="System and integrations"
          data={status.data}
          pending={status.isPending}
          error={status.error}
          onRefresh={() =>
            queryClient.invalidateQueries({ queryKey: ["admin", "system-status"] })
          }
        />
        <DataCard
          title="Activity — past 24 hours"
          data={activity.data}
          pending={activity.isPending}
          error={activity.error}
          onRefresh={() =>
            queryClient.invalidateQueries({ queryKey: ["admin", "activity"] })
          }
        />
        <DataCard
          title="Recent preparedness logs"
          data={logs.data}
          pending={logs.isPending}
          error={logs.error}
          onRefresh={() =>
            queryClient.invalidateQueries({ queryKey: ["admin", "logs"] })
          }
        />
      </section>
    </div>
  );
}

function StatusPill({
  label,
  ok,
  neutral,
  detail,
}: {
  label: string;
  ok: boolean;
  neutral?: boolean;
  detail?: string;
}) {
  const color = neutral
    ? "bg-slate-100 text-muted"
    : ok
      ? "bg-green-50 text-aq-good"
      : "bg-red-50 text-alert-red";
  return (
    <div className={`rounded-xl p-3 ${color}`} title={detail}>
      <strong>{label}</strong>
      <span className="ml-2 text-sm">{neutral ? "Not configured" : ok ? "Online" : "Needs attention"}</span>
      {detail ? <p className="mt-1 text-xs">{detail}</p> : null}
    </div>
  );
}

function DataCard({
  title,
  data,
  pending,
  error,
  onRefresh,
}: {
  title: string;
  data?: unknown;
  pending: boolean;
  error: Error | null;
  onRefresh: () => void;
}) {
  return (
    <Card className="min-w-0 !p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-extrabold">{title}</h2>
        <Button size="sm" variant="secondary" onClick={onRefresh} disabled={pending}>
          Refresh
        </Button>
      </div>
      {error ? (
        <ErrorMessage
          message={
            error instanceof AdminApiError ? error.message : "Could not load data."
          }
        />
      ) : (
        <JsonPanel value={pending ? undefined : data} empty="Loading…" />
      )}
    </Card>
  );
}
