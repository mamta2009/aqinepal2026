import { useQuery } from "@tanstack/react-query";
import { getGuide, listGuides } from "@/services/api/guides";

export function useGuides() {
  return useQuery({
    queryKey: ["guides", "index"],
    queryFn: listGuides,
    staleTime: 30 * 60 * 1000,
  });
}

export function useGuide(path: string | undefined) {
  return useQuery({
    queryKey: ["guides", "document", path],
    queryFn: () => getGuide(path!),
    enabled: Boolean(path),
  });
}
