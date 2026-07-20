import { useQuery } from "@tanstack/react-query";

import { getRuntimeConfig } from "@/services/api/runtimeConfig";

export function useRuntimeConfig() {
  return useQuery({
    queryKey: ["runtime-config"],
    queryFn: getRuntimeConfig,
    staleTime: 60 * 60 * 1000,
  });
}
