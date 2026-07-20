import axios, { type AxiosError } from "axios";

import { API_BASE_URL, API_TIMEOUT_MS } from "@/constants/api";

/**
 * Shared Axios instance for all backend calls.
 *
 * Auth isn't wired up yet (that's a later feature) — `getAuthToken` is a
 * swappable provider so the request interceptor below doesn't need to change
 * once `store/authStore` exists; it just starts returning a real token.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    Accept: "application/json",
  },
});

type AuthTokenProvider = () => string | null;

let getAuthToken: AuthTokenProvider = () => null;

export function setAuthTokenProvider(provider: AuthTokenProvider): void {
  getAuthToken = provider;
}

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

export interface ApiError {
  status: number | null;
  message: string;
  detail?: unknown;
}

export function toApiError(error: unknown): ApiError {
  const axiosError = error as AxiosError<{ detail?: unknown }>;
  if (axiosError?.isAxiosError) {
    const status = axiosError.response?.status ?? null;
    const detail = axiosError.response?.data?.detail;
    return {
      status,
      message:
        (typeof detail === "string" && detail) ||
        axiosError.message ||
        "Network request failed",
      detail,
    };
  }
  return {
    status: null,
    message: error instanceof Error ? error.message : String(error),
  };
}
