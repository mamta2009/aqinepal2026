import { useQuery } from "@tanstack/react-query";

import { getAirQualityCurrent } from "@/services/api/dashboard";

import type { CityName } from "@/constants/cities";

export function useAirQuality(city: CityName) {
  return useQuery({
    queryKey: ["air-quality-current", city],
    queryFn: () => getAirQualityCurrent(city),
  });
}
