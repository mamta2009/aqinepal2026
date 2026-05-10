"""
Registration, broadcast alerts, webhooks, and analytics (ported from notification_cursor.zip).
Requires MongoDB and optional Twilio / Resend configuration.

Architecture diagram (on-disk; embedded on **`/guides`**):
``docs/tech/NOTIFICATION_FLOW_DIAGRAM.svg``
"""

from __future__ import annotations

import logging
import os
import secrets
import asyncio
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Literal, Optional

from pathlib import Path

import httpx
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr, Field

import db_state
import external_integrations
import facility_auth
import registrant_auth
import twilio_notify
from cities_config import CITIES_CONFIG
from notification_auth import (
    require_notification_api_key,
    require_registration_directory_secret,
    twilio_webhook_form,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["notifications"])

_BACKEND_ROOT = Path(__file__).resolve().parent
_REGISTRATION_HTML = _BACKEND_ROOT.parent / "landing" / "registration_portal.html"
_CONTACTS_DIR_HTML = _BACKEND_ROOT.parent / "landing" / "contacts_directory.html"

RESEND_API_URL = "https://api.resend.com/emails"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class ContactType(str, Enum):
    HEALTH_WORKER = "health_worker"
    PARENT = "parent"
    ADMIN = "admin"
    GOVERNMENT = "government"


class NotificationChannel(str, Enum):
    SMS = "sms"
    WHATSAPP = "whatsapp"
    EMAIL = "email"


class AlertLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    SEVERE = "SEVERE"


class ContactRegistration(BaseModel):
    name: str
    email: EmailStr
    phone_number: str
    whatsapp_number: Optional[str] = None
    contact_type: ContactType
    facility_id: Optional[str] = None
    facility_name: Optional[str] = Field(
        None,
        description="Single-line or multi-line / semicolon-separated names; merged with ``facility_names``.",
    )
    facility_names: Optional[list[str]] = Field(
        None,
        description="Facility names for one enrollee covering multiple sites.",
    )
    city: Optional[str] = Field(
        None,
        description="Legacy single municipality key from ``CITIES_CONFIG``; merged with ``cities``.",
    )
    cities: Optional[list[str]] = Field(
        None,
        description="Coverage municipalities (keys from ``CITIES_CONFIG``).",
    )
    preferred_channels: list[NotificationChannel]
    language: str = "en"
    consent_given: bool = False
    consent_timestamp: Optional[datetime] = None
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Dashboard login password (bcrypt-stored server-side).",
    )
    environmental_topics: Optional[list[str]] = Field(
        None,
        description=(
            "Hazard subscriptions for municipal evaluate/broadcast pushes: ``air``, ``heat``. "
            "Omit or null to default to both. Empty list declines environmental SMS/email pushes."
        ),
    )


def _validated_environment_topics(raw: Optional[list[str]], *, default_both: bool) -> list[str]:
    allowed = {"air", "heat"}
    if raw is None:
        return ["air", "heat"] if default_both else []
    out: list[str] = []
    for x in raw:
        xl = str(x).strip().lower()
        if xl in allowed and xl not in out:
            out.append(xl)
    return out


def _normalize_facility_names(
    raw_names: Optional[list[str]],
    legacy_line: Optional[str],
) -> tuple[list[str], str | None]:
    names: list[str] = []
    if raw_names:
        for item in raw_names:
            t = str(item).strip()
            if t and t not in names:
                names.append(t)
    legacy = str(legacy_line).strip() if legacy_line else ""
    if legacy:
        for sep_line in legacy.replace(";", "\n").replace("\r", "").split("\n"):
            t = sep_line.strip()
            if t and t not in names:
                names.append(t)
    summary = " · ".join(names) if names else None
    return names, summary


def _normalize_city_list(
    raw_cities: Optional[list[str]],
    legacy_city: Optional[str],
) -> tuple[list[str], str | None]:
    out: list[str] = []
    if raw_cities:
        for c in raw_cities:
            s = str(c).strip()
            if s not in CITIES_CONFIG:
                raise HTTPException(
                    status_code=400,
                    detail=f"Municipality must be one of: {', '.join(CITIES_CONFIG.keys())}",
                )
            if s not in out:
                out.append(s)
    if legacy_city and str(legacy_city).strip():
        s = str(legacy_city).strip()
        if s not in CITIES_CONFIG:
            raise HTTPException(
                status_code=400,
                detail=f"city must be one of: {', '.join(CITIES_CONFIG.keys())}",
            )
        if s not in out:
            out.append(s)
    primary = out[0] if out else None
    return out, primary


def _coverage_municipality_clause(municipality: str) -> dict[str, Any]:
    """Contacts store either legacy ``city`` or multi-select ``cities`` (Mongo matches array element)."""
    return {"$or": [{"city": municipality}, {"cities": municipality}]}


def _verification_resend_cooldown_seconds() -> int:
    try:
        return max(
            15,
            min(3600, int((os.getenv("VERIFICATION_RESEND_COOLDOWN_SECONDS") or "60").strip())),
        )
    except ValueError:
        return 60


RESEND_VERIFICATION_GENERIC_MESSAGE = (
    "If this email has a pending registration, a verification code was sent to your "
    "selected channels. Check spam for email and confirm Resend domain setup; SMS/WhatsApp work if enabled."
)


class VerifyContactIn(BaseModel):
    contact_id: str
    verification_code: str = Field(..., min_length=4, max_length=12)


class ResendVerificationIn(BaseModel):
    """Request another registration verification code by email address (pending contacts only)."""

    email: EmailStr


class RegistrantLoginIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class RegistrantChangePasswordIn(BaseModel):
    old_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class FacilityLoginEmailIn(BaseModel):
    email: EmailStr


class FacilityTokenExchangeIn(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=4, max_length=16)


class ContactApprovalPatchIn(BaseModel):
    approval_status: Literal["approved", "pending", "revoked"]
# Destructive local-only reset; requires ALLOW_DEV_REGISTRATION_DB_RESET=true
_DEV_REGISTRATION_RESET_PHRASE = "DELETE ALL CONTACTS"


class DevRegistrationResetIn(BaseModel):
    confirmation_phrase: str = Field(
        ...,
        min_length=1,
        max_length=120,
        description=f"Must match exactly: {_DEV_REGISTRATION_RESET_PHRASE!r}",
    )


class ConsentUpdate(BaseModel):
    preferred_channels: list[NotificationChannel]
    consent_given: bool
    environmental_topics: Optional[list[str]] = Field(
        None,
        description="If set: which municipal hazard alerts to receive: air, heat. Empty list unsubscribes from both.",
    )


class NotificationRequest(BaseModel):
    recipient_id: str
    channel: NotificationChannel
    subject: Optional[str] = None
    message: str
    alert_level: Optional[AlertLevel] = None


class AlertBroadcast(BaseModel):
    city: str
    aqi_value: int
    aqi_level: AlertLevel
    recipient_type: str = Field(
        "health_worker",
        description="health_worker | parent | admin | government | all",
    )
    message_override: Optional[str] = None
    filter_city: Optional[str] = Field(
        None,
        description="Only contacts covering this municipality (legacy ``city`` or ``cities`` list).",
    )


class AlertEvaluateIn(BaseModel):
    """Fetch current air quality for a configured city and optionally broadcast."""

    city: str
    recipient_type: str = Field(
        "health_worker",
        description="health_worker | parent | admin | government | all",
    )
    filter_city: Optional[str] = Field(
        None,
        description="Defaults to ``city`` so subscribers in that municipality are targeted.",
    )
    min_level: AlertLevel = Field(
        AlertLevel.MODERATE,
        description="Skip broadcast when the computed level is below this (unless forcing).",
    )
    force: bool = Field(
        False,
        description="Ignore cooldown window (still respects min_level unless you lower it).",
    )


class HeatEvaluateIn(AlertEvaluateIn):
    """Same fields as evaluate-air; uses ``effective_temp_c`` for heat tiers."""


_ALERT_LEVEL_RANK: dict[str, int] = {
    "LOW": 0,
    "MODERATE": 1,
    "HIGH": 2,
    "SEVERE": 3,
}


def _contacts_env_topic_clause(topic: str) -> dict[str, Any]:
    """Contacts without ``environmental_topics`` receive legacy behavior (both air + heat)."""
    t = str(topic).strip().lower()
    return {
        "$or": [
            {"environmental_topics": {"$exists": False}},
            {"environmental_topics": None},
            {"environmental_topics": t},
            {"environmental_topics": {"$in": [t]}},
        ]
    }


def eligible_broadcast_contact_clause() -> dict[str, Any]:
    """
    Base filter for outbound alert recipients (SMS / WhatsApp / email broadcasts).

    Excludes revoked and explicitly pending approvals. Documents without ``approval_status``
    remain eligible until backfilled so older deployments behave like pre-governance demos.
    """
    return {
        "active": True,
        "consent_given": True,
        "verification_status": "verified",
        "approval_status": {"$nin": ["revoked", "pending"]},
    }


def _heat_effective_temperature_c(heat_blob: dict[str, Any]) -> float:
    ef = heat_blob.get("effective_temp_c")
    if isinstance(ef, (int, float)) and ef == ef:
        return float(ef)
    tc = heat_blob.get("temp_c")
    if isinstance(tc, (int, float)) and tc == tc:
        return float(tc)
    raise ValueError("insufficient_heat_metrics")


