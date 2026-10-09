import { apiClient } from "./client";

import type { RuntimeConfigResponse } from "@/types/runtimeConfig";

export async function getRuntimeConfig(): Promise<RuntimeConfigResponse> {
  const { data } = await apiClient.get<RuntimeConfigResponse>(
    "/api/runtime-config",
  );
  return data;
}
