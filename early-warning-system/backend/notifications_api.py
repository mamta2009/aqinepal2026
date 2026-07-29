"""
Registration, broadcast alerts, webhooks, and analytics (ported from notification_cursor.zip).
Requires MongoDB and optional Twilio / SendGrid email configuration.

Architecture diagram (on-disk; embedded on **`/guides`**):
``docs/tech/NOTIFICATION_FLOW_DIAGRAM.svg``
"""

from __future__ import annotations

import hashlib
import html
import logging
import os
import re
import secrets
import asyncio
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Literal, Optional

import uuid

from pathlib import Path

import httpx
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr, Field, model_validator

import db_state
import account_deletion
import external_integrations
import facility_auth
import onchain_hooks
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

SENDGRID_MAIL_API_URL = "https://api.sendgrid.com/v3/mail/send"

_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002700-\U000027BF"
    "\U0001F600-\U0001F64F"
    "\U00002600-\U000026FF"
    "\U0000FE00-\U0000FE0F"
    "\U0001F1E0-\U0001F1FF"
    "]+",
    flags=re.UNICODE,
)

_ALERT_LEVEL_COLORS = {
    "LOW": "#1b7a3d",
    "MODERATE": "#b8860b",
    "HIGH": "#c2410c",
    "SEVERE": "#9b1c1c",
}


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


def contact_facility_site_labels(doc: dict[str, Any]) -> list[str]:
    """Human-readable facility/site names on file for this contact (list + legacy line)."""
    names, _ = _normalize_facility_names(
        doc.get("facility_names") if isinstance(doc.get("facility_names"), list) else None,
        doc.get("facility_name"),
    )
    return names


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
    "selected channels. Check spam for email and confirm SendGrid sender authentication; SMS/WhatsApp work if enabled."
)


class VerifyContactIn(BaseModel):
    contact_id: str
    verification_code: str = Field(..., min_length=4, max_length=16)


class VerifyContactEmailIn(BaseModel):
    """Complete signup verification using the registration email (pending contacts only)."""

    email: EmailStr
    verification_code: str = Field(..., min_length=4, max_length=16)


class ResendVerificationIn(BaseModel):
    """Request another registration verification code by email address (pending contacts only)."""

    email: EmailStr


class RegistrantLoginIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)
    reverification_code: Optional[str] = Field(
        None,
        max_length=16,
        description="Required about every 90 days: the security code sent after password check.",
    )
    new_password: Optional[str] = Field(
        None,
        max_length=128,
        description="With reverification_code on periodic renewal — min 8 characters (validated when renewing).",
    )


class RegistrantChangePasswordIn(BaseModel):
    old_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class DeleteAccountIn(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)
    confirm: str = Field(
        ...,
        min_length=1,
        max_length=32,
        description="Must be exactly DELETE",
    )


class DeleteAccountRequestIn(BaseModel):
    email: EmailStr


class DeleteAccountConfirmIn(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=4, max_length=16)
    confirm: str = Field(
        ...,
        min_length=1,
        max_length=32,
        description="Must be exactly DELETE",
    )


_ACCOUNT_DELETION_CONFIRM_PHRASE = "DELETE"
_ACCOUNT_DELETION_CODE_TTL_MINUTES = 15


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


class RegistrantSelfPrefsPatch(BaseModel):
    """Self-service updates for the signed-in registrant (dashboard / facility JWT)."""

    preferred_channels: Optional[list[NotificationChannel]] = None
    consent_given: Optional[bool] = None
    environmental_topics: Optional[list[str]] = None
    add_facility_name: Optional[str] = Field(
        None,
        max_length=200,
        description="Append one facility/site name to your enrolment (deduplicated case-insensitively).",
    )
    facility_site_pm25_thresholds: Optional[dict[str, float]] = Field(
        None,
        description="Optional per-site PM2.5 alert threshold (µg/m³) — keys must match a registered facility name.",
    )

    @model_validator(mode="after")
    def _at_least_one_field(self) -> RegistrantSelfPrefsPatch:
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update")
        return self


class SharedAlertContactCreate(BaseModel):
    """Friend/family entry for optional user-initiated SMS / WhatsApp / email from the dashboard."""

    display_name: str = Field(..., min_length=1, max_length=120)
    channel: Literal["sms", "email", "whatsapp"]
    phone_e164: Optional[str] = None
    email: Optional[EmailStr] = None

    @model_validator(mode="after")
    def _dest_matches_channel(self) -> SharedAlertContactCreate:
        if self.channel in ("sms", "whatsapp"):
            p = (self.phone_e164 or "").strip()
            if len(p) < 5 or not p.startswith("+"):
                raise ValueError("SMS/WhatsApp require phone_e164 starting with + (E.164)")
        if self.channel == "email":
            if self.email is None or not str(self.email).strip():
                raise ValueError("email is required when channel is email")
        return self


class SharedAlertContactUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=120)
    channel: Optional[Literal["sms", "email", "whatsapp"]] = None
    phone_e164: Optional[str] = None
    email: Optional[EmailStr] = None


class SharedNotifyIn(BaseModel):
    contact_ids: list[str] = Field(..., min_length=1, max_length=25)
    message: str = Field(..., min_length=1, max_length=1200)
    confirm_recipients_consented: bool = Field(
        ...,
        description="Must be true: you confirm recipients agreed to receive this message.",
    )

    @model_validator(mode="after")
    def _confirm_ok(self) -> SharedNotifyIn:
        if not self.confirm_recipients_consented:
            raise ValueError("confirm_recipients_consented must be true")
        return self


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
        "$nor": [{"active": False}],
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


def _sendgrid_api_key_effective() -> str:
    return _strip_env_secret(os.getenv("SENDGRID_API_KEY"))


def _sendgrid_from_effective(default: str = "info@intelladapt.com") -> str:
    v = _strip_env_secret(os.getenv("SENDGRID_FROM_EMAIL"))
    return v if v else default


def _sendgrid_configured() -> bool:
    key = _sendgrid_api_key_effective()
    kl = key.lower()
    return bool(key and "paste" not in kl and "your_" not in kl)


def public_resend_email_ready() -> bool:
    """True when SendGrid outbound email is configured (name kept for API/SPA compatibility)."""
    return _sendgrid_configured()


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
        await db.shared_alert_dispatch_log.create_index("initiator_contact_id")
        await db.shared_alert_dispatch_log.create_index("timestamp")
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
        await onchain_hooks.ensure_onchain_anchor_indexes(db)
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


def _notification_dashboard_url() -> str:
    return (
        os.getenv("NOTIFICATION_DASHBOARD_URL") or "https://your-app.com/dashboard"
    ).strip()


def _strip_emoji(text: str) -> str:
    return _EMOJI_RE.sub("", text or "").strip()


def _email_shell(
    *,
    title: str,
    accent: str,
    body_html: str,
    footer_note: str = "You received this because you subscribed to Early Warning alerts.",
) -> str:
    """Table-based HTML shell with inline styles for email clients."""
    safe_title = html.escape(title)
    safe_footer = html.escape(footer_note)
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{safe_title}</title></head>
<body style="margin:0;padding:0;background:#eef1f4;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f4;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d7dde5;">
        <tr>
          <td style="background:{accent};padding:18px 24px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.85);">AQI Nepal · Early Warning</p>
            <h1 style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:1.3;font-weight:700;color:#ffffff;">{safe_title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;">
            {body_html}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px 20px;border-top:1px solid #e5e9ef;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;color:#6b7280;">
            {safe_footer}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _parse_plain_alert_message(plain_message: str) -> tuple[list[tuple[str, str]], list[str], str | None, str | None]:
    """Extract detail rows, action bullets, advisory note, and dashboard URL from SMS-style text."""
    details: list[tuple[str, str]] = []
    actions: list[str] = []
    advisory: str | None = None
    dashboard: str | None = None
    in_actions = False

    for raw in (plain_message or "").splitlines():
        line = _strip_emoji(raw)
        if not line:
            continue
        lower = line.lower()
        if lower.startswith("dashboard:"):
            dashboard = line.split(":", 1)[1].strip()
            in_actions = False
            continue
        if "recommended actions" in lower or lower.startswith("guidance"):
            in_actions = True
            continue
        if line.startswith("•") or line.startswith("-") or line.startswith("*"):
            actions.append(line.lstrip("•-* ").strip())
            in_actions = True
            continue
        if in_actions:
            actions.append(line)
            continue
        if ":" in line and not lower.startswith("stay informed"):
            key, val = line.split(":", 1)
            key, val = key.strip(), val.strip()
            if key and val and len(key) <= 48:
                details.append((key, val))
                continue
        if lower.startswith("stay informed"):
            continue
        if advisory is None and len(line) > 24:
            advisory = line

    return details, actions, advisory, dashboard


