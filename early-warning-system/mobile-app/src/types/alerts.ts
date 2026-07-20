/** `GET /api/alerts/latest` response (`notifications_api.py`) — real broadcast history, not synthetic. */
export interface LatestAlertResponse {
  ok: boolean;
  source: "alert_broadcasts" | "none" | "empty";
  message?: string;
  city?: string;
  hazard_type?: "air" | "heat" | "respiratory_surge";
  level?: string;
  severity_level?: string;
  aqi_level?: string;
  heat_headline_display?: string;
  timestamp?: string;
  total_recipients?: number;
  delivery_results?: Record<string, { sent: number; failed: number }>;
}
