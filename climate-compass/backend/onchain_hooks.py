"""
Bridge product events to ``onchain_logger.BlockchainLogger`` and persist audit rows for operators.

Anchors are written to MongoDB ``onchain_anchor_log`` (admin-only reads). Polygon txs only fire when
``POLYGON_ONCHAIN_LOG`` is enabled and the process has a funded signer.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Mapping, Optional

logger = logging.getLogger(__name__)


def _tx_logger() -> Any:
    try:
        import main as app_main

        return getattr(app_main, "onchain_tx_logger", None)
    except Exception:  # noqa: BLE001
        return None


def risk_score_from_alert_level(level: str) -> float:
    m = {
        "LOW": 25.0,
        "MODERATE": 50.0,
        "HIGH": 75.0,
        "SEVERE": 100.0,
    }
    return float(m.get(str(level).strip().upper(), 50.0))


def _pm25_for_air_chain(
    aq_payload: Optional[Mapping[str, Any]], aqi_value: int | float, alert_level: str
) -> tuple[float, float]:
    pm25: float
    if aq_payload and isinstance(aq_payload, Mapping):
        raw = aq_payload.get("pm25_ug_m3")
        if raw is not None:
            try:
                pm25 = float(raw)
            except (TypeError, ValueError):
                pm25 = float(aqi_value)
        else:
            pm25 = float(aqi_value)
    else:
        pm25 = float(aqi_value)
    risk = risk_score_from_alert_level(alert_level)
    return pm25, risk


async def ensure_onchain_anchor_indexes(db: Any) -> None:
    try:
        coll = db.onchain_anchor_log
        await coll.create_index("timestamp")
        await coll.create_index([("event_type", 1), ("timestamp", -1)])
    except Exception as exc:  # noqa: BLE001
        logger.warning("onchain_anchor_log indexes: %s", exc)


async def _persist(
    db: Any,
    *,
    event_type: str,
    source: str,
    detail: dict[str, Any],
    chain: Optional[dict[str, Any]],
    skipped_reason: Optional[str] = None,
    error: Optional[str] = None,
) -> None:
    if db is None:
        return
    doc: dict[str, Any] = {
        "event_type": event_type,
        "source": source,
        "timestamp": datetime.utcnow(),
        "detail": detail,
    }
    if skipped_reason:
        doc["skipped_reason"] = skipped_reason
    if error:
        doc["error"] = error[:2000]
    if chain:
        doc["tx_hash"] = chain.get("tx_hash")
        doc["event_hash"] = chain.get("event_hash")
        doc["explorer_url"] = chain.get("explorer_url")
    try:
        await db.onchain_anchor_log.insert_one(doc)
    except Exception as exc:  # noqa: BLE001
        logger.warning("onchain_anchor_log insert failed: %s", exc)


async def anchor_air_alert(
    db: Any,
    *,
    city: str,
    alert_level: str,
    pm25: float,
    risk_score: float,
    source: str,
    facility_id: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    lg = _tx_logger()
    detail = {
        "city": city,
        "alert_level": alert_level,
        "pm25": pm25,
        "risk_score": risk_score,
        "facility_id": facility_id or "general",
    }
    if lg is None or not getattr(lg, "enable", False):
        await _persist(
            db,
            event_type="ALERT",
            source=source,
            detail=detail,
            chain=None,
            skipped_reason="polygon_onchain_log_disabled_or_logger_unavailable",
        )
        return None
    try:
        result = lg.log_alert(city, alert_level, pm25, risk_score, facility_id)
        await _persist(db, event_type="ALERT", source=source, detail=detail, chain=result)
        return result
    except Exception as exc:  # noqa: BLE001
        logger.warning("anchor_air_alert: %s", exc)
        await _persist(
            db,
            event_type="ALERT",
            source=source,
            detail=detail,
            chain=None,
            error=str(exc),
        )
        return None


async def anchor_air_alert_from_payload(
    db: Any,
    *,
    city: str,
    alert_level: str,
    aqi_value: int | float,
    aq_payload: Optional[Mapping[str, Any]],
    source: str,
) -> Optional[dict[str, Any]]:
    pm25, risk = _pm25_for_air_chain(aq_payload, aqi_value, alert_level)
    return await anchor_air_alert(
        db,
        city=city,
        alert_level=alert_level,
        pm25=pm25,
        risk_score=risk,
        source=source,
        facility_id=None,
    )


async def anchor_heat_alert(
    db: Any,
    *,
    city: str,
    heat_level: str,
    temp_display: str,
    source: str,
) -> Optional[dict[str, Any]]:
    """
    Heat advisories use `log_action` (building blocks have no separate heat-alert payload).
    facility_id is scoped as ``city:<key>`` for traceability.
    """
    lg = _tx_logger()
    fid = f"city:{city}"
    detail = {"city": city, "heat_level": heat_level, "temp_display": temp_display}
    if lg is None or not getattr(lg, "enable", False):
        await _persist(
            db,
            event_type="HEAT_ALERT",
            source=source,
            detail=detail,
            chain=None,
            skipped_reason="polygon_onchain_log_disabled_or_logger_unavailable",
        )
        return None
    try:
        body = f"heat_level={heat_level}; temp={temp_display}"
        result = lg.log_action(fid, "heat_readiness_alert", True, body)
        await _persist(db, event_type="HEAT_ALERT", source=source, detail=detail, chain=result)
        return result
    except Exception as exc:  # noqa: BLE001
        logger.warning("anchor_heat_alert: %s", exc)
        await _persist(
            db,
            event_type="HEAT_ALERT",
            source=source,
            detail=detail,
            chain=None,
            error=str(exc),
        )
        return None


async def anchor_facility_action(
    db: Any,
    *,
    facility_id: str,
    action_type: str,
    facility_site: Optional[str],
    details: Optional[str],
    action_log_id: str,
) -> Optional[dict[str, Any]]:
    lg = _tx_logger()
    detail = {
        "facility_id": facility_id,
        "action_type": action_type,
        "facility_site": facility_site,
        "action_log_id": action_log_id,
    }
    desc = " | ".join(
        x for x in [facility_site, (details or "").strip()[:500]] if x
    )
    if lg is None or not getattr(lg, "enable", False):
        await _persist(
            db,
            event_type="ACTION",
            source="post_action_log",
            detail=detail,
            chain=None,
            skipped_reason="polygon_onchain_log_disabled_or_logger_unavailable",
        )
        return None
    try:
        result = lg.log_action(facility_id, action_type, True, desc or action_type)
        await _persist(
            db,
            event_type="ACTION",
            source="post_action_log",
            detail=detail,
            chain=result,
        )
        return result
    except Exception as exc:  # noqa: BLE001
        logger.warning("anchor_facility_action: %s", exc)
        await _persist(
            db,
            event_type="ACTION",
            source="post_action_log",
            detail=detail,
            chain=None,
            error=str(exc),
        )
        return None


async def anchor_outcome_measurement(
    db: Any,
    *,
    facility_id: str,
    day: str,
    respiratory_cases: int,
    severe_cases: int,
    source: str = "admin_outcome",
    facility_display_name: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    lg = _tx_logger()
    detail: dict[str, Any] = {
        "facility_id": facility_id,
        "date": day,
        "respiratory_cases": respiratory_cases,
        "severe_cases": severe_cases,
    }
    if facility_display_name and str(facility_display_name).strip():
        detail["facility_display_name"] = str(facility_display_name).strip()
    if lg is None or not getattr(lg, "enable", False):
        await _persist(
            db,
            event_type="OUTCOME",
            source=source,
            detail=detail,
            chain=None,
            skipped_reason="polygon_onchain_log_disabled_or_logger_unavailable",
        )
        return None
    try:
        result = lg.log_outcome(facility_id, day, respiratory_cases, severe_cases)
        await _persist(db, event_type="OUTCOME", source=source, detail=detail, chain=result)
        return result
    except Exception as exc:  # noqa: BLE001
        logger.warning("anchor_outcome_measurement: %s", exc)
        await _persist(
            db,
            event_type="OUTCOME",
            source=source,
            detail=detail,
            chain=None,
            error=str(exc),
        )
        return None


async def anchor_admin_smoke_touch(db: Any) -> Optional[dict[str, Any]]:
    """
    Single ``log_action`` for operators to verify Polygon wiring (testnet or mainnet).
    **Spend POL/MATIC gas** when ``POLYGON_ONCHAIN_LOG`` is enabled — use Amoy first.
    """
    iso = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    lg = _tx_logger()
    detail: dict[str, Any] = {"purpose": "operator_smoke_test", "requested_at": iso}
    facility_scope = "ew_admin_console"
    if lg is None or not getattr(lg, "enable", False):
        await _persist(
            db,
            event_type="SMOKE_TEST",
            source="admin_smoke_touch",
            detail=detail,
            chain=None,
            skipped_reason="polygon_onchain_log_disabled_or_logger_unavailable",
        )
        return None
    try:
        body = f"EarlyWarning admin smoke test @ {iso}"
        result = lg.log_action(facility_scope, "smoke_test_touch", True, body)
        await _persist(
            db,
            event_type="SMOKE_TEST",
            source="admin_smoke_touch",
            detail=detail,
            chain=result,
        )
        return result
    except Exception as exc:  # noqa: BLE001
        logger.warning("anchor_admin_smoke_touch: %s", exc)
        await _persist(
            db,
            event_type="SMOKE_TEST",
            source="admin_smoke_touch",
            detail=detail,
            chain=None,
            error=str(exc),
        )
        return None
