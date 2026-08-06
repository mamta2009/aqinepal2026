import { ApiError, apiErrorMessage } from "./error";
import { apiUrl } from "./api-url";

type BrowserRequest = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | unknown[];
};

export async function browserApi<T>(
  path: string,
  init: BrowserRequest = {},
): Promise<T> {
  const body =
    init.body &&
    typeof init.body === "object" &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof URLSearchParams) &&
    !(init.body instanceof Blob)
      ? JSON.stringify(init.body)
      : (init.body as BodyInit | null | undefined);

  const response = await fetch(apiUrl(path), {
    ...init,
    body,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body && typeof body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new ApiError(
      apiErrorMessage(payload, `Request failed (${response.status})`),
      response.status,
      payload,
    );
  }

  return payload as T;
}
