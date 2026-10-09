import type { ApiErrorPayload } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiErrorMessage(payload: unknown, fallback: string) {
  const value = payload as ApiErrorPayload | undefined;
  if (typeof value?.detail === "string") return value.detail;
  if (Array.isArray(value?.detail)) {
    const messages = value.detail
      .map((item) => item?.msg)
      .filter((item): item is string => Boolean(item));
    if (messages.length) return messages.join("; ");
  }
  if (typeof value?.message === "string") return value.message;
  return fallback;
}
