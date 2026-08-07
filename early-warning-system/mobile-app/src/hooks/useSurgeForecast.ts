import { useQuery } from "@tanstack/react-query";
import { getSurgeForecast } from "@/services/api/dashboard";
import type { CityName } from "@/constants/cities";

export function useSurgeForecast(city: CityName, enabled = true) {
  return useQuery({
    queryKey: ["surge-forecast", city],
    queryFn: () => getSurgeForecast(city),
    enabled,
  });
}
