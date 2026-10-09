import type { AlertLevel } from "@/constants/brand";

/**
 * Same synthetic tiering as `displayAlerts(pm25)` in `frontend/index.html`:
 * compares live PM2.5 to the operator-configured threshold (from
 * `GET /api/runtime-config` -> `dashboard.pm25_alert_threshold_ugm3`).
 *
 * This is a client-side approximation for the "Recent alerts" card, distinct
 * from the real delivery history at `GET /api/auth/notification-inbox`
 * (added in a later feature) and the real broadcast summary at
 * `GET /api/alerts/latest`.
 */
export function alertLevelFromPm25(
  pm25: number | null | undefined,
  thresholdUgM3: number,
): AlertLevel {
  if (typeof pm25 !== "number" || Number.isNaN(pm25)) return "NO DATA";
  if (pm25 > thresholdUgM3 + 35) return "HIGH";
  if (pm25 > thresholdUgM3) return "MODERATE";
  return "LOW";
}
