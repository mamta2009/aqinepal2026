import { useQuery } from "@tanstack/react-query";

import { getLatestAlert } from "@/services/api/dashboard";

import type { CityName } from "@/constants/cities";

export function useLatestAlert(city?: CityName) {
  return useQuery({
    queryKey: ["latest-alert", city ?? "all"],
    queryFn: () => getLatestAlert(city),
    staleTime: 5 * 60 * 1000,
  });
}
