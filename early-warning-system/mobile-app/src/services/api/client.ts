import axios, { type AxiosError } from "axios";

import { API_BASE_URL, API_TIMEOUT_MS } from "@/constants/api";

/**
 * Shared Axios instance for all backend calls.
 *
 * Bearer token comes from `setAuthTokenProvider` (wired by `store/authStore`).
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    Accept: "application/json",
  },
});

type AuthTokenProvider = () => string | null;
type UnauthorizedHandler = () => void;

let getAuthToken: AuthTokenProvider = () => null;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setAuthTokenProvider(provider: AuthTokenProvider): void {
  getAuthToken = provider;
}

export function setUnauthorizedHandler(
  handler: UnauthorizedHandler | null,
): void {
  onUnauthorized = handler;
}

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

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
    let message =
      (typeof detail === "string" && detail) ||
      axiosError.message ||
      "Network request failed";
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      const maybeMsg = (detail as { message?: unknown }).message;
      if (typeof maybeMsg === "string") message = maybeMsg;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (typeof first?.msg === "string") message = first.msg;
    }
    return { status, message, detail };
  }
  return {
    status: null,
    message: error instanceof Error ? error.message : String(error),
  };
}
