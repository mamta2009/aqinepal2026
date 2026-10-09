"""Sparrow SMS (Nepal) outbound messages.

Docs:
- https://docs.sparrowsms.com/sms/documentation/
- https://docs.sparrowsms.com/sms/outgoing_sendsms/
- https://docs.sparrowsms.com/sms/outgoing_credits/

API is server-side only. Never expose ``SPARROW_SMS_TOKEN`` to the frontend.
``to`` must be Nepal 10-digit mobiles (e.g. 98xxxxxxxx). Stored E.164 values
such as ``+97798xxxxxxxx`` are converted before send.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import sms_length

logger = logging.getLogger(__name__)

DEFAULT_API_BASE = "https://api.sparrowsms.com/v2"
NEPAL_COUNTRY_CODE = "977"

_SPARROW_ERROR_CODES = {
    1000: "A required field is missing",
    1001: "Invalid IP Address",
    1002: "Invalid Token",
    1003: "Account Inactive",
    1004: "Account Inactive",
    1005: "Account has been expired",
    1006: "Account has been expired",
    1007: "Invalid Receiver",
    1008: "Invalid Sender",
    1010: "Text cannot be empty",
    1011: "No valid receiver",
    1012: "No Credits Available",
    1013: "Insufficient Credits",
}


def _credentials_placeholder(blob: str) -> bool:
    s = blob.lower()
    return "your_" in s or "paste_" in s or "<token" in s or "<identity" in s


def sms_provider_name() -> str:
    """Which SMS backend to use: ``sparrow``, ``twilio``, or ``auto``.

    Reads ``SMS_PROVIDER``, then ``DEFAULT_SMS_PROVIDER``. Keep both Sparrow
    and Twilio credentials in ``.env``; flip this value to switch.
    Nepal: ``sparrow``. International later: ``twilio``.
    ``auto`` uses Sparrow when it is configured, otherwise Twilio.
    WhatsApp is always Twilio regardless of this setting.
    """
    raw = (
        os.getenv("SMS_PROVIDER")
        or os.getenv("DEFAULT_SMS_PROVIDER")
        or "auto"
    ).strip().lower()
    if raw in ("sparrow", "sparrowsms", "sparrow_sms"):
        return "sparrow"
    if raw == "twilio":
        return "twilio"
    return "auto"


def sparrow_api_base() -> str:
    return (
        os.getenv("SPARROW_SMS_API_BASE") or DEFAULT_API_BASE
    ).strip().rstrip("/")


def sparrow_token() -> str:
    return (os.getenv("SPARROW_SMS_TOKEN") or "").strip()


def sparrow_from() -> str:
    return (
        os.getenv("SPARROW_SMS_FROM") or os.getenv("SPARROW_SMS_IDENTITY") or ""
    ).strip()


def sparrow_configured() -> bool:
    token = sparrow_token()
    from_id = sparrow_from()
    if not token or not from_id:
        return False
    return not _credentials_placeholder(f"{token} {from_id}")


def should_use_sparrow() -> bool:
    """Whether outbound SMS should go through Sparrow (vs Twilio).

    Explicit ``SMS_PROVIDER=sparrow`` or ``twilio`` is honored even if the
    other provider is also configured. ``auto`` prefers Sparrow when ready.
    """
    name = sms_provider_name()
    if name == "twilio":
        return False
    if name == "sparrow":
        return True
    return sparrow_configured()


def active_sms_provider() -> str:
    if should_use_sparrow() and sparrow_configured():
        return "sparrow"
    return "none" if should_use_sparrow() else "twilio"


def nepal_msisdn_10(raw: str) -> str | None:
    """Convert E.164 / local Nepal numbers to Sparrow's 10-digit ``to`` format."""
    digits = "".join(c for c in (raw or "") if c.isdigit())
    cc = (os.getenv("SPARROW_SMS_COUNTRY_CODE") or NEPAL_COUNTRY_CODE).strip()
    cc_digits = "".join(c for c in cc if c.isdigit()) or NEPAL_COUNTRY_CODE
    if digits.startswith(cc_digits) and len(digits) == len(cc_digits) + 10:
        digits = digits[len(cc_digits) :]
    elif digits.startswith("00" + cc_digits) and len(digits) == 2 + len(cc_digits) + 10:
        digits = digits[2 + len(cc_digits) :]
    if digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) == 10:
        return digits
    return None


