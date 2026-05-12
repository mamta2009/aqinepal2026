"""Mongo-backed operator dashboard settings (public SPA reads via /api/runtime-config)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

SETTINGS_COLL = "app_dashboard_settings"
GLOBAL_DOC_ID = "global_dashboard_v1"

# Align with facility self-service PM2.5 bounds in notifications_api.
DEFAULT_PM25_ALERT_THRESHOLD = 150.0
_MIN_PM25 = 5.0
_MAX_PM25 = 600.0


async def ensure_dashboard_settings_indexes(db: Any) -> None:
    await db[SETTINGS_COLL].create_index([("updated_at", -1)])


def _clamp_pm25(v: float) -> float:
    if v != v:
        return DEFAULT_PM25_ALERT_THRESHOLD
    return float(max(_MIN_PM25, min(_MAX_PM25, v)))


async def get_dashboard_pm25_alert_threshold(db: Any) -> float:
    doc = await db[SETTINGS_COLL].find_one({"_id": GLOBAL_DOC_ID})
    if not doc:
        return DEFAULT_PM25_ALERT_THRESHOLD
    raw = doc.get("pm25_alert_threshold_ugm3")
    if isinstance(raw, (int, float)) and raw == raw:
        return _clamp_pm25(float(raw))
    return DEFAULT_PM25_ALERT_THRESHOLD


async def set_dashboard_pm25_alert_threshold(db: Any, value: float) -> float:
    clamped = _clamp_pm25(value)
    await db[SETTINGS_COLL].update_one(
        {"_id": GLOBAL_DOC_ID},
        {
            "$set": {
                "pm25_alert_threshold_ugm3": clamped,
                "updated_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )
    return clamped
