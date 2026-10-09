"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";

export function useEnvironmentOverview() {
  return useQuery({
    queryKey: queryKeys.environmentOverview,
    queryFn: api.environment.overview,
    refetchInterval: 30 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
}
