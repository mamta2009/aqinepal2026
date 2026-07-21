import { useQuery } from "@tanstack/react-query";

import { getWeekPredict } from "@/services/api/dashboard";

import type { CityName } from "@/constants/cities";

export function useWeekForecast(city: CityName) {
  return useQuery({
    queryKey: ["week-forecast", city],
    queryFn: () => getWeekPredict(city),
  });
}
