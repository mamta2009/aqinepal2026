import { useQuery } from "@tanstack/react-query";

import { getHeatCurrent } from "@/services/api/dashboard";

import type { CityName } from "@/constants/cities";

export function useHeatCurrent(city: CityName) {
  return useQuery({
    queryKey: ["heat-current", city],
    queryFn: () => getHeatCurrent(city),
  });
}
