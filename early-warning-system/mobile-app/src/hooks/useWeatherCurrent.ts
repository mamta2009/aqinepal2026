import { useQuery } from "@tanstack/react-query";

import { getWeatherCurrent } from "@/services/api/dashboard";

import type { CityName } from "@/constants/cities";

export function useWeatherCurrent(city: CityName) {
  return useQuery({
    queryKey: ["weather-current", city],
    queryFn: () => getWeatherCurrent(city),
  });
}
