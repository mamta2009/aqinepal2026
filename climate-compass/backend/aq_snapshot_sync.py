"""
Periodic air-quality snapshots persisted to MongoDB (files.zip-style history layer).

When ``AQ_SNAPSHOT_SYNC_ENABLED`` is set, an APScheduler job refreshes one document per
configured city in ``air_quality_snapshots``. Prefer WAQI station feed when
``aqicn_station_uid`` is set on the city; otherwise reuse the main resolver
(``air_quality_current_waqi_then_rapid``).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any

import external_integrations
from cities_config import CITIES_CONFIG

logger = logging.getLogger(__name__)


async def ensure_operational_data_indexes(db: Any) -> None:
    try:
        await db.air_quality_snapshots.create_index("city", unique=True)
        await db.air_quality_snapshots.create_index("synced_at")
        await db.action_logs.create_index("facility_id")
        await db.action_logs.create_index("contact_id")
        await db.action_logs.create_index("timestamp")
        logger.info("MongoDB operational indexes (AQ snapshots, action_logs) ensured")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Operational index creation: %s", exc)


async def _fetch_payload_for_city(city: str, cfg: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    lat_v, lon_v = float(cfg["lat"]), float(cfg["lon"])
    # Use the same WAQI map/bounds → WeatherAPI path as live /api/air-quality/current.
    # Skip broken WAQI /feed/station calls that only delay sync.
    source, payload = await external_integrations.air_quality_current_waqi_then_rapid(
        lat=lat_v,
        lon=lon_v,
        waqi_city_fallback=city,
    )
    return source, payload


async def sync_all_air_quality_snapshots(db: Any) -> dict[str, Any]:
    """Upsert latest reading per city into ``air_quality_snapshots``."""
    now = datetime.utcnow()
    results: dict[str, Any] = {"ok": True, "updated": 0, "errors": []}
    for city, cfg in CITIES_CONFIG.items():
        try:
            source, aq = await _fetch_payload_for_city(city, cfg)
            station_uid = (cfg.get("aqicn_station_uid") or "").strip() or None
            doc = {
                "city": city,
                "synced_at": now,
                "source": source,
                "aqicn_station_uid": station_uid,
                "air_quality": aq,
                "pm25_ug_m3": aq.get("pm25_ug_m3"),
                "aqi": aq.get("aqi"),
            }
            await db.air_quality_snapshots.update_one(
                {"city": city},
                {"$set": doc},
                upsert=True,
            )
            results["updated"] += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("AQ snapshot sync failed for %s: %s", city, exc)
            results["errors"].append({"city": city, "error": str(exc)[:500]})
    if results["errors"]:
        results["ok"] = False
    return results


def aq_snapshot_sync_enabled() -> bool:
    return (os.getenv("AQ_SNAPSHOT_SYNC_ENABLED") or "").strip().lower() in ("1", "true", "yes")


def aq_snapshot_sync_hours() -> float:
    try:
        h = float((os.getenv("AQ_SNAPSHOT_SYNC_HOURS") or "6").strip())
    except ValueError:
        return 6.0
    return max(0.25, min(168.0, h))
