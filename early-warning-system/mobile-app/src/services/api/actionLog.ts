import { apiClient } from "./client";

import type {
  ActionLogCreatePayload,
  ActionLogCreateResponse,
  ActionLogListResponse,
} from "@/types/auth";

export async function createActionLog(
  body: ActionLogCreatePayload,
): Promise<ActionLogCreateResponse> {
  const { data } = await apiClient.post<ActionLogCreateResponse>(
    "/api/action-log",
    body,
  );
  return data;
}

export async function listMyActionLogs(
  limit = 50,
): Promise<ActionLogListResponse> {
  const { data } = await apiClient.get<ActionLogListResponse>(
    "/api/action-log/me",
    { params: { limit } },
  );
  return data;
}