def _render_alert_email_html(
    *,
    city: str,
    hazard_type: str,
    level_label: str,
    headline: str,
    plain_message: str,
) -> str:
    haz = (hazard_type or "air").strip().lower()
    level = (level_label or "").strip().upper() or "ALERT"
    accent = _ALERT_LEVEL_COLORS.get(level, "#0f4c5c")

    if haz == "heat":
        title = "Heat Readiness Alert"
    elif haz == "respiratory_surge":
        title = "Respiratory Surge Alert"
    else:
        title = "Air Quality Alert"

    details, actions, advisory, dashboard_from_msg = _parse_plain_alert_message(plain_message)
    dashboard = dashboard_from_msg or _notification_dashboard_url()

    # Ensure core fields are present even if message_override is free-form.
    known_keys = {k.lower() for k, _ in details}
    if "location" not in known_keys and city:
        details.insert(0, ("Location", city))
    if "level" not in known_keys and level:
        details.insert(1 if details else 0, ("Level", level))
    if (
        haz == "air"
        and headline
        and str(headline).strip().upper() != level
        and not any("aqi" in k.lower() or "index" in k.lower() for k, _ in details)
    ):
        details.append(("Index", str(headline)))

    rows_html = "".join(
        f"""<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eef1f4;font-size:13px;color:#6b7280;width:38%;vertical-align:top;">{html.escape(k)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eef1f4;font-size:14px;color:#111827;font-weight:600;">{html.escape(v)}</td>
        </tr>"""
        for k, v in details
    )

    actions_html = ""
    if actions:
        items = "".join(f"<li style='margin:0 0 8px;'>{html.escape(a)}</li>" for a in actions)
        actions_html = f"""
        <p style="margin:22px 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;font-weight:700;">Recommended actions</p>
        <ul style="margin:0;padding-left:18px;color:#1f2933;">{items}</ul>
        """

    advisory_html = ""
    if advisory:
        advisory_html = (
            f"<p style='margin:16px 0 0;padding:12px 14px;background:#f7f9fb;"
            f"border-left:3px solid {accent};color:#374151;font-size:14px;'>"
            f"{html.escape(advisory)}</p>"
        )

    cta_html = ""
    if dashboard and "your-app.com" not in dashboard:
        safe_url = html.escape(dashboard, quote=True)
        cta_html = f"""
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
          <tr><td style="background:{accent};border-radius:4px;">
            <a href="{safe_url}" style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Open dashboard</a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:12px;color:#6b7280;word-break:break-all;">{html.escape(dashboard)}</p>
        """
    elif dashboard:
        cta_html = f"<p style='margin:20px 0 0;font-size:13px;color:#6b7280;'>Dashboard: {html.escape(dashboard)}</p>"

    body = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        An environmental alert has been issued for <strong>{html.escape(city)}</strong>.
      </p>
      <p style="margin:0 0 18px;">
        <span style="display:inline-block;padding:6px 12px;background:{accent};color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;border-radius:3px;">{html.escape(level)}</span>
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows_html}</table>
      {advisory_html}
      {actions_html}
      {cta_html}
    """
    return _email_shell(title=title, accent=accent, body_html=body)


def _render_shared_alert_email_html(
    *,
    sender_name: str,
    message: str,
    recipient_display_name: str | None = None,
) -> tuple[str, str]:
    """
    Branded HTML + plain-text body for friend/family one-off emails.

    Returns ``(html_content, plain_text)`` for SendGrid multipart delivery.
    """
    safe_sender = html.escape((sender_name or "Early Warning user").strip() or "Early Warning user")
    safe_msg = html.escape((message or "").strip()).replace("\n", "<br>\n")
    greeting_name = (recipient_display_name or "").strip()
    greeting = (
        f"Hello {html.escape(greeting_name)},"
        if greeting_name
        else "Hello,"
    )
    accent = "#1565c0"
    title = "Personal message via Early Warning"
    body = f"""
      <p style="margin:0 0 14px;font-size:15px;color:#374151;">{greeting}</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        <strong>{safe_sender}</strong> sent you a message through the
        <strong>AQI Nepal Early Warning</strong> friends &amp; family tool.
        This is a personal note from someone who listed you as an emergency contact —
        it is <em>not</em> an automated air-quality or heat broadcast from the platform.
      </p>
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;font-weight:700;">
        Message
      </p>
      <div style="margin:0 0 20px;padding:14px 16px;background:#f7f9fb;border-left:3px solid {accent};border-radius:0 4px 4px 0;color:#1f2933;font-size:15px;line-height:1.55;">
        {safe_msg}
      </div>
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
        If you did not expect this message, you can ignore it or ask the sender to remove you from their contact list.
        Do not reply to this email for emergencies — contact local emergency services if you need urgent help.
      </p>
    """
    html_content = _email_shell(
        title=title,
        accent=accent,
        body_html=body,
        footer_note=(
            "Sent via AQI Nepal Early Warning · Friends & family alerts. "
            "This message was initiated by a registered user, not by an automatic alert rule."
        ),
    )
    plain_name = greeting_name or "there"
    plain_sender = (sender_name or "Early Warning user").strip() or "Early Warning user"
    plain_msg = (message or "").strip()
    plain_text = (
        f"Hello {plain_name},\n\n"
        f"{plain_sender} sent you a message through the AQI Nepal Early Warning "
        f"friends & family tool. This is a personal note — not an automated "
        f"air-quality or heat broadcast.\n\n"
        f"Message:\n{plain_msg}\n\n"
        f"If you did not expect this, ask the sender to remove you from their list. "
        f"Do not reply to this email for emergencies.\n\n"
        f"— AQI Nepal Early Warning"
    )
    return html_content, plain_text


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    plain_text: str | None = None,
) -> dict[str, Any]:
    key = _sendgrid_api_key_effective()
    from_email = _sendgrid_from_effective()
    if not key:
        return {
            "success": False,
            "status": "failed",
            "error": "sendgrid_not_configured",
        }
    content: list[dict[str, str]] = []
    if plain_text:
        content.append({"type": "text/plain", "value": plain_text})
    content.append({"type": "text/html", "value": html_content})
    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email, "name": "AQI Nepal Early Warning"},
        "subject": subject,
        "content": content,
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                SENDGRID_MAIL_API_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if response.status_code in (200, 202):
            return {"success": True, "status": "sent"}
        body_preview = (response.text or "")[:1200]
        logger.warning(
            "SendGrid rejected email: status=%s to=%s from=%s preview=%s",
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
        logger.warning("SendGrid email transport error to %s: %s", to_email, exc)
        return {"success": False, "error": str(exc), "status": "failed"}


async def _dispatch_verification_email(
    db: Any,
    contact_id: ObjectId,
    email: str,
    name: str,
    code: str,
) -> dict[str, Any]:
    safe_name = html.escape(name or "there")
    safe_code = html.escape(code)
    body = f"""
      <p style="margin:0 0 12px;">Hi {safe_name},</p>
      <p style="margin:0 0 18px;color:#374151;">Use this code to verify your Early Warning registration:</p>
      <p style="margin:0 0 18px;text-align:center;font-family:Consolas,Monaco,monospace;font-size:32px;letter-spacing:0.28em;font-weight:700;color:#0f4c5c;">{safe_code}</p>
      <p style="margin:0;font-size:13px;color:#6b7280;">This code expires in 24 hours. If you did not request registration, you can ignore this email.</p>
    """
    html_content = _email_shell(
        title="Verify your registration",
        accent="#0f4c5c",
        body_html=body,
        footer_note="AQI Nepal Early Warning System",
    )
    plain = (
        f"Hi {name},\n\n"
        f"Your Early Warning verification code is: {code}\n\n"
        f"This code expires in 24 hours.\n"
    )
    result = await send_email(
        email,
        "Verify your Early Warning registration",
        html_content,
        plain_text=plain,
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
    raw_err = result.get("error") or "sendgrid_send_failed"
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
        if _sendgrid_configured():
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
            if _sendgrid_configured():
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


async def _send_account_deletion_code(db: Any, doc: dict[str, Any], code: str) -> list[str]:
    """Dispatch a short-lived OTP used to confirm public account deletion."""
    warnings: list[str] = []
    contact_id = doc["_id"]
    chans = list(doc.get("preferred_channels") or [])
    # Always try email when present so users who only set phone still get a path
    # when email is the recovery identifier for Play Store deletion.
    if "email" not in chans and doc.get("email"):
        chans = [*chans, "email"]
    name = str(doc.get("name") or "")
    ttl = _ACCOUNT_DELETION_CODE_TTL_MINUTES
    hint = (
        f"Early Warning account deletion code: {code}. "
        f"Valid {ttl} minutes. If you did not request this, ignore this message."
    )

    try:
        if "email" in chans and doc.get("email"):
            if _sendgrid_configured():
                safe_name = html.escape(name or "there")
                safe_code = html.escape(code)
                body = f"""
                  <p style="margin:0 0 12px;">Hi {safe_name},</p>
                  <p style="margin:0 0 18px;color:#374151;">
                    Use this code to confirm permanent deletion of your Early Warning account
                    and associated personal data:
                  </p>
                  <p style="margin:0 0 18px;text-align:center;font-family:Consolas,Monaco,monospace;font-size:32px;letter-spacing:0.28em;font-weight:700;color:#9b1c1c;">{safe_code}</p>
                  <p style="margin:0;font-size:13px;color:#6b7280;">
                    This code expires in {ttl} minutes. If you did not request account deletion,
                    you can ignore this email — your account will remain active.
                  </p>
                """
                html_content = _email_shell(
                    title="Confirm account deletion",
                    accent="#9b1c1c",
                    body_html=body,
                    footer_note="AQI Nepal Early Warning System",
                )
                plain = (
                    f"Hi {name or 'there'},\n\n"
                    f"Your Early Warning account deletion code is: {code}\n\n"
                    f"This code expires in {ttl} minutes.\n"
                    f"If you did not request this, ignore this email.\n"
                )
                er = await send_email(
                    doc["email"],
                    "Confirm Early Warning account deletion",
                    html_content,
                    plain_text=plain,
                )
                if er.get("success"):
                    await db.notification_logs.insert_one(
                        {
                            "recipient_id": str(contact_id),
                            "channel": "email",
                            "recipient": doc["email"],
                            "type": "account_deletion",
                            "status": "sent",
                            "timestamp": datetime.utcnow(),
                        }
                    )
                else:
                    warnings.append(
                        f"email_deletion_code_failed:{er.get('error', 'unknown')}"
                    )
            else:
                warnings.append("email_deletion_code_skipped_resend_not_configured")
        if "sms" in chans and doc.get("phone_number"):
            if twilio_notify.twilio_configured():
                result = await send_sms(doc["phone_number"], hint)
                if result.get("success"):
                    await db.notification_logs.insert_one(
                        {
                            "recipient_id": str(contact_id),
                            "channel": "sms",
                            "recipient": doc["phone_number"],
                            "type": "account_deletion",
                            "status": "sent",
                            "twilio_sid": result.get("sid"),
                            "timestamp": datetime.utcnow(),
                        }
                    )
                else:
                    warnings.append(
                        f"sms_deletion_failed:{result.get('error', 'unknown')}"
                    )
            else:
                warnings.append("sms_deletion_code_skipped_twilio_not_configured")
        if "whatsapp" in chans:
            wa = doc.get("whatsapp_number") or doc.get("phone_number")
            if wa and twilio_notify.twilio_configured():
                result = await send_whatsapp(wa, hint)
                if result.get("success"):
                    await db.notification_logs.insert_one(
                        {
                            "recipient_id": str(contact_id),
                            "channel": "whatsapp",
                            "recipient": wa,
                            "type": "account_deletion",
                            "status": "sent",
                            "twilio_sid": result.get("sid"),
                            "timestamp": datetime.utcnow(),
                        }
                    )
                else:
                    warnings.append(
                        f"whatsapp_deletion_failed:{result.get('error', 'unknown')}"
                    )
            elif wa:
                warnings.append("whatsapp_deletion_skipped_twilio_not_configured")
    except Exception as exc:  # noqa: BLE001
        logger.exception("account deletion code dispatch failed: %s", exc)
        warnings.append(f"account_deletion_dispatch_exception:{str(exc)[:200]}")
    return warnings


def _session_reverification_days() -> int:
    """0 = disabled (password-only after initial registration verify)."""
    try:
        v = int((os.getenv("SESSION_REVERIFICATION_DAYS") or "90").strip())
        return max(0, min(3650, v))
    except ValueError:
        return 90


def _session_reverification_code_ttl_minutes() -> int:
    try:
        return max(5, min(120, int((os.getenv("SESSION_REVERIFICATION_CODE_TTL_MINUTES") or "30").strip())))
    except ValueError:
        return 30


def _reverification_anchor(doc: dict[str, Any]) -> datetime | None:
    sr = doc.get("session_reverified_at")
    if isinstance(sr, datetime):
        return sr
    va = doc.get("verified_at")
    return va if isinstance(va, datetime) else None


def _needs_session_reverification(doc: dict[str, Any]) -> bool:
    days = _session_reverification_days()
    if days <= 0:
        return False
    anchor = _reverification_anchor(doc)
    if anchor is None:
        return False
    return datetime.utcnow() > anchor + timedelta(days=days)


async def _send_session_reverification_code(
    db: Any, doc: dict[str, Any], code: str, ttl_minutes: int
) -> list[str]:
    """90-day (or configured) security codes; same outbound channels as facility OTP."""
    warnings: list[str] = []
    contact_id = doc["_id"]
    chans = doc.get("preferred_channels") or []
    name = str(doc.get("name") or "")
    hint = (
        f"Early Warning periodic renewal code: {code}. Valid {ttl_minutes} minutes. "
        "Use it when signing in with your current password and a NEW dashboard password."
    )

    try:
        if "email" in chans:
            if _sendgrid_configured():
                er = await send_email(
                    doc["email"],
                    "Security code — Early Warning dashboard",
                    f"<p>{name or 'Hello'},</p><p>{hint}</p>",
                )
                if not er.get("success"):
                    warnings.append(f"email_reverify_failed:{er.get('error', 'unknown')}")
            else:
                warnings.append("email_reverify_skipped_sendgrid_not_configured")
        if "sms" in chans:
            if twilio_notify.twilio_configured():
                result = await send_sms(doc["phone_number"], hint)
                if result.get("success"):
                    await db.notification_logs.insert_one(
                        {
                            "recipient_id": str(contact_id),
                            "channel": "sms",
                            "recipient": doc["phone_number"],
                            "type": "session_reverify",
                            "status": "sent",
                            "twilio_sid": result.get("sid"),
                            "timestamp": datetime.utcnow(),
                        }
                    )
                else:
                    warnings.append(f"sms_reverify_failed:{result.get('error', 'unknown')}")
            else:
                warnings.append("sms_reverify_skipped_twilio_not_configured")
        if "whatsapp" in chans:
            if twilio_notify.twilio_configured():
                result = await send_whatsapp(doc.get("whatsapp_number") or doc["phone_number"], hint)
                if result.get("success"):
                    await db.notification_logs.insert_one(
                        {
                            "recipient_id": str(contact_id),
                            "channel": "whatsapp",
                            "recipient": doc.get("whatsapp_number") or doc["phone_number"],
                            "type": "session_reverify",
                            "status": "sent",
                            "twilio_sid": result.get("sid"),
                            "timestamp": datetime.utcnow(),
                        }
                    )
                else:
                    warnings.append(f"whatsapp_reverify_failed:{result.get('error', 'unknown')}")
            else:
                warnings.append("whatsapp_reverify_skipped_twilio_not_configured")
    except Exception as exc:  # noqa: BLE001
        logger.exception("session reverification code dispatch failed: %s", exc)
        warnings.append(f"session_reverify_dispatch_exception:{str(exc)[:200]}")
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
        logger.warning(
            "registration rejected: phone must be E.164 (start with +); got %s chars starting %r",
            len(contact.phone_number.strip()),
            contact.phone_number.strip()[:3],
        )
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
    try:
        norm_cities, primary_city = _normalize_city_list(contact.cities, contact.city)
    except HTTPException:
        logger.warning(
            "registration rejected: invalid municipality payload cities=%r city=%r",
            contact.cities,
            contact.city,
        )
        raise
    if not norm_cities:
        logger.warning("registration rejected: no coverage cities after normalize")
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


async def _finalize_contact_verification(db: Any, doc: dict[str, Any]) -> dict[str, Any]:
    """Mark contact verified after code matched; shared by ``/verify`` and ``/verify-with-email``."""
    oid = doc["_id"]
    apr_now = str(doc.get("approval_status") or "").strip().lower()
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

    if doc.get("verification_code") != body.verification_code:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    return await _finalize_contact_verification(db, doc)


@router.post("/api/contacts/verify-with-email")
async def verify_contact_with_email(body: VerifyContactEmailIn):
    """
    Same as ``POST /api/contacts/verify`` but identifies the row by **registration email**
    (so users do not need the Mongo ``contact_id``). Pending registrations only.
    """
    db = db_state.require_mongo_db()
    email_key = str(body.email).strip()
    doc = await db.contacts.find_one({"email": email_key})
    if not doc:
        await asyncio.sleep(0.14)
        raise HTTPException(
            status_code=400,
            detail="Invalid email or verification code.",
        )
    vs = str(doc.get("verification_status") or "").strip().lower()
    if vs != "pending":
        raise HTTPException(
            status_code=400,
            detail="This email is not waiting for verification — try signing in.",
        )
    apr_now = str(doc.get("approval_status") or "").strip().lower()
    if apr_now == "revoked":
        raise HTTPException(status_code=403, detail="This registration has been revoked")

    if doc.get("verification_code") != body.verification_code:
        await asyncio.sleep(0.08)
        raise HTTPException(status_code=400, detail="Invalid email or verification code.")

    return await _finalize_contact_verification(db, doc)


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


async def operator_resend_registration_verification_by_id(contact_id: str) -> dict[str, Any]:
    """
    Operator resend for ``verification_status=pending`` contacts.

    Does **not** apply the public email cooldown (``VERIFICATION_RESEND_COOLDOWN_SECONDS``);
    use from ``POST /api/admin/registrants/{id}/resend-verification`` only.
    """
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(contact_id.strip())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid contact_id") from exc

    doc = await db.contacts.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Contact not found")
    if str(doc.get("approval_status") or "").strip().lower() == "revoked":
        raise HTTPException(status_code=403, detail="Registration revoked")
    vs = str(doc.get("verification_status") or "").strip().lower()
    if vs != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Not awaiting verification (verification_status={vs or 'unknown'}).",
        )

    code = _verification_code()
    cid = doc["_id"]
    chans_raw = doc.get("preferred_channels") or []
    chans = [str(c) for c in chans_raw]
    normalized_phone = str(doc.get("phone_number") or "")
    normalized_whatsapp = str(doc.get("whatsapp_number") or "") or normalized_phone
    disp_name = str(doc.get("name") or "")
    disp_email = str(doc.get("email") or "")

    await db.contacts.update_one(
        {"_id": cid},
        {"$set": {"verification_code": code, "verification_last_sent_at": datetime.utcnow()}},
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
        logger.exception("Operator resend verification dispatch failed: %s", exc)
        raise HTTPException(status_code=500, detail="Verification dispatch failed") from exc

    out: dict[str, Any] = {
        "success": True,
        "contact_id": str(cid),
        "message": "Verification code sent to the enrollee's preferred channel(s).",
        "channels": chans,
    }
    if warnings:
        out["warnings"] = warnings
    return out


async def _log_registrant_unverified_login_attempt(email_key: str, doc: dict[str, Any]) -> None:
    """Persist a row for the admin activity feed; optional email if ``ADMIN_UNVERIFIED_LOGIN_ALERT_EMAIL`` is set."""
    mdb = db_state.mongo_db
    if mdb is None:
        return
    oid = doc.get("_id")
    cid_str = str(oid) if oid is not None else ""
    entry: dict[str, Any] = {
        "action_type": "registrant_login_blocked_unverified",
        "contact_id": cid_str,
        "facility_id": str(doc.get("facility_id") or "").strip() or None,
        "facility_name": doc.get("facility_name"),
        "city": doc.get("city"),
        "reported_by_email_hash": hashlib.sha256(email_key.lower().encode("utf-8")).hexdigest()[:24],
        "details": "Dashboard password login blocked: complete verification (POST /api/contacts/verify) first.",
        "timestamp": datetime.utcnow(),
    }
    try:
        await mdb.action_logs.insert_one(entry)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not log unverified login attempt: %s", str(exc)[:300])

    alert_to = (os.getenv("ADMIN_UNVERIFIED_LOGIN_ALERT_EMAIL") or "").strip()
    if not alert_to:
        return
    name = str(doc.get("name") or "")
    subj = f"[Early warning] Unverified login attempt: {email_key}"
    body = (
        f"<p>Someone entered the correct password but <strong>verification_status</strong> is not verified yet.</p>"
        f"<p>Email: {email_key}<br/>Name: {name}<br/>Contact id: {cid_str}</p>"
        f"<p>Operators can resend the code from <strong>Admin → Registered enrollees → Resend verify</strong> "
        f"or the user can use <strong>POST /api/contacts/resend-verification</strong>.</p>"
    )
    try:
        await send_email(alert_to, subj, body)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ADMIN_UNVERIFIED_LOGIN_ALERT_EMAIL send failed: %s", str(exc)[:300])


@router.post("/api/auth/login")
async def registrant_dashboard_login(body: RegistrantLoginIn):
    """
    Email + password → registrant session JWT (used for dashboard and, when eligible, facility actions).

    After initial registration, users verify once with the signup code. Optionally, about every
    ``SESSION_REVERIFICATION_DAYS`` (default 90), renewal requires a channel code plus choosing a **new password**
    with the **current password** (disabled when ``SESSION_REVERIFICATION_DAYS=0``).
    """
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
        await _log_registrant_unverified_login_attempt(email_key, doc)
        raise HTTPException(status_code=403, detail="Verify your registration (code) before signing in.")

    if _needs_session_reverification(doc):
        code_in = (body.reverification_code or "").strip()
        new_pw = (body.new_password or "").strip()

        if code_in:
            stored = doc.get("session_reverification_code")
            exp_at = doc.get("session_reverification_expires_at")
            if stored != code_in:
                raise HTTPException(status_code=400, detail="Invalid security code")
            if isinstance(exp_at, datetime) and datetime.utcnow() > exp_at:
                raise HTTPException(
                    status_code=400,
                    detail="Security code expired — sign in again without a code to receive a new one.",
                )
            if len(new_pw) < 8:
                raise HTTPException(
                    status_code=400,
                    detail="Periodic renewal requires a NEW password — at least 8 characters.",
                )
            cur_hash = str(doc.get("password_hash") or "")
            if registrant_auth.verify_password(new_pw, cur_hash):
                raise HTTPException(
                    status_code=400,
                    detail="Choose a new password that differs from your current one.",
                )
            await db.contacts.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "session_reverified_at": datetime.utcnow(),
                        "password_hash": registrant_auth.hash_password(new_pw),
                    },
                    "$unset": {
                        "session_reverification_code": "",
                        "session_reverification_expires_at": "",
                    },
                },
            )
            doc = await db.contacts.find_one({"_id": doc["_id"]})
            if not doc:
                raise HTTPException(status_code=500, detail="Contact state lost — try again.")
        else:
            existing_exp = doc.get("session_reverification_expires_at")
            pending_valid = (
                doc.get("session_reverification_code")
                and isinstance(existing_exp, datetime)
                and datetime.utcnow() <= existing_exp
            )
            if pending_valid:
                ttl_left = max(1, int((existing_exp - datetime.utcnow()).total_seconds() // 60))
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "reverification_required",
                        "requires_password_change": True,
                        "message": (
                            "Annual renewal: enter the security code we sent PLUS a NEW password (8+ characters) "
                            "with your CURRENT password."
                        ),
                        "code_ttl_minutes": ttl_left,
                        "code_already_sent": True,
                    },
                )
            ttl_m = _session_reverification_code_ttl_minutes()
            code_new = _verification_code()
            exp_new = datetime.utcnow() + timedelta(minutes=ttl_m)
            await db.contacts.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "session_reverification_code": code_new,
                        "session_reverification_expires_at": exp_new,
                    },
                },
            )
            merged = dict(doc)
            merged["session_reverification_code"] = code_new
            warns = await _send_session_reverification_code(db, merged, code_new, ttl_m)
            detail_any: dict[str, Any] = {
                "error": "reverification_required",
                "requires_password_change": True,
                "message": (
                    "Periodic renewal: we sent a security code to your channels. "
                    "Sign in again with CURRENT password + code + NEW password (see form below)."
                ),
                "code_ttl_minutes": ttl_m,
            }
            if warns:
                detail_any["warnings"] = warns
            raise HTTPException(status_code=403, detail=detail_any)

    token, ttl = registrant_auth.mint_registrant_session_token(doc)
    scopes = registrant_auth.compute_registrant_scopes(doc)
    cov = doc.get("cities")
    eff_fac = facility_auth.effective_facility_id(doc)
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
        "facility_id": eff_fac,
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
    for k in (
        "password_hash",
        "verification_code",
        "facility_login_code",
        "facility_login_expires_at",
        "session_reverification_code",
        "session_reverification_expires_at",
        "shared_alert_contacts",
    ):
        out.pop(k, None)
    out["scopes"] = registrant_auth.compute_registrant_scopes(doc)
    out["facility_name"] = facility_auth.facility_display_name(doc)
    out["facility_id"] = facility_auth.effective_facility_id(doc)
    return out


def _authorization_bearer_raw(authorization: str | None) -> str | None:
    if authorization and authorization.strip().lower().startswith("bearer "):
        return authorization.strip()[7:].strip()
    return None


def _contact_id_from_dashboard_bearer_token(token: str | None) -> str | None:
    """Resolve Mongo contact id from registrant session JWT or facility-actions JWT."""
    if not token:
        return None
    rc = registrant_auth.decode_registrant_token_optional(token)
    if rc:
        s = str(rc.get("cid") or rc.get("sub") or "").strip()
        return s or None
    fc = facility_auth.decode_facility_access_token_optional(token)
    if fc:
        s = str(fc.get("cid") or fc.get("sub") or "").strip()
        return s or None
    return None


@router.get("/api/auth/profile")
async def dashboard_registration_profile(authorization: str | None = Header(None)):
    """
    Full enrolment record for the signed-in user (same shape as ``GET /api/auth/me``).

    Accepts **either** a registrant session token (``POST /api/auth/login``) **or**
    a facility reporting token (``POST /api/auth/facility-token`` after OTP) so dashboard
    users can read their profile regardless of sign-in method.
    """
    raw = _authorization_bearer_raw(authorization)
    cid = _contact_id_from_dashboard_bearer_token(raw)
    if not cid:
        raise HTTPException(
            status_code=401,
            detail="Sign in required — use password or OTP under Facility Actions, then retry.",
        )
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(cid)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid session identity") from exc
    doc = await db.contacts.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Contact not found")
    if str(doc.get("approval_status") or "").strip().lower() == "revoked":
        raise HTTPException(status_code=403, detail="This registration has been revoked")
    out = dict(doc)
    oid_out = out.pop("_id", None)
    out["_id"] = str(oid_out) if oid_out is not None else ""
    for k in (
        "password_hash",
        "verification_code",
        "facility_login_code",
        "facility_login_expires_at",
        "session_reverification_code",
        "session_reverification_expires_at",
        "shared_alert_contacts",
    ):
        out.pop(k, None)
    out["scopes"] = registrant_auth.compute_registrant_scopes(doc)
    out["facility_name"] = facility_auth.facility_display_name(doc)
    out["facility_id"] = facility_auth.effective_facility_id(doc)
    out["facility_reporting_ready"] = registrant_auth.registrant_can_facility_actions(doc)
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


@router.post("/api/auth/delete-account")
async def registrant_delete_own_account(
    body: DeleteAccountIn,
    session: registrant_auth.RegistrantSession = Depends(registrant_auth.load_registrant_session),
):
    """
    Permanently delete the signed-in registrant's account and associated personal data.
    Requires the current password and confirm phrase DELETE.
    Facility OTP sessions cannot wipe the account — use a password session.
    """
    if body.confirm.strip() != _ACCOUNT_DELETION_CONFIRM_PHRASE:
        raise HTTPException(
            status_code=400,
            detail=f"confirm must be exactly {_ACCOUNT_DELETION_CONFIRM_PHRASE}",
        )
    db = db_state.require_mongo_db()
    oid = ObjectId(session.contact_id)
    doc = await db.contacts.find_one({"_id": oid})
    if not doc or not doc.get("password_hash"):
        raise HTTPException(status_code=400, detail="Password state invalid — contact support")
    if not registrant_auth.verify_password(body.password, str(doc["password_hash"])):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    result = await account_deletion.delete_contact_and_related(db, session.contact_id)
    result["message"] = "Account and associated personal data deleted."
    return result


@router.post("/api/auth/delete-account/request")
async def public_delete_account_request(body: DeleteAccountRequestIn):
    """
    Send a short-lived OTP so the user can confirm account deletion without the app.
    Response shape is deliberately uniform to avoid leaking which emails exist.
    """
    db = db_state.require_mongo_db()
    email_key = str(body.email).strip()
    generic = (
        "If this email is registered, a confirmation code was sent to configured channels."
    )
    doc = await db.contacts.find_one({"email": email_key})
    if not doc and email_key != email_key.lower():
        doc = await db.contacts.find_one({"email": email_key.lower()})
    if not doc:
        doc = await db.contacts.find_one(
            {"email": {"$regex": f"^{re.escape(email_key)}$", "$options": "i"}}
        )
    if doc and doc.get("password_hash"):
        code = _verification_code()
        expires = datetime.utcnow() + timedelta(minutes=_ACCOUNT_DELETION_CODE_TTL_MINUTES)
        await db.contacts.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "account_deletion_code": code,
                    "account_deletion_expires_at": expires,
                }
            },
        )
        warnings = await _send_account_deletion_code(db, doc, code)
        out: dict[str, Any] = {
            "success": True,
            "message": generic,
            "code_ttl_minutes": _ACCOUNT_DELETION_CODE_TTL_MINUTES,
        }
        if warnings:
            out["warnings"] = warnings
        return out
    await asyncio.sleep(0.15)
    return {
        "success": True,
        "message": generic,
        "code_ttl_minutes": _ACCOUNT_DELETION_CODE_TTL_MINUTES,
    }


@router.post("/api/auth/delete-account/confirm")
async def public_delete_account_confirm(body: DeleteAccountConfirmIn):
    """Confirm public account deletion with email + OTP + DELETE phrase."""
    if body.confirm.strip() != _ACCOUNT_DELETION_CONFIRM_PHRASE:
        raise HTTPException(
            status_code=400,
            detail=f"confirm must be exactly {_ACCOUNT_DELETION_CONFIRM_PHRASE}",
        )
    db = db_state.require_mongo_db()
    email_key = str(body.email).strip()
    doc = await db.contacts.find_one({"email": email_key})
    if not doc and email_key != email_key.lower():
        doc = await db.contacts.find_one({"email": email_key.lower()})
    if not doc:
        doc = await db.contacts.find_one(
            {"email": {"$regex": f"^{re.escape(email_key)}$", "$options": "i"}}
        )
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid email or code")
    stored = doc.get("account_deletion_code")
    if not stored or stored != body.code.strip():
        raise HTTPException(status_code=400, detail="Invalid email or code")
    exp_at = doc.get("account_deletion_expires_at")
    if isinstance(exp_at, datetime):
        if datetime.utcnow() > exp_at:
            raise HTTPException(
                status_code=400,
                detail="Deletion code expired — request another",
            )
    elif exp_at is not None:
        raise HTTPException(
            status_code=400,
            detail="Invalid deletion state — request another code",
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="Deletion code expired — request another",
        )

    cid = str(doc["_id"])
    result = await account_deletion.delete_contact_and_related(db, cid)
    result["message"] = "Account and associated personal data deleted."
    return result


@router.patch("/api/auth/preferences")
async def registrant_patch_own_preferences(
    body: RegistrantSelfPrefsPatch,
    authorization: str | None = Header(None),
):
    """
    Update notification channels, optional facility name, and per-site PM2.5 thresholds on your own contact.
    Accepts the same ``Authorization: Bearer`` as ``GET /api/auth/profile`` (password or facility OTP session).
    """
    raw = _authorization_bearer_raw(authorization)
    cid = _contact_id_from_dashboard_bearer_token(raw)
    if not cid:
        raise HTTPException(status_code=401, detail="Sign in required.")
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(cid)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid session identity") from exc

    doc = await db.contacts.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Contact not found")
    if str(doc.get("approval_status") or "").strip().lower() == "revoked":
        raise HTTPException(status_code=403, detail="This registration has been revoked")
    vs = str(doc.get("verification_status") or "").strip().lower()
    if vs != "verified":
        raise HTTPException(status_code=403, detail="Verify your registration before changing preferences")

    updates: dict[str, Any] = {}

    payload = body.model_dump(exclude_unset=True)
    if "preferred_channels" in payload and body.preferred_channels is not None:
        updates["preferred_channels"] = [ch.value for ch in body.preferred_channels]
    if "consent_given" in payload and body.consent_given is not None:
        updates["consent_given"] = body.consent_given
    if "environmental_topics" in payload and body.environmental_topics is not None:
        updates["environmental_topics"] = _validated_environment_topics(
            body.environmental_topics,
            default_both=False,
        )

    merged = dict(doc)
    merged.update({k: v for k, v in updates.items() if k in updates})

    if body.add_facility_name and body.add_facility_name.strip():
        add_one = body.add_facility_name.strip()
        cur_names, _ = _normalize_facility_names(
            merged.get("facility_names") if isinstance(merged.get("facility_names"), list) else None,
            merged.get("facility_name"),
        )
        lower_have = {x.lower() for x in cur_names}
        if add_one.lower() not in lower_have:
            cur_names.append(add_one)
        new_names, summary = _normalize_facility_names(cur_names, None)
        updates["facility_names"] = new_names
        updates["facility_name"] = summary
        merged["facility_names"] = new_names
        merged["facility_name"] = summary

    if body.facility_site_pm25_thresholds is not None:
        labels = contact_facility_site_labels(merged)
        if not labels:
            raise HTTPException(
                status_code=400,
                detail="Add at least one facility name before setting per-site PM2.5 thresholds.",
            )
        cleaned: dict[str, float] = {}
        lower_map = {x.strip().lower(): x for x in labels}
        for k_raw, v in body.facility_site_pm25_thresholds.items():
            ks = str(k_raw).strip().lower()
            if ks not in lower_map:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown facility name in thresholds: {k_raw!r} (use one of your registered sites).",
                )
            if v is None or v < 5.0 or v > 600.0:
                raise HTTPException(
                    status_code=400,
                    detail=f"PM2.5 threshold must be between 5 and 600 µg/m³ ({k_raw!r}).",
                )
            canon = lower_map[ks]
            cleaned[canon] = float(v)
        updates["facility_site_pm25_thresholds"] = cleaned

    if not updates:
        raise HTTPException(status_code=400, detail="No changes applied")

    updates["updated_at"] = datetime.utcnow()

    await db.contacts.update_one({"_id": oid}, {"$set": updates})

    fresh = await db.contacts.find_one({"_id": oid})
    if fresh is None:
        return {"success": True, "message": "Updated."}

    if "preferred_channels" in updates or "consent_given" in updates:
        await db.consent_records.insert_one(
            {
                "contact_id": cid,
                "consent_given": bool(fresh.get("consent_given")),
                "channels": fresh.get("preferred_channels") or [],
                "timestamp": datetime.utcnow(),
                "source": "registrant_self_service",
            }
        )

    out = dict(fresh)
    oid_out = out.pop("_id", None)
    out["_id"] = str(oid_out) if oid_out is not None else ""
    for k in (
        "password_hash",
        "verification_code",
        "facility_login_code",
        "facility_login_expires_at",
        "session_reverification_code",
        "session_reverification_expires_at",
        "shared_alert_contacts",
    ):
        out.pop(k, None)
    out["scopes"] = registrant_auth.compute_registrant_scopes(fresh)
    out["facility_name"] = facility_auth.facility_display_name(fresh)
    out["facility_id"] = facility_auth.effective_facility_id(fresh)
    out["facility_reporting_ready"] = registrant_auth.registrant_can_facility_actions(fresh)
    return {"success": True, "message": "Preferences saved.", "profile": out}


def _log_ts_iso(ts: Any) -> str | None:
    if isinstance(ts, datetime):
        return ts.replace(microsecond=0).isoformat() + "Z"
    return None


def _shared_alert_max_contacts() -> int:
    raw = (os.getenv("SHARED_ALERT_CONTACTS_MAX") or "50").strip()
    try:
        n = int(raw)
    except ValueError:
        n = 50
    return max(1, min(n, 500))


def _shared_alert_daily_notify_cap() -> int:
    raw = (os.getenv("SHARED_ALERT_NOTIFY_DAILY_MAX") or "100").strip()
    try:
        n = int(raw)
    except ValueError:
        n = 100
    return max(1, min(n, 5000))


def _utc_midnight_today() -> datetime:
    now = datetime.utcnow()
    return datetime(now.year, now.month, now.day)


async def _shared_alerts_recipients_sent_today(db: Any, initiator_cid: str) -> int:
    start = _utc_midnight_today()
    cursor = db.shared_alert_dispatch_log.aggregate(
        [
            {
                "$match": {
                    "initiator_contact_id": initiator_cid,
                    "timestamp": {"$gte": start},
                }
            },
            {"$group": {"_id": None, "n": {"$sum": "$recipient_count"}}},
        ]
    )
    rows = await cursor.to_list(1)
    if not rows:
        return 0
    return int(rows[0].get("n") or 0)


def _normalize_shared_phone_e164(raw: str) -> str:
    s = raw.strip().replace(" ", "").replace("-", "")
    if not s.startswith("+"):
        raise HTTPException(
            status_code=400,
            detail="Phone must be in E.164 form starting with + (e.g. +593991234567).",
        )
    return twilio_notify.normalize_e164(s)


def _mask_destination(channel: str, phone: str | None, email: str | None) -> str:
    if channel == "email" and email:
        e = str(email).strip()
        if "@" in e and len(e) > 4:
            a, _, d = e.partition("@")
            return (a[:2] + "***@" + d) if len(a) > 2 else "***@" + d
        return "***"
    if phone:
        p = phone.strip()
        if len(p) > 6:
            return p[:3] + "…" + p[-2:]
        return "***"
    return "(unknown)"


def _merge_shared_contact_updates(
    existing: dict[str, Any], body: SharedAlertContactUpdate
) -> SharedAlertContactCreate:
    ch = body.channel if body.channel is not None else str(existing.get("channel") or "sms")
    if ch not in ("sms", "email", "whatsapp"):
        ch = "sms"
    disp = body.display_name if body.display_name is not None else str(
        existing.get("display_name") or ""
    )
    phone_src = (
        body.phone_e164
        if body.phone_e164 is not None
        else existing.get("phone_e164")
    )
    email_src = body.email if body.email is not None else existing.get("email")
    return SharedAlertContactCreate(
        display_name=disp,
        channel=ch,  # type: ignore[arg-type]
        phone_e164=str(phone_src).strip() if phone_src else None,
        email=email_src,
    )


@router.get("/api/auth/shared-contacts")
async def registrant_list_shared_contacts(
    authorization: str | None = Header(None),
):
    """Friends & family list for optional SMS / email / WhatsApp from the dashboard (not included in profile JSON)."""
    raw = _authorization_bearer_raw(authorization)
    cid = _contact_id_from_dashboard_bearer_token(raw)
    if not cid:
        raise HTTPException(status_code=401, detail="Sign in required.")
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(cid)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid session identity") from exc
    doc = await db.contacts.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Contact not found")
    if str(doc.get("approval_status") or "").strip().lower() == "revoked":
        raise HTTPException(status_code=403, detail="This registration has been revoked")
    rows = doc.get("shared_alert_contacts")
    if not isinstance(rows, list):
        rows = []
    out_list: list[dict[str, Any]] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        cid_row = str(r.get("id") or "").strip()
        if not cid_row:
            continue
        channel = str(r.get("channel") or "sms").strip().lower()
        if channel not in ("sms", "email", "whatsapp"):
            channel = "sms"
        created = r.get("created_at")
        updated = r.get("updated_at")
        out_list.append(
            {
                "id": cid_row,
                "display_name": str(r.get("display_name") or "").strip() or "Contact",
                "channel": channel,
                "phone_e164": r.get("phone_e164"),
                "email": r.get("email"),
                "created_at": _log_ts_iso(created) if isinstance(created, datetime) else None,
                "updated_at": _log_ts_iso(updated) if isinstance(updated, datetime) else None,
            }
        )
    cap = _shared_alert_max_contacts()
    daily_cap = _shared_alert_daily_notify_cap()
    sent_today = await _shared_alerts_recipients_sent_today(db, cid)
    return {
        "contacts": out_list,
        "limits": {
            "max_contacts": cap,
            "notify_recipients_daily_max": daily_cap,
            "notify_recipients_sent_today": sent_today,
        },
    }


@router.post("/api/auth/shared-contacts")
async def registrant_create_shared_contact(
    body: SharedAlertContactCreate,
    authorization: str | None = Header(None),
):
    raw = _authorization_bearer_raw(authorization)
    cid = _contact_id_from_dashboard_bearer_token(raw)
    if not cid:
        raise HTTPException(status_code=401, detail="Sign in required.")
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(cid)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid session identity") from exc
    doc = await db.contacts.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Contact not found")
    if str(doc.get("approval_status") or "").strip().lower() == "revoked":
        raise HTTPException(status_code=403, detail="This registration has been revoked")
    vs = str(doc.get("verification_status") or "").strip().lower()
    if vs != "verified":
        raise HTTPException(status_code=403, detail="Verify your registration before managing contacts")

    cur = doc.get("shared_alert_contacts")
    lst: list[dict[str, Any]] = [x for x in cur if isinstance(x, dict)] if isinstance(cur, list) else []
    cap = _shared_alert_max_contacts()
    if len(lst) >= cap:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {cap} contacts — remove one or increase SHARED_ALERT_CONTACTS_MAX.",
        )

    phone_norm: str | None = None
    email_norm: str | None = None
    if body.channel in ("sms", "whatsapp"):
        phone_norm = _normalize_shared_phone_e164(body.phone_e164 or "")
    if body.channel == "email":
        email_norm = str(body.email).strip().lower() if body.email else None
        if not email_norm:
            raise HTTPException(status_code=400, detail="email is required for email channel")

    now = datetime.utcnow()
    new_id = str(uuid.uuid4())
    entry: dict[str, Any] = {
        "id": new_id,
        "display_name": body.display_name.strip(),
        "channel": body.channel,
        "phone_e164": phone_norm,
        "email": email_norm,
        "created_at": now,
        "updated_at": now,
    }
    lst.append(entry)
    await db.contacts.update_one(
        {"_id": oid},
        {"$set": {"shared_alert_contacts": lst, "updated_at": now}},
    )
    return {"success": True, "contact": {"id": new_id, **{k: v for k, v in entry.items() if k != "created_at"}}}


@router.post("/api/auth/shared-contacts/notify")
async def registrant_notify_shared_contacts(
    body: SharedNotifyIn,
    authorization: str | None = Header(None),
):
    """Send a one-off message to selected saved contacts (SMS / WhatsApp / email). Rate-limited per day."""
    raw = _authorization_bearer_raw(authorization)
    cid = _contact_id_from_dashboard_bearer_token(raw)
    if not cid:
        raise HTTPException(status_code=401, detail="Sign in required.")
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(cid)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid session identity") from exc
    doc = await db.contacts.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Contact not found")
    if str(doc.get("approval_status") or "").strip().lower() == "revoked":
        raise HTTPException(status_code=403, detail="This registration has been revoked")
    vs = str(doc.get("verification_status") or "").strip().lower()
    if vs != "verified":
        raise HTTPException(status_code=403, detail="Verify your registration before sending")

    cur = doc.get("shared_alert_contacts")
    lst: list[dict[str, Any]] = [x for x in cur if isinstance(x, dict)] if isinstance(cur, list) else []
    by_id = {str(r.get("id") or ""): r for r in lst if isinstance(r, dict) and r.get("id")}
    ordered_ids = list(dict.fromkeys(body.contact_ids))
    n_req = len(ordered_ids)
    daily_cap = _shared_alert_daily_notify_cap()
    sent_already = await _shared_alerts_recipients_sent_today(db, cid)
    if sent_already + n_req > daily_cap:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Daily limit for friend/family sends is {daily_cap} recipients "
                f"({sent_already} already today). Try again tomorrow or raise SHARED_ALERT_NOTIFY_DAILY_MAX."
            ),
        )

    sender_name = str(doc.get("name") or "Early Warning user").strip() or "Early Warning user"
    msg = body.message.strip()
    results: list[dict[str, Any]] = []
    for rid in ordered_ids:
        row = by_id.get(str(rid).strip())
        if not row:
            results.append(
                {
                    "contact_id": rid,
                    "ok": False,
                    "error": "not_found",
                }
            )
            continue
        channel = str(row.get("channel") or "sms").strip().lower()
        if channel not in ("sms", "email", "whatsapp"):
            channel = "sms"
        dest_display = _mask_destination(
            channel,
            str(row.get("phone_e164") or "") or None,
            str(row.get("email") or "") or None,
        )
        text = f"[{sender_name}] {msg}"

        async def _log_line(
            *,
            ch: str,
            status: str,
            ok: bool,
            err: str | None,
            extra: dict[str, Any] | None = None,
        ) -> None:
            log_payload: dict[str, Any] = {
                "recipient_id": cid,
                "channel": ch,
                "recipient": dest_display,
                "type": "shared_alert",
                "status": status,
                "message": text[:8000],
                "timestamp": datetime.utcnow(),
                "shared_contact_id": str(row.get("id") or ""),
                "shared_recipient_masked": dest_display,
            }
            if extra:
                log_payload.update(extra)
            await db.notification_logs.insert_one(log_payload)

        if channel == "email":
            to_em = str(row.get("email") or "").strip()
            if not to_em:
                results.append({"contact_id": rid, "ok": False, "error": "missing_email"})
                await _log_line(ch="email", status="failed", ok=False, err="missing_email")
                continue
            subj = f"{sender_name} shared a message via AQI Nepal Early Warning"
            recipient_label = str(row.get("display_name") or "").strip() or None
            html_body, plain_body = _render_shared_alert_email_html(
                sender_name=sender_name,
                message=msg,
                recipient_display_name=recipient_label,
            )
            r = await send_email(to_em, subj, html_body, plain_text=plain_body)
            ok = bool(r.get("success"))
            results.append(
                {
                    "contact_id": rid,
                    "channel": "email",
                    "ok": ok,
                    "error": None if ok else (r.get("error") or "send_failed"),
                }
            )
            await _log_line(
                ch="email",
                status="sent" if ok else "failed",
                ok=ok,
                err=None if ok else str(r.get("error") or ""),
            )
            continue

        phone = str(row.get("phone_e164") or "").strip()
        if not phone:
            results.append({"contact_id": rid, "ok": False, "error": "missing_phone"})
            await _log_line(ch=channel, status="failed", ok=False, err="missing_phone")
            continue
        try:
            phone = _normalize_shared_phone_e164(phone)
        except HTTPException:
            results.append({"contact_id": rid, "ok": False, "error": "invalid_phone"})
            await _log_line(ch=channel, status="failed", ok=False, err="invalid_phone")
            continue

        if channel == "sms":
            r = await send_sms(phone, text)
        else:
            r = await send_whatsapp(phone, text)
        ok = bool(r.get("success"))
        results.append(
            {
                "contact_id": rid,
                "channel": channel,
                "ok": ok,
                "error": None if ok else (r.get("error") or "send_failed"),
            }
        )
        await _log_line(
            ch=channel,
            status="sent" if ok else "failed",
            ok=ok,
            err=None if ok else str(r.get("error") or ""),
            extra={"twilio_sid": r.get("sid")} if r.get("sid") else None,
        )

    ok_n = sum(1 for x in results if x.get("ok"))
    await db.shared_alert_dispatch_log.insert_one(
        {
            "initiator_contact_id": cid,
            "timestamp": datetime.utcnow(),
            "recipient_count": n_req,
            "ok_count": ok_n,
            "message_preview": msg[:500],
        }
    )
    return {"success": True, "results": results, "daily_cap": daily_cap, "sent_today_before": sent_already}


@router.patch("/api/auth/shared-contacts/{contact_row_id}")
async def registrant_update_shared_contact(
    contact_row_id: str,
    body: SharedAlertContactUpdate,
    authorization: str | None = Header(None),
):
    payload = body.model_dump(exclude_unset=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")
    raw = _authorization_bearer_raw(authorization)
    cid = _contact_id_from_dashboard_bearer_token(raw)
    if not cid:
        raise HTTPException(status_code=401, detail="Sign in required.")
    if not contact_row_id.strip():
        raise HTTPException(status_code=400, detail="Missing contact id")
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(cid)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid session identity") from exc
    doc = await db.contacts.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Contact not found")
    if str(doc.get("approval_status") or "").strip().lower() == "revoked":
        raise HTTPException(status_code=403, detail="This registration has been revoked")
    vs = str(doc.get("verification_status") or "").strip().lower()
    if vs != "verified":
        raise HTTPException(status_code=403, detail="Verify your registration before managing contacts")

    cur = doc.get("shared_alert_contacts")
    lst: list[dict[str, Any]] = [x for x in cur if isinstance(x, dict)] if isinstance(cur, list) else []
    found: dict[str, Any] | None = None
    idx = -1
    for i, row in enumerate(lst):
        if str(row.get("id") or "").strip() == contact_row_id.strip():
            found = row
            idx = i
            break
    if found is None or idx < 0:
        raise HTTPException(status_code=404, detail="Contact not found")

    merged = _merge_shared_contact_updates(found, body)
    phone_norm: str | None = None
    email_norm: str | None = None
    if merged.channel in ("sms", "whatsapp"):
        phone_norm = _normalize_shared_phone_e164(merged.phone_e164 or "")
    if merged.channel == "email":
        email_norm = str(merged.email).strip().lower() if merged.email else None
        if not email_norm:
            raise HTTPException(status_code=400, detail="email is required for email channel")

    now = datetime.utcnow()
    updated_entry: dict[str, Any] = {
        **found,
        "display_name": merged.display_name.strip(),
        "channel": merged.channel,
        "phone_e164": phone_norm,
        "email": email_norm,
        "updated_at": now,
    }
    lst[idx] = updated_entry
    await db.contacts.update_one(
        {"_id": oid},
        {"$set": {"shared_alert_contacts": lst, "updated_at": now}},
    )
    return {"success": True, "contact": updated_entry}


@router.delete("/api/auth/shared-contacts/{contact_row_id}")
async def registrant_delete_shared_contact(
    contact_row_id: str,
    authorization: str | None = Header(None),
):
    raw = _authorization_bearer_raw(authorization)
    cid = _contact_id_from_dashboard_bearer_token(raw)
    if not cid:
        raise HTTPException(status_code=401, detail="Sign in required.")
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(cid)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid session identity") from exc
    doc = await db.contacts.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Contact not found")
    cur = doc.get("shared_alert_contacts")
    lst: list[dict[str, Any]] = [x for x in cur if isinstance(x, dict)] if isinstance(cur, list) else []
    nid = contact_row_id.strip()
    new_lst = [x for x in lst if str(x.get("id") or "").strip() != nid]
    if len(new_lst) == len(lst):
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.contacts.update_one(
        {"_id": oid},
        {"$set": {"shared_alert_contacts": new_lst, "updated_at": datetime.utcnow()}},
    )
    return {"success": True, "deleted_id": nid}


@router.get("/api/auth/notification-inbox")
async def registrant_notification_inbox(
    authorization: str | None = Header(None),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0, le=10_000),
):
    """
    Recent outbound attempts to this contact (SMS / email / WhatsApp) from ``notification_logs``.
    Helps when a device did not receive SMS or email — the same sends are listed here.
    """
    raw = _authorization_bearer_raw(authorization)
    cid = _contact_id_from_dashboard_bearer_token(raw)
    if not cid:
        raise HTTPException(
            status_code=401,
            detail="Sign in required — use Sign in below, then retry.",
        )
    db = db_state.require_mongo_db()
    try:
        ObjectId(cid)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid session identity") from exc

    total = await db.notification_logs.count_documents({"recipient_id": cid})
    cur = (
        db.notification_logs.find({"recipient_id": cid})
        .sort("timestamp", -1)
        .skip(skip)
        .limit(limit)
    )
    rows = await cur.to_list(length=limit)
    entries: list[dict[str, Any]] = []
    for r in rows:
        msg = r.get("message")
        err = r.get("error")
        entries.append(
            {
                "timestamp": _log_ts_iso(r.get("timestamp")),
                "channel": r.get("channel"),
                "status": r.get("status"),
                "city": r.get("city"),
                "alert_level": r.get("alert_level"),
                "hazard_type": r.get("hazard_type"),
                "message": (
                    (str(msg)[:8000] + ("…" if len(str(msg)) > 8000 else "")) if msg is not None else None
                ),
                "message_preview": (str(msg)[:600] + ("…" if len(str(msg)) > 600 else ""))
                if msg is not None
                else None,
                "error": (str(err)[:220] + ("…" if len(str(err)) > 220 else ""))
                if err
                else None,
            }
        )
    return {
        "count": len(entries),
        "total": int(total),
        "skip": skip,
        "limit": limit,
        "entries": entries,
    }


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
    if not facility_auth.effective_facility_id(doc):
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
    fid = facility_auth.effective_facility_id(row) or ""
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
        description="If false, exclude only archived contacts (active=false); rows without `active` still count as active.",
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
        query["$nor"] = [{"active": False}]
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
    # Same as admin "Active (not archived)": legacy docs may omit `active` (treat as active).
    query: dict[str, Any] = {"$nor": [{"active": False}]}
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
            return f"Heat Alert — {level_label} · {city}"
        if haz == "respiratory_surge":
            return f"Respiratory Surge — {level_label} · {city}"
        return f"Air Quality Alert — {level_label} · {city}"

    results: dict[str, dict[str, int]] = {
        "sms": {"sent": 0, "failed": 0},
        "whatsapp": {"sent": 0, "failed": 0},
        "email": {"sent": 0, "failed": 0},
    }
    email_html = _render_alert_email_html(
        city=city,
        hazard_type=haz,
        level_label=level_label,
        headline=str(head),
        plain_message=message,
    )

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
                    email_html,
                    plain_text=_strip_emoji(message),
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
                    "message": (str(message)[:8000] + ("…" if len(str(message)) > 8000 else "")),
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
    dashboard = _notification_dashboard_url()

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
    await onchain_hooks.anchor_air_alert(
        db,
        city=alert.city,
        alert_level=alert.aqi_level.value,
        pm25=float(alert.aqi_value),
        risk_score=onchain_hooks.risk_score_from_alert_level(alert.aqi_level.value),
        source="api_alerts_broadcast",
        facility_id=None,
    )
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
    dashboard = _notification_dashboard_url()

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
    await onchain_hooks.anchor_air_alert_from_payload(
        db,
        city=city,
        alert_level=level.value,
        aqi_value=aqi_value,
        aq_payload=aq_payload,
        source="api_alerts_evaluate_air",
    )
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
    dashboard = _notification_dashboard_url()
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

    await onchain_hooks.anchor_heat_alert(
        db,
        city=city,
        heat_level=level.value,
        temp_display=str(t_display),
        source="api_alerts_evaluate_heat",
    )

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
        default="Early Warning — SendGrid connectivity test",
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
    Send one email through SendGrid (path name kept); sanity-check API key + verified sender.
    """
    if not _sendgrid_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "SendGrid not configured: set SENDGRID_API_KEY (and avoid placeholder tokens). "
                "Authenticate the from-address in SendGrid; see server logs for API errors."
            ),
        )
    result = await send_email(
        str(payload.to),
        payload.subject.strip(),
        "<p>Early Warning backend: SendGrid connectivity test succeeded.</p>",
    )
    if not result.get("success"):
        err = result.get("error") or "sendgrid_failed"
        err_s = err if isinstance(err, str) else str(err)
        raise HTTPException(status_code=502, detail=err_s[:2000])
    return {"success": True, "status": result.get("status"), "detail": "Message accepted by SendGrid API"}


