import { apiClient } from "@/services/api/client";

export interface AqiHelpCitation {
  source?: string;
  heading?: string;
}

export interface AqiHelpMeta {
  name?: string;
  chunk_count?: number;
  build_error?: string | null;
  openrouter_configured?: boolean;
  rate_limit_per_minute?: number;
  note?: string;
  unavailable_message?: string;
}

export interface AqiHelpChatResponse {
  reply?: string;
  citations?: AqiHelpCitation[];
  disclaimer?: string;
  model?: string;
}

/** OpenRouter answers can take a while; backend timeout is ~75s. */
const CHAT_TIMEOUT_MS = 90_000;

export async function getAqiHelpMeta(): Promise<AqiHelpMeta> {
  const { data } = await apiClient.get<AqiHelpMeta>("/api/help/aqi/meta");
  return data;
}

export async function postAqiHelpChat(
  message: string,
): Promise<AqiHelpChatResponse> {
  const { data } = await apiClient.post<AqiHelpChatResponse>(
    "/api/help/aqi/chat",
    { message },
    { timeout: CHAT_TIMEOUT_MS },
  );
  return data;
}
