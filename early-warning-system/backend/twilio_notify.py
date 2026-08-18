"""Twilio outbound messages (SMS or WhatsApp) for early-warning alerts.

Aligned with ``notification_cursor.zip`` / ``main_notifications.py``:
- WhatsApp sandbox uses ``TWILIO_WHATSAPP_SANDBOX`` (default ``+14155238886``) as ``From``.
- Production WhatsApp uses ``TWILIO_PHONE_NUMBER`` as ``From``.
- Sandbox auto-selected when ``ENVIRONMENT`` is ``sandbox`` or ``development``, unless
  ``TWILIO_WHATSAPP_USE_SANDBOX`` overrides (``true`` / ``false``).
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

import sms_length

logger = logging.getLogger(__name__)


def _message_channel() -> str:
    c = (os.getenv("TWILIO_MESSAGE_CHANNEL") or "sms").strip().lower()
    return c if c in ("sms", "whatsapp") else "sms"


def _use_whatsapp_sandbox() -> bool:
    """Match reference app: sandbox unless production-like ENVIRONMENT."""
    explicit = (os.getenv("TWILIO_WHATSAPP_USE_SANDBOX") or "").strip().lower()
    if explicit in ("1", "true", "yes", "on"):
        return True
    if explicit in ("0", "false", "no", "off"):
        return False
    # main_notifications.py defaults ENVIRONMENT to "sandbox"
    env = (os.getenv("ENVIRONMENT") or "sandbox").strip().lower()
    return env in ("sandbox", "development")


def _whatsapp_from_e164() -> str:
    """E.164 From number for WhatsApp (Twilio sandbox vs messaging number)."""
    if _use_whatsapp_sandbox():
        return normalize_e164(
            (os.getenv("TWILIO_WHATSAPP_SANDBOX") or "+14155238886").strip()
        )
    return normalize_e164((os.getenv("TWILIO_PHONE_NUMBER") or "").strip())


def whatsapp_sandbox_info() -> dict[str, Any]:
    """Static setup hints (same spirit as ``main_notifications.py`` sandbox-info route)."""
    return {
        "sandbox_number": normalize_e164(
            (os.getenv("TWILIO_WHATSAPP_SANDBOX") or "+14155238886").strip()
        ),
        "use_sandbox_for_whatsapp": _use_whatsapp_sandbox(),
        "setup_instructions": {
            "step_1": "Save the Twilio WhatsApp sandbox number in your contacts",
            "step_2": "Send WhatsApp: join <your-sandbox-keyword> (from Twilio Console)",
            "step_3": "After confirmation, this API can message your WhatsApp number",
        },
        "note": "Production WhatsApp uses an approved sender; set ENVIRONMENT=production "
        "and TWILIO_WHATSAPP_USE_SANDBOX=false",
    }


def _twilio_credentials_placeholder(blob: str) -> bool:
    s = blob.lower()
    return "your_" in s or "paste_" in s


def twilio_auth_mode() -> str:
    """
    ``account_token`` uses ``TWILIO_ACCOUNT_SID`` + ``TWILIO_AUTH_TOKEN`` (default).
    ``api_key`` uses ``TWILIO_API_KEY_SID`` (typically starts with SK) + ``TWILIO_API_KEY_SECRET``
    + ``TWILIO_ACCOUNT_SID`` (required as the account scope). Preferred when API keys exist.
    """
    sk = (os.getenv("TWILIO_API_KEY_SID") or "").strip()
    sec = (os.getenv("TWILIO_API_KEY_SECRET") or "").strip()
    if sk and sec:
        return "api_key"
    return "account_token"


def twilio_configured() -> bool:
    acct = (os.getenv("TWILIO_ACCOUNT_SID") or "").strip()
    from_id = (os.getenv("TWILIO_PHONE_NUMBER") or "").strip()
    if not acct or not from_id:
        return False

    mode = twilio_auth_mode()
    if mode == "api_key":
        sk = (os.getenv("TWILIO_API_KEY_SID") or "").strip()
        sec = (os.getenv("TWILIO_API_KEY_SECRET") or "").strip()
        blob = f"{acct} {sk} {sec}"
        if _twilio_credentials_placeholder(blob):
            return False
        return bool(sk and len(sec) >= 16)
    token = (os.getenv("TWILIO_AUTH_TOKEN") or "").strip()
    if not token:
        return False
    blob = f"{acct} {token}"
    if _twilio_credentials_placeholder(blob):
        return False
    return True


def _twilio_rest_client():
    """Build ``twilio.rest.Client`` from env (API key pair if set, else auth token)."""
    from twilio.rest import Client  # noqa: WPS433

    acct = (os.getenv("TWILIO_ACCOUNT_SID") or "").strip()
    if twilio_auth_mode() == "api_key":
        sk = (os.getenv("TWILIO_API_KEY_SID") or "").strip()
        sec = (os.getenv("TWILIO_API_KEY_SECRET") or "").strip()
        return Client(username=sk, password=sec, account_sid=acct)
    token = (os.getenv("TWILIO_AUTH_TOKEN") or "").strip()
    return Client(username=acct, password=token)


def normalize_e164(raw: str) -> str:
    """Trim and ensure a leading + for typical Twilio E.164 usage."""
    s = raw.strip().replace(" ", "")
    if s.lower().startswith("whatsapp:"):
        s = s.split(":", 1)[1].strip()
    if s.startswith("+"):
        return s
    digits = "".join(c for c in s if c.isdigit())
    if len(digits) >= 8:
        return "+" + digits
    return s


def _whatsapp_channel_addresses(from_e164: str, to_e164: str) -> tuple[str, str]:
    return (
        f"whatsapp:{normalize_e164(from_e164)}",
        f"whatsapp:{normalize_e164(to_e164)}",
    )


def send_twilio_message_sync(
    to: str, body: str, *, channel: str | None = None
) -> dict[str, Any]:
    """
    Send one SMS or WhatsApp message via Twilio (blocking).
    ``channel``: optional ``\"sms\"`` or ``\"whatsapp\"`` (overrides ``TWILIO_MESSAGE_CHANNEL``)
    so broadcast code can mix channels in one process.
    """
    if not twilio_configured():
        return {"ok": False, "error": "twilio_not_configured"}

    ch = (channel or _message_channel()).strip().lower()
    if ch not in ("sms", "whatsapp"):
        ch = "sms"
    channel = ch
    if channel == "sms":
        text = sms_length.fit_to_single_sms(body or "")
        if not text:
            return {"ok": False, "error": "text_cannot_be_empty", "channel": channel}
    else:
        text = body if len(body) <= 1600 else body[:1597] + "..."
    from_raw = (os.getenv("TWILIO_PHONE_NUMBER") or "").strip()

    try:
        from twilio.base.exceptions import TwilioRestException

        client = _twilio_rest_client()
        if channel == "whatsapp":
            from_e164 = _whatsapp_from_e164()
            if not from_e164 or len(from_e164) < 8:
                return {
                    "ok": False,
                    "error": "whatsapp_from_not_configured",
                    "channel": channel,
                }
            from_id, to_id = _whatsapp_channel_addresses(
                from_e164, normalize_e164(to)
            )
            msg = client.messages.create(body=text, from_=from_id, to=to_id)
        else:
            msg = client.messages.create(
                body=text, from_=from_raw, to=normalize_e164(to)
            )
        return {
            "ok": True,
            "sid": msg.sid,
            "status": getattr(msg, "status", None),
            "channel": channel,
            "whatsapp_sandbox": bool(channel == "whatsapp" and _use_whatsapp_sandbox()),
        }
    except TwilioRestException as exc:
        logger.warning("Twilio API error: %s", exc)
        return {"ok": False, "error": str(exc), "channel": channel}
    except Exception as exc:  # noqa: BLE001
        logger.warning("Twilio send failed: %s", exc)
        return {"ok": False, "error": str(exc), "channel": channel}


async def send_twilio_message_async(
    to: str, body: str, *, channel: str | None = None
) -> dict[str, Any]:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, lambda: send_twilio_message_sync(to, body, channel=channel)
    )
