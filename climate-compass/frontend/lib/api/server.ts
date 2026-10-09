import "server-only";

import { cookies } from "next/headers";
import { ApiError, apiErrorMessage } from "./error";

const DEFAULT_FASTAPI_URL = "http://127.0.0.1:8000";

export function fastApiUrl(path: string) {
  const base = (process.env.FASTAPI_URL || DEFAULT_FASTAPI_URL).replace(
    /\/$/,
    "",
  );
  return `${base}/${path.replace(/^\/+/, "")}`;
}

export async function serverApi<T>(
  path: string,
  init: RequestInit & { includeSession?: boolean } = {},
): Promise<T> {
  const { includeSession = false, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);
  headers.set("Accept", "application/json");

  if (includeSession) {
    const cookieStore = await cookies();
    const token = cookieStore.get("cc_registrant_token")?.value;
    const adminSession = cookieStore.get("ew_admin_session")?.value;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (adminSession) headers.set("Cookie", `ew_admin_session=${adminSession}`);
  }

  const response = await fetch(fastApiUrl(path), {
    ...requestInit,
    headers,
    cache: requestInit.cache ?? "no-store",
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new ApiError(
      apiErrorMessage(payload, `FastAPI request failed (${response.status})`),
      response.status,
      payload,
    );
  }
  return payload as T;
}
