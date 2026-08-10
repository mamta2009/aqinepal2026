import { Platform } from "react-native";

/**
 * Default API origin when EXPO_PUBLIC_API_BASE_URL isn't set.
 * Android emulators can't reach the host machine via `127.0.0.1` (they need
 * the special `10.0.2.2` alias), so pick a sane per-platform fallback.
 */
function resolveDefaultApiBaseUrl(): string {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000";
  }
  return "http://127.0.0.1:8000";
}

/**
 * Rewrite host-loopback URLs for Android emulators.
 * `.env` often uses `127.0.0.1` / `localhost` (fine for iOS simulator / web),
 * but those addresses point at the emulator itself on Android — map them to
 * `10.0.2.2` so the app can reach the FastAPI backend on the host machine.
 */
function resolveApiBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");
  if (Platform.OS !== "android") {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      url.hostname = "10.0.2.2";
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    // Keep the original string if it isn't a valid absolute URL.
  }

  return trimmed;
}

export const API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL || resolveDefaultApiBaseUrl(),
);

/** Public Next.js site origin for privacy policy and other web pages. */
export const SITE_URL = (
  process.env.EXPO_PUBLIC_SITE_URL || "https://climatecompass.intelladapt.ai"
).replace(/\/+$/, "");

export const API_TIMEOUT_MS = 15_000;
