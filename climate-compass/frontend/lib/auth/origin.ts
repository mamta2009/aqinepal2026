import type { NextRequest } from "next/server";

/** Allow same-origin mutations; reject cross-origin state changes. */
export function isSameOriginMutation(request: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export function rejectCrossOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin !== request.nextUrl.origin);
}
