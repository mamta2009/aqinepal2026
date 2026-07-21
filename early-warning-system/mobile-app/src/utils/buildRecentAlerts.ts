import { alertLevelFromPm25 } from "@/utils/alertLevel";
import { formatRelativeTimestamp } from "@/utils/format";

import type { LatestAlertResponse } from "@/types/alerts";

export interface RecentAlertItem {
  id: string;
  level: string;
  time: string;
  message: string;
}

/**
 * Builds the Recent Alerts feed: same synthetic rows as web `displayAlerts()`,
 * plus the latest broadcast summary from `GET /api/alerts/latest`.
 */
export function buildRecentAlerts(options: {
  cityLabel: string;
  pm25: number | null | undefined;
  thresholdUgM3: number;
  latestAlert?: LatestAlertResponse;
}): RecentAlertItem[] {
  const { cityLabel, pm25, thresholdUgM3, latestAlert } = options;
  const level = alertLevelFromPm25(pm25, thresholdUgM3);
  const rows: RecentAlertItem[] = [];

  if (level === "NO DATA") {
    rows.push({
      id: "synthetic-pm25",
      level: "INFO",
      time: "Just now",
      message: `${cityLabel}: no PM2.5 from API yet.`,
    });
  } else if (level === "HIGH") {
    rows.push({
      id: "synthetic-pm25",
      level: "HIGH",
      time: "Just now",
      message: `${cityLabel}: PM2.5 ${Math.round(pm25 as number)} µg/m³ (threshold ${thresholdUgM3}). Elevated respiratory load possible.`,
    });
  } else if (level === "MODERATE") {
    rows.push({
      id: "synthetic-pm25",
      level: "MODERATE",
      time: "Just now",
      message: `${cityLabel}: PM2.5 ${Math.round(pm25 as number)} µg/m³ exceeds alert threshold (${thresholdUgM3}). Monitor.`,
    });
  } else {
    rows.push({
      id: "synthetic-pm25",
      level: "LOW",
      time: "Just now",
      message: `${cityLabel}: PM2.5 ${Math.round(pm25 as number)} µg/m³ below threshold (${thresholdUgM3}).`,
    });
  }

  rows.push({
    id: "facility-info",
    level: "INFO",
    time: "Facility",
    message: `${cityLabel}: facility buttons post to Mongo only after OTP login (registration email → JWT). Pending partner approval blocks access.`,
  });

  rows.push({
    id: "threshold-ref",
    level: "INFO",
    time: "Reference",
    message: `PM2.5 alert line (${thresholdUgM3} µg/m³): set by operator and stored on the server; users facility thresholds are separate.`,
  });

  if (latestAlert?.ok && latestAlert.source === "alert_broadcasts") {
    const broadcastCity = latestAlert.city?.trim();
    // Only surface broadcasts that belong to the selected city (API filters by
    // `?city=`, but guard here if a stale/global payload is passed in).
    if (!broadcastCity || broadcastCity === cityLabel) {
      rows.push({
        id: "latest-broadcast",
        level: latestAlert.severity_level ?? latestAlert.level ?? "INFO",
        time: formatRelativeTimestamp(latestAlert.timestamp),
        message: `Last broadcast to ${broadcastCity ?? cityLabel}: ${latestAlert.hazard_type ?? "air"} alert, ${latestAlert.total_recipients ?? 0} recipients.`,
      });
    }
  } else if (latestAlert) {
    rows.push({
      id: "latest-broadcast",
      level: "INFO",
      time: "System",
      message:
        latestAlert.message ?? `No broadcast history yet for ${cityLabel}.`,
    });
  }

  return rows;
}