def _heat_threshold_degrees_c() -> tuple[float, float, float]:
    try:
        mod = float((os.getenv("HEAT_THRESHOLD_MODERATE_C") or "30").strip())
        hi = float((os.getenv("HEAT_THRESHOLD_HIGH_C") or "35").strip())
        sev = float((os.getenv("HEAT_THRESHOLD_SEVERE_C") or "40").strip())
    except ValueError:
        mod, hi, sev = 30.0, 35.0, 40.0
    if not (mod < hi < sev):
        return 30.0, 35.0, 40.0
    return mod, hi, sev


def _heat_temperature_and_level(heat_blob: dict[str, Any]) -> tuple[int, AlertLevel]:
    t_eff = _heat_effective_temperature_c(heat_blob)
    mod_c, hi_c, sev_c = _heat_threshold_degrees_c()
    display = int(round(min(55.0, max(-15.0, t_eff))))

    if t_eff >= sev_c:
        return display, AlertLevel.SEVERE
    if t_eff >= hi_c:
        return display, AlertLevel.HIGH
    if t_eff >= mod_c:
        return display, AlertLevel.MODERATE
    return display, AlertLevel.LOW


def _eval_cooldown_minutes_for_hazard(hazard: str) -> int:
    haz = str(hazard or "air").strip().lower()
    if haz == "heat":
        raw = (os.getenv("HEAT_EVAL_COOLDOWN_MINUTES") or "").strip()
        if raw:
            try:
                return max(0, int(raw))
            except ValueError:
                pass
        return _eval_cooldown_minutes()
    return _eval_cooldown_minutes()


def _air_quality_index_and_level(aq: dict[str, Any]) -> tuple[int, AlertLevel]:
    """Derive a headline index and alert level from normalized integration payload."""
    pm_raw = aq.get("pm25_ug_m3")
    pm25: float | None = None
    if isinstance(pm_raw, (int, float)):
        v = float(pm_raw)
        if v == v:
            pm25 = v
    aqi_raw = aq.get("aqi")
    aqi_num: int | None = None
    if isinstance(aqi_raw, (int, float)):
        aqi_num = int(round(float(aqi_raw)))

    if pm25 is not None:
        display = aqi_num if aqi_num is not None else min(
            500, int(max(0.0, min(500.0, pm25 * 4.0)))
        )
        if pm25 > 150.0:
            return display, AlertLevel.SEVERE
        if pm25 > 100.0:
            return display, AlertLevel.HIGH
        if pm25 > 35.0:
            return display, AlertLevel.MODERATE
        return display, AlertLevel.LOW

    if aqi_num is not None:
        if aqi_num >= 201:
            return aqi_num, AlertLevel.SEVERE
        if aqi_num >= 151:
            return aqi_num, AlertLevel.HIGH
        if aqi_num >= 101:
            return aqi_num, AlertLevel.MODERATE
        return aqi_num, AlertLevel.LOW

    raise ValueError("insufficient_air_quality_metrics")


def _eval_cooldown_minutes() -> int:
    try:
        return max(0, int((os.getenv("ALERT_EVAL_COOLDOWN_MINUTES") or "60").strip()))
    except ValueError:
        return 60


async def _cooldown_allows_broadcast(db: Any, city: str, force: bool, hazard: str = "air") -> bool:
    if force:
        return True
    haz = str(hazard or "air").strip().lower()
    mins = _eval_cooldown_minutes_for_hazard(haz)
    if mins <= 0:
        return True
    coll = db.alert_evaluation_cooldown
    doc = await coll.find_one({"city": city, "hazard": haz})
    if not doc:
        return True
    last = doc.get("last_eval_broadcast_at")
    if not isinstance(last, datetime):
        return True
    return datetime.utcnow() - last >= timedelta(minutes=mins)


async def _mark_eval_broadcast(db: Any, city: str, hazard: str = "air") -> None:
    haz = str(hazard or "air").strip().lower()
    await db.alert_evaluation_cooldown.update_one(
        {"city": city, "hazard": haz},
        {"$set": {"last_eval_broadcast_at": datetime.utcnow()}},
        upsert=True,
    )


def _dev_registration_reset_env_name() -> str:
    return "ALLOW_DEV_REGISTRATION_DB_RESET"


def _parse_env_boolean_debug(raw: str | None) -> tuple[bool, str]:
    """
    Parse common truthy strings; strip BOM/quotes for ``.env`` quirks.
    Returns (ok, display_slice) where display_slice is safe to echo to the client.
    """
    if raw is None:
        return False, ""
    s = raw.strip()
    if s.startswith("\ufeff"):
        s = s[1:].strip()
    s = s.strip('"').strip("'")
    sl = s.lower()
    ok = sl in ("1", "true", "yes", "on", "enabled", "enable")
    return ok, s[:160]


def _dev_registration_reset_env_state() -> tuple[bool, str]:
    raw = os.getenv(_dev_registration_reset_env_name())
    return _parse_env_boolean_debug(raw)


def _allow_dev_registration_db_reset() -> bool:
    """When true, exposes dev routes to wipe ``contacts`` + ``consent_records`` for QA."""
    ok, _ = _dev_registration_reset_env_state()
    return ok


def _strip_env_secret(raw: str | None) -> str:
    """Normalize values from `.env`: BOM, stray quotes, whitespace (avoids Bearer auth mismatches)."""
    if raw is None:
        return ""
    s = raw.strip()
    if s.startswith("\ufeff"):
        s = s[1:].strip()
    return s.strip('"').strip("'")


def _resend_api_key_effective() -> str:
    return _strip_env_secret(os.getenv("RESEND_API_KEY"))


def _resend_from_effective(default: str = "alerts@early-warning.local") -> str:
    v = _strip_env_secret(os.getenv("RESEND_FROM_EMAIL"))
    return v if v else default


def _resend_configured() -> bool:
    key = _resend_api_key_effective()
    kl = key.lower()
    return bool(key and "paste" not in kl and "your_" not in kl)


def public_resend_email_ready() -> bool:
    """True when this process considers Resend outbound email usable (SPA / health checks)."""
    return _resend_configured()


def _verification_code() -> str:
    return f"{secrets.randbelow(900000) + 100000:06d}"


async def ensure_notification_indexes(db: Any) -> None:
    """Create collections indexes for contacts, logs, webhooks, broadcasts."""
    try:
        await db.contacts.create_index("email", unique=True)
        await db.contacts.create_index("phone_number")
        await db.contacts.create_index("whatsapp_number")
        await db.contacts.create_index("facility_id")
        await db.contacts.create_index("city")
        await db.contacts.create_index("cities")
        await db.contacts.create_index("approval_status")
        try:
            await db.contacts.update_many(
                {"verification_status": "verified", "approval_status": {"$exists": False}},
                {"$set": {"approval_status": "approved"}},
            )
            await db.contacts.update_many(
                {"verification_status": {"$ne": "verified"}, "approval_status": {"$exists": False}},
                {"$set": {"approval_status": "pending"}},
            )
        except Exception:
            pass
        await db.notification_logs.create_index("recipient_id")
        await db.notification_logs.create_index("timestamp")
        await db.notification_logs.create_index("status")
        await db.notification_logs.create_index("twilio_sid")
        await db.inbound_messages.create_index("from_number")
        await db.inbound_messages.create_index("timestamp")
        await db.consent_records.create_index("contact_id")
        await db.consent_records.create_index("timestamp")
        await db.alert_broadcasts.create_index("city")
        await db.alert_broadcasts.create_index("timestamp")
        await db.alert_broadcasts.create_index("hazard_type")
        coll_cd = db.alert_evaluation_cooldown
        try:
            await coll_cd.drop_index("city_1")
        except Exception:
            pass
        try:
            await coll_cd.update_many(
                {"$or": [{"hazard": {"$exists": False}}, {"hazard": None}]},
                {"$set": {"hazard": "air"}},
            )
        except Exception:
            pass
        await coll_cd.create_index([("city", 1), ("hazard", 1)], unique=True)
        logger.info("MongoDB notification indexes ensured")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Notification index creation: %s", exc)


def _twilio_legacy(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "success": bool(result.get("ok")),
        "sid": result.get("sid"),
        "status": "sent" if result.get("ok") else "failed",
        "error": result.get("error"),
    }


async def send_sms(phone_number: str, message: str) -> dict[str, Any]:
    r = await twilio_notify.send_twilio_message_async(
        phone_number, message, channel="sms"
    )
    return _twilio_legacy(r)


async def send_whatsapp(whatsapp_number: str, message: str) -> dict[str, Any]:
    r = await twilio_notify.send_twilio_message_async(
        whatsapp_number, message, channel="whatsapp"
    )
    return _twilio_legacy(r)


