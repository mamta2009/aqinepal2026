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

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || resolveDefaultApiBaseUrl()
).replace(/\/+$/, "");

export const API_TIMEOUT_MS = 15_000;
