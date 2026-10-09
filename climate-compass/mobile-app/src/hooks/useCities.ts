import { useQuery } from "@tanstack/react-query";

import { getCities } from "@/services/api/cities";

export function useCities() {
  return useQuery({
    queryKey: ["cities"],
    queryFn: getCities,
    staleTime: 60 * 60 * 1000,
  });
}