async def send_email(to_email: str, subject: str, html_content: str) -> dict[str, Any]:
    key = _resend_api_key_effective()
    from_email = _resend_from_effective()
    if not key:
        return {
            "success": False,
            "status": "failed",
            "error": "resend_not_configured",
        }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {key}"},
                json={
                    "from": from_email,
                    "to": to_email,
                    "subject": subject,
                    "html": html_content,
                },
            )
        if response.status_code == 200:
            return {"success": True, "status": "sent"}
        body_preview = (response.text or "")[:1200]
        logger.warning(
            "Resend rejected email: status=%s to=%s from=%s preview=%s",
            response.status_code,
            to_email,
            from_email,
            body_preview,
        )
        return {
            "success": False,
            "error": body_preview or f"http_{response.status_code}",
            "status": "failed",
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Resend email transport error to %s: %s", to_email, exc)
        return {"success": False, "error": str(exc), "status": "failed"}


async def _dispatch_verification_email(
    db: Any,
    contact_id: ObjectId,
    email: str,
    name: str,
    code: str,
) -> dict[str, Any]:
    html_content = f"""
    <h2>Early Warning System</h2>
    <p>Hi {name},</p>
    <p>Your verification code:</p>
    <h1 style="font-size: 32px; letter-spacing: 5px;">{code}</h1>
    <p style="color: #666; font-size: 12px;">Expires in 24 hours. If you don't see this message, check spam/junk.</p>
    """
    result = await send_email(
        email,
        "Verify your Early Warning registration",
        html_content,
    )
    if result.get("success"):
        await db.notification_logs.insert_one(
            {
                "recipient_id": str(contact_id),
                "channel": "email",
                "recipient": email,
                "type": "verification",
                "status": "sent",
                "timestamp": datetime.utcnow(),
            }
        )
        return {"success": True}
    raw_err = result.get("error") or "resend_send_failed"
    err = raw_err if isinstance(raw_err, str) else str(raw_err)
    logger.warning("Verification email not sent to %s: %s", email, err[:400])
    return {"success": False, "error": err[:500]}


async def _dispatch_verification_sms(
    db: Any,
    contact_id: ObjectId,
    phone_number: str,
    code: str,
) -> dict[str, Any]:
    result = await send_sms(
        phone_number,
        f"Early Warning verification code: {code}. Valid 24 hours.",
    )
    if result.get("success"):
        await db.notification_logs.insert_one(
            {
                "recipient_id": str(contact_id),
                "channel": "sms",
                "recipient": phone_number,
                "type": "verification",
                "status": "sent",
                "twilio_sid": result.get("sid"),
                "timestamp": datetime.utcnow(),
            }
        )
        return {"success": True}
    err = result.get("error") or "sms_failed"
    logger.warning("Verification SMS not sent to %s: %s", phone_number, err)
    return {"success": False, "error": str(err)[:500]}


async def _dispatch_verification_whatsapp(
    db: Any,
    contact_id: ObjectId,
    whatsapp_number: str,
    code: str,
) -> dict[str, Any]:
    result = await send_whatsapp(
        whatsapp_number,
        f"Early Warning verification code: {code}. Valid 24 hours.",
    )
    if result.get("success"):
        await db.notification_logs.insert_one(
            {
                "recipient_id": str(contact_id),
                "channel": "whatsapp",
                "recipient": whatsapp_number,
                "type": "verification",
                "status": "sent",
                "twilio_sid": result.get("sid"),
                "timestamp": datetime.utcnow(),
            }
        )
        return {"success": True}
    err = result.get("error") or "whatsapp_failed"
    logger.warning("Verification WhatsApp not sent to %s: %s", whatsapp_number, err)
    return {"success": False, "error": str(err)[:500]}


async def _dispatch_registration_verification_channels(
    db: Any,
    contact_id: ObjectId,
    *,
    contact_name: str,
    email: str,
    normalized_phone: str,
    normalized_whatsapp: str,
    preferred_channel_values: list[str],
    code: str,
) -> list[str]:
    warnings: list[str] = []
    if "email" in preferred_channel_values:
        if _resend_configured():
            er = await _dispatch_verification_email(
                db, contact_id, email, contact_name, code
            )
            if not er.get("success"):
                warnings.append(
                    f"email_verification_failed:{er.get('error', 'unknown')}"
                )
        else:
            warnings.append("email_verification_skipped_resend_not_configured")
    if "sms" in preferred_channel_values:
        if twilio_notify.twilio_configured():
            sr = await _dispatch_verification_sms(
                db, contact_id, normalized_phone, code
            )
            if not sr.get("success"):
                warnings.append(
                    f"sms_verification_failed:{sr.get('error', 'unknown')}"
                )
        else:
            warnings.append("sms_verification_skipped_twilio_not_configured")
    if "whatsapp" in preferred_channel_values:
        if twilio_notify.twilio_configured():
            wr = await _dispatch_verification_whatsapp(
                db, contact_id, normalized_whatsapp, code
            )
            if not wr.get("success"):
                warnings.append(
                    f"whatsapp_verification_failed:{wr.get('error', 'unknown')}"
                )
        else:
            warnings.append("whatsapp_verification_skipped_twilio_not_configured")
    return warnings


async def _send_facility_login_code(db: Any, doc: dict[str, Any], code: str) -> list[str]:
    """
    Dispatch a short-lived login code for exchanging a facility JWT at the dashboard.
    Reuses the contact's preferred outbound channels.
    """
    warnings: list[str] = []
    contact_id = doc["_id"]
    chans = doc.get("preferred_channels") or []
    name = str(doc.get("name") or "")
    ttl = facility_auth.facility_login_code_ttl_minutes()
    hint = f"Early Warning facility dashboard code: {code}. Valid {ttl} minutes."

    try:
        if "email" in chans:
            if _resend_configured():
                er = await send_email(
                    doc["email"],
                    "Facility dashboard login code",
                    f"<p>{name or 'Hello'},</p><p>{hint}</p>",
                )
                if not er.get("success"):
                    warnings.append(f"email_login_code_failed:{er.get('error', 'unknown')}")
            else:
                warnings.append("email_login_code_skipped_resend_not_configured")
        if "sms" in chans:
            if twilio_notify.twilio_configured():
                result = await send_sms(doc["phone_number"], hint)
                if result.get("success"):
                    await db.notification_logs.insert_one(
                        {
                            "recipient_id": str(contact_id),
                            "channel": "sms",
                            "recipient": doc["phone_number"],
                            "type": "facility_login",
                            "status": "sent",
                            "twilio_sid": result.get("sid"),
                            "timestamp": datetime.utcnow(),
                        }
                    )
                else:
                    warnings.append(f"sms_login_failed:{result.get('error', 'unknown')}")
            else:
                warnings.append("sms_login_code_skipped_twilio_not_configured")
        if "whatsapp" in chans:
            if twilio_notify.twilio_configured():
                result = await send_whatsapp(doc.get("whatsapp_number") or doc["phone_number"], hint)
                if result.get("success"):
                    await db.notification_logs.insert_one(
                        {
                            "recipient_id": str(contact_id),
                            "channel": "whatsapp",
                            "recipient": doc.get("whatsapp_number") or doc["phone_number"],
                            "type": "facility_login",
                            "status": "sent",
                            "twilio_sid": result.get("sid"),
                            "timestamp": datetime.utcnow(),
                        }
                    )
                else:
                    warnings.append(f"whatsapp_login_failed:{result.get('error', 'unknown')}")
            else:
                warnings.append("whatsapp_login_skipped_twilio_not_configured")
    except Exception as exc:  # noqa: BLE001
        logger.exception("facility login code dispatch failed: %s", exc)
        warnings.append(f"facility_login_dispatch_exception:{str(exc)[:200]}")
    return warnings


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------


def _approval_status_after_contact_verified(existing_approval_lower: str) -> str | None:
    """
    Mirrors ``POST /api/contacts/verify``: auto-approved; preserved if already approved/revoked.
    Only returns ``None`` when Mongo should retain the prior approval field.
    """
    auto_apr = facility_auth.auto_approve_verified_contacts()
    if auto_apr:
        return "approved"
    if existing_approval_lower in ("approved", "revoked"):
        return None
    return "pending"


async def persist_contact_registration(
    contact: ContactRegistration,
    *,
    dispatch_verification: bool,
) -> dict[str, Any]:
    """
    Shared insert/update logic for registrants (public ``/register`` vs operator console).

    * ``dispatch_verification=True``: pending email/phone verification + outbound codes (public flow).
    * ``dispatch_verification=False``: mark verified immediately; no OTP dispatch (trusted operator flow).
    """
    db = db_state.require_mongo_db()
    if not contact.phone_number.strip().startswith("+"):
        raise HTTPException(status_code=400, detail="Phone must start with + (E.164)")

    normalized_phone = (
        contact.phone_number.replace(" ", "").replace("-", "")
    )
    normalized_whatsapp = (
        contact.whatsapp_number.replace(" ", "").replace("-", "")
        if contact.whatsapp_number
        else normalized_phone
    )

    norm_facilities, facility_summary = _normalize_facility_names(
        contact.facility_names,
        contact.facility_name,
    )
    norm_cities, primary_city = _normalize_city_list(contact.cities, contact.city)
    if not norm_cities:
        raise HTTPException(
            status_code=400,
            detail="Select at least one municipality / coverage area (use city or cities).",
        )

    existing = await db.contacts.find_one({"email": contact.email})
    contact_id: ObjectId
    resent = False

    if existing:
        if str(existing.get("approval_status") or "").strip().lower() == "revoked":
            raise HTTPException(
                status_code=403,
                detail="This registration has been revoked; restore approval before re-registering.",
            )
        vs0 = str(existing.get("verification_status") or "").strip().lower()
        if vs0 == "verified":
            raise HTTPException(
                status_code=409,
                detail=(
                    "This email is already registered as verified. Delete the contact "
                    "(or archive) if you intend to recreate it, or choose a different email."
                ),
            )

    consent_ts = contact.consent_timestamp or datetime.utcnow()
    topics = _validated_environment_topics(contact.environmental_topics, default_both=True)

    apr_now_existing = ""
    if existing:
        apr_now_existing = str(existing.get("approval_status") or "").strip().lower()

    profile_core: dict[str, Any] = {
        "name": contact.name,
        "email": contact.email,
        "phone_number": normalized_phone,
        "whatsapp_number": normalized_whatsapp,
        "contact_type": contact.contact_type.value,
        "facility_id": contact.facility_id,
        "facility_names": norm_facilities,
        "facility_name": facility_summary,
        "cities": norm_cities,
        "city": primary_city,
        "preferred_channels": [ch.value for ch in contact.preferred_channels],
        "environmental_topics": topics,
        "language": contact.language,
        "consent_given": contact.consent_given,
        "consent_timestamp": consent_ts,
        "active": True,
        "password_hash": registrant_auth.hash_password(contact.password),
    }

    if dispatch_verification:
        profile_core["verification_status"] = "pending"
        profile_core["verified_at"] = None
    else:
        profile_core["verification_status"] = "verified"
        profile_core["verified_at"] = datetime.utcnow()
        appr = _approval_status_after_contact_verified(apr_now_existing)
        if appr is not None:
            profile_core["approval_status"] = appr

    if existing:
        contact_id = existing["_id"]
        resent = True
        upd: dict[str, Any] = {"$set": profile_core}
        if not dispatch_verification:
            upd["$unset"] = {"verification_code": ""}
        await db.contacts.update_one({"_id": contact_id}, upd)
    else:
        contact_doc = {
            **profile_core,
            "created_at": datetime.utcnow(),
            "verification_code": None,
        }
        if dispatch_verification:
            contact_doc.setdefault("approval_status", "pending")
        result = await db.contacts.insert_one(contact_doc)
        contact_id = result.inserted_id

    await db.consent_records.insert_one(
        {
            "contact_id": str(contact_id),
            "contact_email": contact.email,
            "consent_given": contact.consent_given,
            "channels": [ch.value for ch in contact.preferred_channels],
            "timestamp": datetime.utcnow(),
            "renewal": resent,
        }
    )

    chans = [ch.value for ch in contact.preferred_channels]

    if not dispatch_verification:
        detail_msg = (
            "Updated enrollee profile; marked verified without sending codes."
            if resent
            else "Created and verified enrollee (no outbound verification)."
        )
        return {
            "success": True,
            "contact_id": str(contact_id),
            "message": detail_msg,
            "channels": chans,
            "verification_status": "verified",
            "verification_resent": resent,
        }

    code = _verification_code()
    now_ts = datetime.utcnow()
    await db.contacts.update_one(
        {"_id": contact_id},
        {"$set": {"verification_code": code, "verification_last_sent_at": now_ts}},
    )

    warnings: list[str] = []
    try:
        warnings = await _dispatch_registration_verification_channels(
            db,
            contact_id,
            contact_name=contact.name,
            email=str(contact.email),
            normalized_phone=normalized_phone,
            normalized_whatsapp=normalized_whatsapp,
            preferred_channel_values=chans,
            code=code,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Verification dispatch failed: %s", exc)
        raise HTTPException(status_code=500, detail="Verification dispatch failed") from exc

    out: dict[str, Any] = {
        "success": True,
        "contact_id": str(contact_id),
        "message": (
            "Verification code resent — check your channels"
            if resent
            else "Contact registered successfully"
        ),
        "channels": chans,
        "next_step": "Submit verification code via POST /api/contacts/verify",
        "verification_status": "pending",
        "verification_resent": resent,
    }
    if warnings:
        out["warnings"] = warnings
    return out


@router.post("/api/contacts/register")
async def register_contact(contact: ContactRegistration):
    """Public signup; emits verification codes (same rules as POST /api/admin/registrants with send_verification=true)."""
    return await persist_contact_registration(contact, dispatch_verification=True)


@router.post("/api/contacts/verify")
async def verify_contact(body: VerifyContactIn):
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(body.contact_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid contact_id") from exc

    doc = await db.contacts.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Contact not found")

    apr_now = str(doc.get("approval_status") or "").strip().lower()
    if apr_now == "revoked":
        raise HTTPException(status_code=403, detail="This registration has been revoked")

    if doc.get("verification_code") == body.verification_code:
        set_fields: dict[str, Any] = {
            "verification_status": "verified",
            "verified_at": datetime.utcnow(),
        }

        auto_apr = facility_auth.auto_approve_verified_contacts()
        if auto_apr:
            set_fields["approval_status"] = "approved"
        elif apr_now not in ("approved", "revoked"):
            set_fields["approval_status"] = "pending"

        await db.contacts.update_one(
            {"_id": oid},
            {"$set": set_fields, "$unset": {"verification_code": ""}},
        )
        msg = "Contact verified successfully"
        hint = ""
        if (
            not auto_apr
            and set_fields.get("approval_status") == "pending"
            and apr_now not in ("approved",)
        ):
            hint = (
                " Awaits partner approval before environmental alerts / facility dashboard reporting "
                "(operator: PATCH /api/contacts/{id}/approval)."
            )
        return {"success": True, "message": msg + hint}

    raise HTTPException(status_code=400, detail="Invalid verification code")


@router.post("/api/contacts/resend-verification")
async def resend_verification_code(body: ResendVerificationIn):
    """Send a fresh registration OTP to the enrollee's selected channels (pending only). Rate-limited per email."""
    db = db_state.require_mongo_db()
    email_key = str(body.email).strip()
    generic = RESEND_VERIFICATION_GENERIC_MESSAGE

    doc = await db.contacts.find_one({"email": email_key})
    if not doc:
        await asyncio.sleep(0.18)
        return {"success": True, "message": generic}

    vs = str(doc.get("verification_status") or "").strip().lower()
    apr = str(doc.get("approval_status") or "").strip().lower()

    if apr == "revoked" or vs != "pending":
        await asyncio.sleep(0.1)
        return {"success": True, "message": generic}

    last = doc.get("verification_last_sent_at")
    if isinstance(last, datetime):
        elapsed = (datetime.utcnow() - last).total_seconds()
        cooldown = float(_verification_resend_cooldown_seconds())
        if elapsed < cooldown:
            raise HTTPException(
                status_code=429,
                detail=f"Wait {max(1, int(cooldown - elapsed))}s before requesting another code.",
            )

    code = _verification_code()
    cid = doc["_id"]
    chans_raw = doc.get("preferred_channels") or []
    chans = [str(c) for c in chans_raw]
    normalized_phone = str(doc.get("phone_number") or "")
    normalized_whatsapp = str(doc.get("whatsapp_number") or "") or normalized_phone
    disp_name = str(doc.get("name") or "")
    disp_email = str(doc.get("email") or email_key)

    await db.contacts.update_one(
        {"_id": cid},
        {
            "$set": {
                "verification_code": code,
                "verification_last_sent_at": datetime.utcnow(),
            }
        },
    )

    try:
        warnings = await _dispatch_registration_verification_channels(
            db,
            cid,
            contact_name=disp_name,
            email=disp_email,
            normalized_phone=normalized_phone,
            normalized_whatsapp=normalized_whatsapp,
            preferred_channel_values=chans,
            code=code,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Resend verification dispatch failed: %s", exc)
        raise HTTPException(status_code=500, detail="Verification dispatch failed") from exc

    out: dict[str, Any] = {"success": True, "message": generic, "channels": chans}
    if warnings:
        out["warnings"] = warnings
    return out


@router.post("/api/auth/login")
async def registrant_dashboard_login(body: RegistrantLoginIn):
    """Email + password session for the public dashboard (JWT), distinct from facility OTP tokens."""
    db = db_state.require_mongo_db()
    email_key = str(body.email).strip()
    doc = await db.contacts.find_one({"email": email_key})
    if not doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    pwd_hash = doc.get("password_hash")
    if not pwd_hash:
        raise HTTPException(
            status_code=403,
            detail="No password set for this legacy account — ask an administrator to assign one.",
        )
    if not registrant_auth.verify_password(body.password, str(pwd_hash)):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    apr = str(doc.get("approval_status") or "").strip().lower()
    if apr == "revoked":
        raise HTTPException(status_code=403, detail="Account revoked.")
    vs = str(doc.get("verification_status") or "").strip().lower()
    if vs != "verified":
        raise HTTPException(status_code=403, detail="Verify your registration (code) before signing in.")

    token, ttl = registrant_auth.mint_registrant_session_token(doc)
    scopes = registrant_auth.compute_registrant_scopes(doc)
    cov = doc.get("cities")
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": ttl,
        "scopes": scopes,
        "contact_id": str(doc["_id"]),
        "email": doc.get("email"),
        "name": doc.get("name"),
        "city": doc.get("city"),
        "coverage_cities": cov if isinstance(cov, list) else None,
        "facility_name": facility_auth.facility_display_name(doc),
        "facility_id": str(doc.get("facility_id") or "").strip() or None,
        "facility_reporting_ready": registrant_auth.registrant_can_facility_actions(doc),
    }


@router.get("/api/auth/me")
async def registrant_profile(
    session: registrant_auth.RegistrantSession = Depends(registrant_auth.load_registrant_session),
):
    db = db_state.require_mongo_db()
    oid = ObjectId(session.contact_id)
    doc = await db.contacts.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Contact not found")
    out = dict(doc)
    oid = out.pop("_id", None)
    out["_id"] = str(oid) if oid is not None else ""
    for k in ("password_hash", "verification_code", "facility_login_code", "facility_login_expires_at"):
        out.pop(k, None)
    out["scopes"] = registrant_auth.compute_registrant_scopes(doc)
    return out


@router.post("/api/auth/change-password")
async def registrant_change_password_endpoint(
    body: RegistrantChangePasswordIn,
    session: registrant_auth.RegistrantSession = Depends(registrant_auth.load_registrant_session),
):
    db = db_state.require_mongo_db()
    oid = ObjectId(session.contact_id)
    doc = await db.contacts.find_one({"_id": oid})
    if not doc or not doc.get("password_hash"):
        raise HTTPException(status_code=400, detail="Password state invalid — contact support")
    if not registrant_auth.verify_password(body.old_password, str(doc["password_hash"])):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.contacts.update_one(
        {"_id": oid},
        {"$set": {"password_hash": registrant_auth.hash_password(body.new_password)}},
    )
    return {"success": True, "message": "Password updated."}


def _facility_scope_ok_for_login(doc: dict[str, Any]) -> tuple[bool, str]:
    apr_raw = doc.get("approval_status")
    if apr_raw is not None:
        a = str(apr_raw).strip().lower()
        if a == "revoked":
            return False, "revoked"
        if a == "pending":
            return False, "pending"
        if a != "approved":
            return False, "blocked"
    if str(doc.get("verification_status") or "").strip().lower() != "verified":
        return False, "not_verified"
    fid = str(doc.get("facility_id") or "").strip()
    if not fid:
        return False, "no_facility"
    return True, ""


@router.post("/api/auth/facility-login")
async def facility_dashboard_login_challenge(body: FacilityLoginEmailIn):
    """
    Sends a short-lived OTP to the registrant's channels so they can obtain a Bearer token
    for ``POST /api/action-log``.
    Response shape is deliberately uniform to avoid leaking which emails exist.
    """
    db = db_state.require_mongo_db()
    email_key = str(body.email).strip()
    generic = (
        "If this email is registered, verified, and approved for reporting, "
        "a login code was sent to configured channels."
    )
    doc = await db.contacts.find_one({"email": email_key})
    if doc:
        ok, _reason = _facility_scope_ok_for_login(doc)
        if ok:
            code = _verification_code()
            expires = datetime.utcnow() + timedelta(
                minutes=facility_auth.facility_login_code_ttl_minutes()
            )
            await db.contacts.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "facility_login_code": code,
                        "facility_login_expires_at": expires,
                    }
                },
            )
            doc_after = dict(doc)
            doc_after["_id"] = doc["_id"]
            warnings = await _send_facility_login_code(db, doc_after, code)
            out: dict[str, Any] = {
                "success": True,
                "message": generic,
                "code_ttl_minutes": facility_auth.facility_login_code_ttl_minutes(),
            }
            if warnings:
                out["warnings"] = warnings
            return out
    await asyncio.sleep(0.15)
    return {"success": True, "message": generic}


