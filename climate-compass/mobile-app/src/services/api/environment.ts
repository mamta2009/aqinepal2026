import { apiClient } from "@/services/api/client";
import type { EnvironmentOverviewResponse } from "@/types/environment";

export async function getEnvironmentOverview(): Promise<EnvironmentOverviewResponse> {
  const { data } = await apiClient.get<EnvironmentOverviewResponse>(
    "/api/environment/overview",
  );
  return data;
}
