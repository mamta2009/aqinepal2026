"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";

export function NavAlert() {
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.alertsLatest(),
    queryFn: () => api.alerts.latest(),
    staleTime: 5 * 60_000,
  });

  const text = isPending
    ? "Loading…"
    : isError
      ? "Alerts unavailable"
      : data?.source === "none" || data?.source === "empty"
        ? data.message || "No alerts yet"
        : [data?.city, data?.level || data?.aqi_level]
          .filter(Boolean)
          .join(" · ") || "No current broadcast";

  return (
    <Link
      href="/alerts"
      className="hidden min-w-0 max-w-60 items-center gap-2 rounded-xl border border-sky/50 bg-sky-soft px-3 py-2 text-xs hover:border-link hover:bg-sky/15 lg:flex"
      title="Open latest alert details"
    >
      <strong className="shrink-0 text-link uppercase">Latest alert</strong>
      <span className="truncate text-ink-soft" aria-live="polite">
        {text}
      </span>
    </Link>
  );
}
