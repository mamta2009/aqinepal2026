import { apiClient } from "./client";

import type { CitiesResponse } from "@/types/cities";

export async function getCities(): Promise<CitiesResponse> {
  const { data } = await apiClient.get<CitiesResponse>("/api/cities");
  return data;
}
