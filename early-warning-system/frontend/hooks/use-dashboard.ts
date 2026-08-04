"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "@/lib/api/dashboard";
import { queryKeys } from "@/lib/api/query-keys";

export const DASHBOARD_REFRESH_MS = 30 * 60 * 1000;

export function useDashboard(city: string) {
  return useQuery({
    queryKey: queryKeys.dashboard(city),
    queryFn: () => getDashboardData(city),
    enabled: Boolean(city),
    refetchInterval: DASHBOARD_REFRESH_MS,
    staleTime: 5 * 60 * 1000,
  });
}
