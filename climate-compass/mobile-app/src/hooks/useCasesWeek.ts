import { useQuery } from "@tanstack/react-query";

import { getCasesWeek } from "@/services/api/dashboard";

import type { CityName } from "@/constants/cities";

export function useCasesWeek(city: CityName) {
  return useQuery({
    queryKey: ["cases-week", city],
    queryFn: () => getCasesWeek(city),
  });
}