def _response_code(payload: dict[str, Any] | None) -> int:
    if not payload:
        return 0
    try:
        return int(payload.get("response_code") or 0)
    except (TypeError, ValueError):
        return 0


def _map_sparrow_error(payload: dict[str, Any] | None, status_code: int) -> str:
    if not payload:
        return f"sparrow_http_{status_code}"
    code = payload.get("response_code")
    try:
        code_int = int(code) if code is not None else None
    except (TypeError, ValueError):
        code_int = None
    if code_int and code_int in _SPARROW_ERROR_CODES:
        text = payload.get("response") or _SPARROW_ERROR_CODES[code_int]
        return f"sparrow_{code_int}:{text}"
    text = payload.get("response") or payload.get("error")
    if text:
        return str(text)[:400]
    return f"sparrow_http_{status_code}"


async def send_sms_async(to: str, body: str) -> dict[str, Any]:
    """Send one SMS via Sparrow (POST form fields, as in their Python example)."""
    if not sparrow_configured():
        return {"ok": False, "error": "sparrow_not_configured", "provider": "sparrow"}

    to_10 = nepal_msisdn_10(to)
    if not to_10:
        return {
            "ok": False,
            "error": "invalid_receiver_nepal_10_digit",
            "provider": "sparrow",
        }

    text = sms_length.fit_to_single_sms(body or "")
    if not text:
        return {"ok": False, "error": "text_cannot_be_empty", "provider": "sparrow"}

    try:
        import httpx
    except ImportError:
        return {"ok": False, "error": "httpx_not_installed", "provider": "sparrow"}

    url = f"{sparrow_api_base()}/sms/"
    payload = {
        "token": sparrow_token(),
        "from": sparrow_from(),
        "to": to_10,
        "text": text,
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, data=payload)
    except httpx.RequestError as exc:
        logger.warning("Sparrow SMS request failed: %s", exc)
        return {"ok": False, "error": str(exc)[:400], "provider": "sparrow"}

    parsed: dict[str, Any] | None
    try:
        parsed = response.json()
        if not isinstance(parsed, dict):
            parsed = None
    except ValueError:
        parsed = None

    if response.status_code == 200 and parsed and _response_code(parsed) == 200:
        count = parsed.get("count")
        return {
            "ok": True,
            "provider": "sparrow",
            "count": count,
            "sid": f"sparrow:{to_10}:{count}",
            "status": parsed.get("response") or "queued",
            "to": to_10,
        }

    err = _map_sparrow_error(parsed, response.status_code)
    logger.warning("Sparrow SMS send failed: %s", err)
    return {"ok": False, "error": err, "provider": "sparrow"}


async def credits_async() -> dict[str, Any]:
    """GET /credit/ — available and consumed credits."""
    if not sparrow_token() or _credentials_placeholder(sparrow_token()):
        return {"ok": False, "error": "sparrow_not_configured"}

    try:
        import httpx
    except ImportError:
        return {"ok": False, "error": "httpx_not_installed"}

    url = f"{sparrow_api_base()}/credit/"
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, params={"token": sparrow_token()})
    except httpx.RequestError as exc:
        logger.warning("Sparrow credits request failed: %s", exc)
        return {"ok": False, "error": str(exc)[:400]}

    try:
        parsed = response.json()
        if not isinstance(parsed, dict):
            parsed = None
    except ValueError:
        parsed = None

    if response.status_code == 200 and parsed and _response_code(parsed) == 200:
        return {
            "ok": True,
            "credits_available": parsed.get("credits_available"),
            "credits_consumed": parsed.get("credits_consumed"),
        }

    return {"ok": False, "error": _map_sparrow_error(parsed, response.status_code)}
