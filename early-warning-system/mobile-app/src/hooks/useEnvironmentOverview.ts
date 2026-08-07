import { useQuery } from "@tanstack/react-query";

import { getEnvironmentOverview } from "@/services/api/environment";

export function useEnvironmentOverview() {
  return useQuery({
    queryKey: ["environment-overview"],
    queryFn: getEnvironmentOverview,
    refetchInterval: 30 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
}