@router.post("/api/auth/facility-token")
async def facility_dashboard_token(body: FacilityTokenExchangeIn):
    """Exchange OTP from ``POST /api/auth/facility-login`` for an access JWT."""
    db = db_state.require_mongo_db()
    email_key = str(body.email).strip()
    doc = await db.contacts.find_one({"email": email_key})
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid email or code")
    ok, why = _facility_scope_ok_for_login(doc)
    if not ok:
        raise HTTPException(
            status_code=403 if why in ("revoked", "pending", "blocked") else 400,
            detail="Account cannot issue facility reporting tokens yet",
        )
    stored = doc.get("facility_login_code")
    if stored != body.code.strip():
        raise HTTPException(status_code=400, detail="Invalid email or code")
    exp_at = doc.get("facility_login_expires_at")
    if isinstance(exp_at, datetime):
        if datetime.utcnow() > exp_at:
            raise HTTPException(status_code=400, detail="Login code expired — request another")
    elif exp_at is not None:
        raise HTTPException(status_code=400, detail="Invalid login state — request another code")

    await db.contacts.update_one(
        {"_id": doc["_id"]},
        {"$unset": {"facility_login_code": "", "facility_login_expires_at": ""}},
    )
    refreshed = await db.contacts.find_one({"_id": doc["_id"]})
    token, ttl_s = facility_auth.mint_facility_access_token(refreshed or doc)
    row = refreshed or doc
    fid = str(row.get("facility_id") or "").strip()
    city_live = row.get("city")
    cov = row.get("cities")
    out_cov = cov if isinstance(cov, list) else None
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": ttl_s,
        "contact_id": str(doc["_id"]),
        "facility_id": fid,
        "facility_name": facility_auth.facility_display_name(row),
        "city": city_live if isinstance(city_live, str) else None,
        "coverage_cities": out_cov,
        "scope": "facility-actions/action-log",
    }


