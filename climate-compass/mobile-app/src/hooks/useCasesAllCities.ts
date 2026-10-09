import { useQuery } from "@tanstack/react-query";
import { getCasesAllCities } from "@/services/api/dashboard";

export function useCasesAllCities(enabled = true) {
  return useQuery({
    queryKey: ["cases-all-cities"],
    queryFn: getCasesAllCities,
    enabled,
  });
}