@router.patch("/api/contacts/{contact_id}/approval")
async def set_contact_operator_approval(
    contact_id: str,
    body: ContactApprovalPatchIn,
    _: None = Depends(require_notification_api_key),
):
    """
    Governance: mark a registrant pending / approved / revoked for alerts + facility dashboards.
    Requires ``NOTIFICATION_API_KEY`` like other administrative contact routes.
    """
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(contact_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid contact_id") from exc

    res = await db.contacts.update_one(
        {"_id": oid},
        {"$set": {"approval_status": body.approval_status, "updated_at": datetime.utcnow()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"success": True, "approval_status": body.approval_status}


@router.get("/api/contacts/dev/reset-registration-available")
async def dev_reset_registration_available():
    """
    When ``ALLOW_DEV_REGISTRATION_DB_RESET`` is enabled, frontend can surface a destructive QA control.
    Phrase matches ``POST …/reset-registration-test-data`` body requirement.

    When disabled, ``server_sees_value`` echoes what the API process read (helps catch typos / wrong file / no restart).
    """
    ok, seen = _dev_registration_reset_env_state()
    name = _dev_registration_reset_env_name()
    if not ok:
        return {
            "enabled": False,
            "env_var": name,
            "server_sees_value": seen if seen else None,
            "hint": (
                f"Set `{name}=true` in `backend/.env` (same directory as `main.py`), "
                "save the file, then restart the Uvicorn process completely."
            ),
        }
    return {
        "enabled": True,
        "confirmation_phrase": _DEV_REGISTRATION_RESET_PHRASE,
        "collections": ["contacts", "consent_records"],
    }


@router.post("/api/contacts/dev/reset-registration-test-data")
async def dev_reset_registration_test_data(
    body: DevRegistrationResetIn,
    _: None = Depends(require_notification_api_key),
):
    """
    Deletes all documents in ``contacts`` and ``consent_records``.
    Disabled unless ``ALLOW_DEV_REGISTRATION_DB_RESET=true`` (remove or set ``false`` in production).

    Requires ``confirmation_phrase`` exactly matching the string returned by
    ``GET /api/contacts/dev/reset-registration-available``. When ``NOTIFICATION_API_KEY`` is set,
    send ``Authorization: Bearer …`` as for other admin routes.
    """
    if not _allow_dev_registration_db_reset():
        raise HTTPException(
            status_code=403,
            detail=(
                "Dev registration DB reset is disabled. "
                "Set ALLOW_DEV_REGISTRATION_DB_RESET=true in .env for local QA only."
            ),
        )
    phrase = body.confirmation_phrase.strip()
    if phrase != _DEV_REGISTRATION_RESET_PHRASE:
        raise HTTPException(
            status_code=400,
            detail=(
                f"confirmation_phrase must be exactly {_DEV_REGISTRATION_RESET_PHRASE!r} "
                "(see GET /api/contacts/dev/reset-registration-available)"
            ),
        )

    db = db_state.require_mongo_db()
    dc = await db.contacts.delete_many({})
    dco = await db.consent_records.delete_many({})
    logger.warning(
        "ALLOW_DEV_REGISTRATION_DB_RESET: wiped registration collections "
        "(contacts_deleted=%s consent_records_deleted=%s)",
        dc.deleted_count,
        dco.deleted_count,
    )
    return {
        "success": True,
        "contacts_deleted": dc.deleted_count,
        "consent_records_deleted": dco.deleted_count,
        "message": (
            "You can submit the registration form again with the same email. "
            "Turn off ALLOW_DEV_REGISTRATION_DB_RESET when finished testing."
        ),
    }


def _mask_e164_tail(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) < 4:
        return "••••"
    return f"••••{digits[-4:]}"


@router.get("/api/contacts/directory")
async def list_contacts_directory(
    facility_id: Optional[str] = None,
    city: Optional[str] = None,
    include_inactive: bool = Query(
        True,
        description="If false, only contacts with active=true.",
    ),
    unmasked_phones: bool = Query(
        False,
        description="Return full phone and WhatsApp numbers (use only on trusted networks).",
    ),
    _: None = Depends(require_registration_directory_secret),
):
    """
    List registrants; requires header ``X-Registration-Directory-Secret`` matching
    ``REGISTRATION_DIRECTORY_SECRET``. When that env var is unset, returns 404.
    Phones are masked by default (last four digits only visible).
    """
    db = db_state.require_mongo_db()
    query: dict[str, Any] = {}
    if not include_inactive:
        query["active"] = True
    if facility_id:
        query["facility_id"] = facility_id
    if city:
        query["$or"] = [{"city": city}, {"cities": city}]

    cursor = db.contacts.find(query).sort("created_at", -1).limit(5000)
    contacts = await cursor.to_list(length=5000)
    out: list[dict[str, Any]] = []
    for c in contacts:
        doc = dict(c)
        oid = doc.pop("_id", None)
        doc["_id"] = str(oid) if oid is not None else None
        doc.pop("verification_code", None)
        doc.pop("facility_login_code", None)
        doc.pop("facility_login_expires_at", None)
        doc.pop("password_hash", None)
        if not unmasked_phones:
            if doc.get("phone_number"):
                doc["phone_number"] = _mask_e164_tail(doc["phone_number"])
            if doc.get("whatsapp_number"):
                doc["whatsapp_number"] = _mask_e164_tail(doc["whatsapp_number"])
        out.append(doc)
    return {"count": len(out), "contacts": out}


@router.get("/api/contacts/{contact_id}")
async def get_contact(
    contact_id: str,
    _: None = Depends(require_notification_api_key),
):
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(contact_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid contact_id") from exc

    contact = await db.contacts.find_one({"_id": oid})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    contact.pop("verification_code", None)
    contact.pop("facility_login_code", None)
    contact.pop("facility_login_expires_at", None)
    contact.pop("password_hash", None)
    contact["_id"] = str(contact["_id"])
    return contact


@router.get("/api/contacts")
async def list_contacts(
    facility_id: Optional[str] = None,
    contact_type: Optional[str] = None,
    city: Optional[str] = None,
    _: None = Depends(require_notification_api_key),
):
    db = db_state.require_mongo_db()
    query: dict[str, Any] = {"active": True}
    if facility_id:
        query["facility_id"] = facility_id
    if contact_type:
        query["contact_type"] = contact_type
    if city:
        query["$or"] = [{"city": city}, {"cities": city}]

    contacts = await db.contacts.find(query).to_list(length=1000)
    for c in contacts:
        c["_id"] = str(c["_id"])
        c.pop("verification_code", None)
        c.pop("facility_login_code", None)
        c.pop("facility_login_expires_at", None)
        c.pop("password_hash", None)
    return contacts


@router.put("/api/contacts/{contact_id}/preferences")
async def update_preferences(
    contact_id: str,
    update: ConsentUpdate,
    _: None = Depends(require_notification_api_key),
):
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(contact_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid contact_id") from exc

    result = await db.contacts.update_one(
        {"_id": oid},
        {
            "$set": {
                "preferred_channels": [ch.value for ch in update.preferred_channels],
                "consent_given": update.consent_given,
                "updated_at": datetime.utcnow(),
                **(
                    {
                        "environmental_topics": _validated_environment_topics(
                            update.environmental_topics,
                            default_both=False,
                        ),
                    }
                    if update.environmental_topics is not None
                    else {}
                ),
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")

    await db.consent_records.insert_one(
        {
            "contact_id": contact_id,
            "consent_given": update.consent_given,
            "channels": [ch.value for ch in update.preferred_channels],
            "timestamp": datetime.utcnow(),
        }
    )
    return {"success": True, "message": "Preferences updated"}


# ---------------------------------------------------------------------------
# Send & broadcast
# ---------------------------------------------------------------------------


@router.post("/api/notifications/send")
async def send_notification(
    request: NotificationRequest,
    _: None = Depends(require_notification_api_key),
):
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(request.recipient_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid recipient_id") from exc

    recipient = await db.contacts.find_one({"_id": oid})
    if not recipient:
        raise HTTPException(status_code=404, detail="Contact not found")
    if not recipient.get("consent_given"):
        raise HTTPException(status_code=403, detail="Contact has not given consent")
    apr_raw = recipient.get("approval_status")
    if apr_raw is not None:
        a = str(apr_raw).strip().lower()
        if a in ("revoked", "pending"):
            raise HTTPException(
                status_code=403,
                detail="Contact approval status prevents directed notifications right now.",
            )

    result: dict[str, Any]
    if request.channel == NotificationChannel.SMS:
        result = await send_sms(recipient["phone_number"], request.message)
    elif request.channel == NotificationChannel.WHATSAPP:
        result = await send_whatsapp(recipient["whatsapp_number"], request.message)
    else:
        html_content = f"<p>{request.message}</p>"
        result = await send_email(
            recipient["email"],
            request.subject or "Early Warning Alert",
            html_content,
        )

    log_entry = {
        "recipient_id": request.recipient_id,
        "recipient_email": recipient["email"],
        "recipient_name": recipient["name"],
        "channel": request.channel.value,
        "message": request.message,
        "alert_level": request.alert_level.value if request.alert_level else None,
        "status": result["status"],
        "twilio_sid": result.get("sid"),
        "error": result.get("error"),
        "timestamp": datetime.utcnow(),
    }
    await db.notification_logs.insert_one(log_entry)

    return {
        "success": result.get("success"),
        "channel": request.channel.value,
        "recipient": recipient["name"],
        "status": result["status"],
    }


def _broadcast_allowed_types() -> set[str]:
    return {"health_worker", "parent", "admin", "government", "all"}


async def broadcast_to_recipients(
    recipients: list[dict[str, Any]],
    message: str,
    level_label: str,
    city: str,
    *,
    hazard_type: str = "air",
    headline_value_display: Optional[str] = None,
) -> None:
    db = db_state.mongo_db
    if db is None:
        return

    haz = str(hazard_type or "air").strip().lower()
    head = headline_value_display or level_label

    def _subject() -> str:
        if haz == "heat":
            return f"HEAT ALERT — {level_label}"
        if haz == "respiratory_surge":
            return f"RESPIRATORY SURGE — {level_label}"
        return f"AIR QUALITY ALERT — {level_label}"

    results: dict[str, dict[str, int]] = {
        "sms": {"sent": 0, "failed": 0},
        "whatsapp": {"sent": 0, "failed": 0},
        "email": {"sent": 0, "failed": 0},
    }

    for recipient in recipients:
        for channel in recipient.get("preferred_channels", []):
            result: dict[str, Any] | None = None
            if channel == "sms":
                result = await send_sms(recipient["phone_number"], message)
                results["sms"]["sent" if result["success"] else "failed"] += 1
            elif channel == "whatsapp":
                result = await send_whatsapp(recipient["whatsapp_number"], message)
                results["whatsapp"]["sent" if result["success"] else "failed"] += 1
            elif channel == "email":
                result = await send_email(
                    recipient["email"],
                    _subject(),
                    f"<p><strong>{city}</strong> — {haz.upper()} · {head}</p><pre>{message}</pre>",
                )
                results["email"]["sent" if result["success"] else "failed"] += 1
            if result:
                log_line: dict[str, Any] = {
                    "recipient_id": str(recipient.get("_id")),
                    "recipient_email": recipient["email"],
                    "recipient_name": recipient["name"],
                    "channel": channel,
                    "alert_level": level_label,
                    "hazard_type": haz,
                    "city": city,
                    "status": result["status"],
                    "twilio_sid": result.get("sid"),
                    "error": result.get("error"),
                    "timestamp": datetime.utcnow(),
                }
                if headline_value_display is not None:
                    log_line["headline_value_display"] = headline_value_display
                await db.notification_logs.insert_one(log_line)

    await db.alert_broadcasts.insert_one(
        {
            "city": city,
            "severity_level": level_label,
            "hazard_type": haz,
            "timestamp": datetime.utcnow(),
            "results": results,
            "total_recipients": len(recipients),
            "aqi_level": level_label if haz == "air" else None,
            "heat_headline_display": headline_value_display if haz == "heat" else None,
        }
    )
    logger.info("Broadcast complete hazard=%s: %s", haz, results)


@router.post("/api/alerts/broadcast")
async def broadcast_alert(
    alert: AlertBroadcast,
    background_tasks: BackgroundTasks,
    _: None = Depends(require_notification_api_key),
):
    db = db_state.require_mongo_db()
    if alert.recipient_type not in _broadcast_allowed_types():
        raise HTTPException(
            status_code=400,
            detail=f"recipient_type must be one of {_broadcast_allowed_types()}",
        )

    emoji_map = {
        "LOW": "🟢",
        "MODERATE": "🟡",
        "HIGH": "🔴",
        "SEVERE": "🔴🔴",
    }
    emoji = emoji_map.get(alert.aqi_level.value, "⚠️")
    dashboard = (
        os.getenv("NOTIFICATION_DASHBOARD_URL") or "https://your-app.com/dashboard"
    ).strip()

    message = alert.message_override or (
        f"""{emoji} AIR QUALITY ALERT

🏙️ Location: {alert.city}
📊 Level: {alert.aqi_level.value}
🔢 AQI / index: {alert.aqi_value}

📋 Recommended actions:
• Check oxygen stock
• Alert respiratory unit staff
• Prepare for surge admissions

⏰ Stay informed via your chosen channels.
🔗 Dashboard: {dashboard}
"""
    )

    query_match: dict[str, Any] = {
        **eligible_broadcast_contact_clause(),
    }
    if alert.recipient_type != "all":
        query_match["contact_type"] = alert.recipient_type

    clauses: list[dict[str, Any]] = [query_match, _contacts_env_topic_clause("air")]
    if alert.filter_city:
        clauses.append(_coverage_municipality_clause(alert.filter_city))

    recipients = await db.contacts.find({"$and": clauses}).to_list(length=5000)
    background_tasks.add_task(
        broadcast_to_recipients,
        recipients,
        message,
        alert.aqi_level.value,
        alert.city,
        hazard_type="air",
    )

    return {
        "success": True,
        "alert_id": datetime.utcnow().isoformat(),
        "recipients_count": len(recipients),
        "city": alert.city,
        "aqi_level": alert.aqi_level.value,
        "message": "Alert broadcast initiated (background send).",
    }


async def _broadcast_eval_then_cooldown(
    recipients: list[dict[str, Any]],
    message: str,
    level_str: str,
    city: str,
    *,
    hazard_type: str = "air",
    headline_value_display: Optional[str] = None,
) -> None:
    await broadcast_to_recipients(
        recipients,
        message,
        level_str,
        city,
        hazard_type=hazard_type,
        headline_value_display=headline_value_display,
    )
    db = db_state.mongo_db
    if db is not None:
        await _mark_eval_broadcast(db, city, hazard_type)


@router.post("/api/alerts/evaluate")
async def evaluate_air_alert(
    body: AlertEvaluateIn,
    background_tasks: BackgroundTasks,
    _: None = Depends(require_notification_api_key),
):
    """Fetch live air quality for a configured city; broadcast when level and cooldown allow."""
    city = body.city.strip()
    if city not in CITIES_CONFIG:
        raise HTTPException(status_code=404, detail=f"City {city} not found")

    if body.recipient_type not in _broadcast_allowed_types():
        raise HTTPException(
            status_code=400,
            detail=f"recipient_type must be one of {_broadcast_allowed_types()}",
        )

    loc = CITIES_CONFIG[city]
    lat_v, lon_v = float(loc["lat"]), float(loc["lon"])
    try:
        source, aq_payload = await external_integrations.air_quality_current_waqi_then_rapid(
            lat=lat_v,
            lon=lon_v,
            waqi_city_fallback=city,
        )
    except external_integrations.AirQualityError as exc:
        logger.warning("Air quality evaluate failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)[:1400]) from exc

    try:
        aqi_value, level = _air_quality_index_and_level(aq_payload)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    min_r = _ALERT_LEVEL_RANK[body.min_level.value]
    cur_r = _ALERT_LEVEL_RANK[level.value]
    if cur_r < min_r:
        return {
            "success": True,
            "skipped": "below_min_level",
            "city": city,
            "source": source,
            "aqi_value": aqi_value,
            "aqi_level": level.value,
            "min_level": body.min_level.value,
            "air_quality": aq_payload,
        }

    db = db_state.require_mongo_db()
    if not await _cooldown_allows_broadcast(db, city, body.force, hazard="air"):
        return {
            "success": True,
            "skipped": "cooldown",
            "city": city,
            "source": source,
            "aqi_value": aqi_value,
            "aqi_level": level.value,
            "air_quality": aq_payload,
        }

    emoji_map = {
        "LOW": "🟢",
        "MODERATE": "🟡",
        "HIGH": "🔴",
        "SEVERE": "🔴🔴",
    }
    emoji = emoji_map.get(level.value, "⚠️")
    dashboard = (
        os.getenv("NOTIFICATION_DASHBOARD_URL") or "https://your-app.com/dashboard"
    ).strip()

    message = (
        f"""{emoji} AIR QUALITY ALERT

🏙️ Location: {city}
📊 Level: {level.value}
🔢 AQI / index: {aqi_value}
📡 Source: {source}

📋 Recommended actions:
• Check oxygen stock
• Alert respiratory unit staff
• Prepare for surge admissions

⏰ Stay informed via your chosen channels.
🔗 Dashboard: {dashboard}
"""
    )

    filter_city = body.filter_city if body.filter_city is not None else city
    query_match: dict[str, Any] = {
        **eligible_broadcast_contact_clause(),
    }
    if body.recipient_type != "all":
        query_match["contact_type"] = body.recipient_type

    clauses_eval_air: list[dict[str, Any]] = [
        query_match,
        _contacts_env_topic_clause("air"),
    ]
    if filter_city:
        clauses_eval_air.append(_coverage_municipality_clause(filter_city))

    recipients = await db.contacts.find({"$and": clauses_eval_air}).to_list(length=5000)
    background_tasks.add_task(
        _broadcast_eval_then_cooldown,
        recipients,
        message,
        level.value,
        city,
        hazard_type="air",
    )

    return {
        "success": True,
        "city": city,
        "source": source,
        "aqi_value": aqi_value,
        "aqi_level": level.value,
        "recipients_count": len(recipients),
        "message": "Evaluate: broadcast scheduled (background send).",
        "air_quality": aq_payload,
    }


@router.post("/api/alerts/evaluate-heat")
async def evaluate_heat_alert(
    body: HeatEvaluateIn,
    background_tasks: BackgroundTasks,
    _: None = Depends(require_notification_api_key),
):
    """Fetch current heat snapshot (effective temp °C); broadcast when tier and cooldown allow."""
    city = body.city.strip()
    if city not in CITIES_CONFIG:
        raise HTTPException(status_code=404, detail=f"City {city} not found")

    if body.recipient_type not in _broadcast_allowed_types():
        raise HTTPException(
            status_code=400,
            detail=f"recipient_type must be one of {_broadcast_allowed_types()}",
        )

    loc = CITIES_CONFIG[city]
    lat_v, lon_v = float(loc["lat"]), float(loc["lon"])
    try:
        src, blob = await external_integrations.heat_current_preferred(
            lat=lat_v, lon=lon_v, location_label=city
        )
    except external_integrations.HeatCurrentError as exc:
        logger.warning("Heat evaluate failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)[:1400]) from exc

    try:
        t_display, level = _heat_temperature_and_level(blob)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)[:1400]) from exc

    min_r = _ALERT_LEVEL_RANK[body.min_level.value]
    cur_r = _ALERT_LEVEL_RANK[level.value]
    if cur_r < min_r:
        return {
            "success": True,
            "skipped": "below_min_level",
            "city": city,
            "source": src,
            "heat_temperature_display": t_display,
            "heat_level": level.value,
            "min_level": body.min_level.value,
            "heat": blob,
            "thresholds_c": dict(
                zip(("moderate_at", "high_at", "severe_at"), _heat_threshold_degrees_c())
            ),
        }

    db = db_state.require_mongo_db()
    if not await _cooldown_allows_broadcast(db, city, body.force, hazard="heat"):
        return {
            "success": True,
            "skipped": "cooldown",
            "city": city,
            "source": src,
            "heat_temperature_display": t_display,
            "heat_level": level.value,
            "heat": blob,
        }

    emoji_map = {
        "LOW": "🟢",
        "MODERATE": "🟡",
        "HIGH": "🔴",
        "SEVERE": "🔴🔴",
    }
    emoji = emoji_map.get(level.value, "⚠️")
    dashboard = (
        os.getenv("NOTIFICATION_DASHBOARD_URL") or "https://your-app.com/dashboard"
    ).strip()
    hdr = blob.get("advisory_basis") or "Current snapshot—not a daily-max forecast."
    feels = blob.get("feelslike_c")
    feels_line = ""
    if feels is not None:
        feels_line = f"\n🔹 Feels-like: {feels} °C"

    message = (
        f"""{emoji} HEAT READINESS ALERT

🏙️ Location: {city}
📊 Level: {level.value}
🌡️ Effective (~max ambient / feels-like): {t_display} °C{feels_line}
📡 Source: {src}

⚠️ {hdr}

📋 Guidance (especially infants, children, pregnancy, elders):
• Shade, regular hydration; avoid strenuous midday outdoor exertion where possible.
• Seek medical attention for confusion, persistent vomiting, fainting, or unmanaged fever—these notices are readiness aids, not diagnoses.
• If air pollution is also high that day, limit outdoor exposure further.

🔗 Dashboard: {dashboard}
"""
    )

    filter_city = body.filter_city if body.filter_city is not None else city
    query_match: dict[str, Any] = {
        **eligible_broadcast_contact_clause(),
    }
    if body.recipient_type != "all":
        query_match["contact_type"] = body.recipient_type

    clauses_eval_heat: list[dict[str, Any]] = [
        query_match,
        _contacts_env_topic_clause("heat"),
    ]
    if filter_city:
        clauses_eval_heat.append(_coverage_municipality_clause(filter_city))

    recipients = await db.contacts.find({"$and": clauses_eval_heat}).to_list(length=5000)

    headline = f"{t_display} °C effective (snapshot)"

    background_tasks.add_task(
        _broadcast_eval_then_cooldown,
        recipients,
        message,
        level.value,
        city,
        hazard_type="heat",
        headline_value_display=headline,
    )

    return {
        "success": True,
        "city": city,
        "source": src,
        "heat_temperature_display": t_display,
        "heat_level": level.value,
        "recipients_count": len(recipients),
        "message": "Heat evaluate: broadcast scheduled (background send).",
        "heat": blob,
        "thresholds_c": dict(
            zip(("moderate_at", "high_at", "severe_at"), _heat_threshold_degrees_c())
        ),
    }


@router.get("/api/alerts/latest")
async def latest_public_broadcast(city: Optional[str] = None):
    """
    Public summary of the most recent row in ``alert_broadcasts`` (no API key).
    Used by landing / docs / dashboard chrome for a “latest alert” strip.
    """
    db = db_state.mongo_db
    if db is None:
        return {
            "ok": True,
            "source": "none",
            "message": "MongoDB not configured — no stored broadcasts.",
        }
    query: dict[str, Any] = {}
    if city is not None and str(city).strip():
        c = str(city).strip()
        if c not in CITIES_CONFIG:
            raise HTTPException(status_code=404, detail=f"City {c} not found")
        query["city"] = c

    docs = await db.alert_broadcasts.find(query).sort("timestamp", -1).limit(1).to_list(length=1)
    if not docs:
        return {
            "ok": True,
            "source": "empty",
            "message": "No broadcasts yet. After the first alert, the latest summary appears here.",
        }

    d = docs[0]
    ts = d.get("timestamp")
    if isinstance(ts, datetime):
        ts_out = ts.isoformat() + "Z"
    else:
        ts_out = str(ts) if ts is not None else None

    haz_raw = str(d.get("hazard_type") or "air").strip().lower()
    sev_lvl = d.get("severity_level") or d.get("aqi_level")
    ht_dis = d.get("heat_headline_display")

    return {
        "ok": True,
        "source": "alert_broadcasts",
        "city": d.get("city"),
        "hazard_type": haz_raw,
        "level": sev_lvl,
        "severity_level": sev_lvl,
        "aqi_level": d.get("aqi_level"),
        "heat_headline_display": ht_dis,
        "timestamp": ts_out,
        "total_recipients": d.get("total_recipients"),
        "delivery_results": d.get("results"),
    }


# ---------------------------------------------------------------------------
# Webhooks
# ---------------------------------------------------------------------------


@router.post("/api/webhooks/sms")
async def handle_sms_webhook(
    params: dict[str, str] = Depends(twilio_webhook_form),
):
    db = db_state.require_mongo_db()
    from_number = str(params.get("From") or "")
    message_body = params.get("Body")
    message_sid = params.get("MessageSid")

    await db.inbound_messages.insert_one(
        {
            "type": "sms",
            "from_number": from_number,
            "body": message_body,
            "twilio_sid": message_sid,
            "timestamp": datetime.utcnow(),
        }
    )

    await db.contacts.update_one(
        {"phone_number": twilio_notify.normalize_e164(from_number)},
        {"$set": {"last_inbound_at": datetime.utcnow()}},
        upsert=False,
    )

    reply = (
        "Thank you for your message. We received it and will follow up as needed."
    )
    if twilio_notify.twilio_configured():
        try:
            await twilio_notify.send_twilio_message_async(
                from_number, reply, channel="sms"
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("SMS auto-reply failed: %s", exc)

    return {"success": True}


@router.post("/api/webhooks/whatsapp")
async def handle_whatsapp_webhook(
    params: dict[str, str] = Depends(twilio_webhook_form),
):
    db = db_state.require_mongo_db()
    from_number = str(params.get("From") or "")
    message_body = params.get("Body")
    message_sid = params.get("MessageSid")

    clean_phone = (
        from_number.replace("whatsapp:", "")
        if "whatsapp:" in from_number
        else from_number
    )

    await db.inbound_messages.insert_one(
        {
            "type": "whatsapp",
            "from_number": clean_phone,
            "body": message_body,
            "twilio_sid": message_sid,
            "timestamp": datetime.utcnow(),
        }
    )

    await db.contacts.update_one(
        {"whatsapp_number": twilio_notify.normalize_e164(clean_phone)},
        {"$set": {"last_inbound_at": datetime.utcnow()}},
        upsert=False,
    )

    reply = "Thank you for your message. We received it."
    if twilio_notify.twilio_configured():
        try:
            await twilio_notify.send_twilio_message_async(
                clean_phone, reply, channel="whatsapp"
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("WhatsApp auto-reply failed: %s", exc)

    return {"success": True}


@router.post("/api/webhooks/message-status")
async def handle_message_status(
    params: dict[str, str] = Depends(twilio_webhook_form),
):
    db = db_state.require_mongo_db()
    message_sid = params.get("MessageSid")
    message_status = params.get("MessageStatus")

    await db.notification_logs.update_one(
        {"twilio_sid": message_sid},
        {"$set": {"delivery_status": message_status}},
        upsert=False,
    )
    return {"success": True}


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


@router.get("/api/analytics/notifications")
async def get_notification_analytics(
    days: int = 7,
    _: None = Depends(require_notification_api_key),
):
    db = db_state.require_mongo_db()
    start_date = datetime.utcnow() - timedelta(days=max(1, min(days, 365)))

    pipeline_ch = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {
            "$group": {
                "_id": "$channel",
                "total": {"$sum": 1},
                "success": {"$sum": {"$cond": [{"$eq": ["$status", "sent"]}, 1, 0]}},
            }
        },
    ]
    channel_stats = await db.notification_logs.aggregate(pipeline_ch).to_list(None)

    pipeline_al = [
        {
            "$match": {
                "timestamp": {"$gte": start_date},
                "alert_level": {"$exists": True, "$ne": None},
            }
        },
        {"$group": {"_id": "$alert_level", "count": {"$sum": 1}}},
    ]
    alert_stats = await db.notification_logs.aggregate(pipeline_al).to_list(None)

    return {
        "period_days": days,
        "by_channel": channel_stats,
        "by_alert_level": alert_stats,
        "timestamp": datetime.utcnow(),
    }


@router.get("/api/analytics/contacts")
async def get_contact_analytics(
    _: None = Depends(require_notification_api_key),
):
    db = db_state.require_mongo_db()
    total = await db.contacts.count_documents({})
    verified = await db.contacts.count_documents(
        {"verification_status": "verified"}
    )
    approved = await db.contacts.count_documents({"approval_status": "approved"})
    pending_approval = await db.contacts.count_documents({"approval_status": "pending"})
    by_type = await db.contacts.aggregate(
        [{"$group": {"_id": "$contact_type", "count": {"$sum": 1}}}]
    ).to_list(None)
    by_channel = await db.contacts.aggregate(
        [
            {
                "$unwind": {
                    "path": "$preferred_channels",
                    "preserveNullAndEmptyArrays": True,
                }
            },
            {"$group": {"_id": "$preferred_channels", "count": {"$sum": 1}}},
        ]
    ).to_list(None)

    return {
        "total_contacts": total,
        "verified_contacts": verified,
        "approved_operators": approved,
        "pending_approval_gate": pending_approval,
        "verification_rate": f"{(verified / total * 100):.1f}%" if total else "0%",
        "by_type": by_type,
        "by_channel": by_channel,
    }


@router.get("/registration", response_class=HTMLResponse)
async def registration_portal_page():
    """Health worker self-registration UI (see also ``/registration``)."""
    path = _REGISTRATION_HTML
    if path.is_file():
        return HTMLResponse(content=path.read_text(encoding="utf-8"))
    raise HTTPException(
        status_code=404,
        detail="registration_portal.html missing (expected landing/registration_portal.html)",
    )


@router.get("/registration/contacts-directory", response_class=HTMLResponse)
async def contacts_directory_page():
    """PIN-protected viewer: calls ``GET /api/contacts/directory`` with ``X-Registration-Directory-Secret``."""
    path = _CONTACTS_DIR_HTML
    if path.is_file():
        return HTMLResponse(content=path.read_text(encoding="utf-8"))
    raise HTTPException(
        status_code=404,
        detail="contacts_directory.html missing (expected landing/contacts_directory.html)",
    )


# ---------------------------------------------------------------------------
# Twilio test + sandbox
# ---------------------------------------------------------------------------


class TwilioTestIn(BaseModel):
    to: str = Field(..., min_length=8, max_length=40)
    body: str = Field(
        default="Early Warning System: test notification.",
        min_length=1,
        max_length=1600,
    )
    channel: Optional[str] = Field(
        None,
        description="Override TWILIO_MESSAGE_CHANNEL: sms or whatsapp",
    )


class ResendTestIn(BaseModel):
    to: EmailStr
    subject: str = Field(
        default="Early Warning — Resend connectivity test",
        min_length=1,
        max_length=200,
    )


@router.get("/api/notifications/whatsapp/sandbox-info")
async def notifications_whatsapp_sandbox_info():
    return twilio_notify.whatsapp_sandbox_info()


@router.post("/api/notifications/twilio/test")
async def notifications_twilio_test(
    payload: TwilioTestIn,
    _: None = Depends(require_notification_api_key),
):
    if not twilio_notify.twilio_configured():
        raise HTTPException(
            status_code=503,
            detail="Twilio not configured",
        )
    ch = (payload.channel or "").strip().lower() or None
    if ch and ch not in ("sms", "whatsapp"):
        raise HTTPException(status_code=400, detail="channel must be sms or whatsapp")
    result = await twilio_notify.send_twilio_message_async(
        payload.to, payload.body, channel=ch
    )
    if not result.get("ok"):
        raise HTTPException(
            status_code=502,
            detail=str(result.get("error", "twilio_send_failed")),
        )
    return result


@router.post("/api/notifications/resend/test")
async def notifications_resend_test(
    payload: ResendTestIn,
    _: None = Depends(require_notification_api_key),
):
    """
    Send one email through Resend using the running process env (sanity-check key + verified domain/from).
    """
    if not _resend_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Resend not configured: set RESEND_API_KEY (and avoid placeholder tokens). "
                "See server logs after registration for Resend rejection details."
            ),
        )
    result = await send_email(
        str(payload.to),
        payload.subject.strip(),
        "<p>Early Warning backend: Resend connectivity test succeeded.</p>",
    )
    if not result.get("success"):
        err = result.get("error") or "resend_failed"
        err_s = err if isinstance(err, str) else str(err)
        raise HTTPException(status_code=502, detail=err_s[:2000])
    return {"success": True, "status": result.get("status"), "detail": "Message accepted by Resend API"}


