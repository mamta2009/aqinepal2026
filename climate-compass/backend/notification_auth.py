"""Optional API key for notification admin routes; optional Twilio webhook signature validation."""

from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime
from typing import Any

from fastapi import Header, HTTPException, Request

import db_state

OPERATOR_CONSOLE_SESSION_COLLECTION = "operator_console_sessions"

logger = None  # lazily use notifications logger to avoid import cycle


def _log() -> Any:
    global logger
    if logger is None:
        import logging

        logger = logging.getLogger(__name__)
    return logger


def notification_api_key_configured() -> bool:
    return bool((os.getenv("NOTIFICATION_API_KEY") or "").strip())


def operator_session_cookie_name() -> str:
    name = (os.getenv("ADMIN_SESSION_COOKIE_NAME") or "ew_admin_session").strip()
    return name or "ew_admin_session"


def operator_session_ttl_hours() -> float:
    try:
        return float((os.getenv("ADMIN_CONSOLE_SESSION_HOURS") or "24").strip())
    except ValueError:
        return 24.0


def cookie_secure_for_request(request: Request) -> bool:
    if (os.getenv("ADMIN_SESSION_COOKIE_SECURE") or "").strip().lower() in ("1", "true", "yes"):
        return True
    xf = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    if xf == "https":
        return True
    return request.url.scheme == "https"


def _notification_api_key_value() -> str:
    return (os.getenv("NOTIFICATION_API_KEY") or "").strip()


def _notification_bearer_token(
    authorization: str | None, x_api_key: str | None
) -> str | None:
    token: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token and x_api_key:
        token = x_api_key.strip()
    return token


def _notification_key_matches(token: str | None, key: str) -> bool:
    if not token or not key:
        return False
    return hmac.compare_digest(token.encode("utf-8"), key.encode("utf-8"))


async def _operator_session_cookie_valid(request: Request) -> bool:
    name = operator_session_cookie_name()
    raw = (request.cookies.get(name) or "").strip()
    if len(raw) < 16:
        return False
    th = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    db = db_state.mongo_db
    if db is None:
        return False
    try:
        coll = db[OPERATOR_CONSOLE_SESSION_COLLECTION]
        doc = await coll.find_one(
            {"token_sha256": th, "expires_at": {"$gt": datetime.utcnow()}}
        )
        return doc is not None
    except Exception:  # noqa: BLE001
        return False


def registration_directory_secret_configured() -> bool:
    return bool((os.getenv("REGISTRATION_DIRECTORY_SECRET") or "").strip())


async def require_registration_directory_secret(request: Request) -> None:
    """
    Protects ``GET /api/contacts/directory`` and the HTML directory viewer.
    Send the shared passphrase in either:
    - ``X-Registration-Directory-Secret``, or
    - ``Authorization: Bearer <passphrase>`` (same value as ``REGISTRATION_DIRECTORY_SECRET``).
    Reads raw headers from the ASGI request so binding is not sensitive to FastAPI's
    Header() name mapping. When env is unset, returns 404 to hide the feature.
    """
    expected = (os.getenv("REGISTRATION_DIRECTORY_SECRET") or "").strip()
    if not expected:
        raise HTTPException(status_code=404, detail="Not found")
    got = (request.headers.get("x-registration-directory-secret") or "").strip()
    if not got:
        auth = (request.headers.get("authorization") or "").strip()
        if auth.lower().startswith("bearer "):
            got = auth[7:].strip()
    if len(got) != len(expected):
        raise HTTPException(status_code=401, detail="Invalid or missing directory passphrase")
    if not hmac.compare_digest(got.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid or missing directory passphrase")


async def require_admin_operator(
    request: Request,
    authorization: str | None = Header(None),
    x_api_key: str | None = Header(None),
) -> None:
    """
    Operator JSON routes: accept a MongoDB-backed session cookie from
    ``POST /api/admin/console-unlock-pin``, or (for automation) Bearer / ``X-API-Key``
    matching ``NOTIFICATION_API_KEY`` when that env var is set.
    """
    if await _operator_session_cookie_valid(request):
        return
    key = _notification_api_key_value()
    if not key:
        raise HTTPException(
            status_code=401,
            detail="Unlock the operator console with your PIN, or set NOTIFICATION_API_KEY for Bearer access.",
        )
    tok = _notification_bearer_token(authorization, x_api_key)
    if not _notification_key_matches(tok, key):
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing operator session or notification API key.",
        )


async def require_strict_notification_api_key(
    authorization: str | None = Header(None),
    x_api_key: str | None = Header(None),
) -> None:
    """
    Routes that always require Bearer / ``X-API-Key`` (no browser session cookie).
    ``NOTIFICATION_API_KEY`` must be set in the environment (fails closed).
    """
    key = _notification_api_key_value()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Configure NOTIFICATION_API_KEY in the server environment to enable admin endpoints.",
        )
    tok = _notification_bearer_token(authorization, x_api_key)
    if not _notification_key_matches(tok, key):
        raise HTTPException(status_code=401, detail="Invalid or missing notification API key")


async def require_notification_api_key(
    authorization: str | None = Header(None),
    x_api_key: str | None = Header(None),
) -> None:
    """When ``NOTIFICATION_API_KEY`` is set, require ``Authorization: Bearer <key>`` or ``X-API-Key``."""
    key = _notification_api_key_value()
    if not key:
        return
    tok = _notification_bearer_token(authorization, x_api_key)
    if not _notification_key_matches(tok, key):
        raise HTTPException(status_code=401, detail="Invalid or missing notification API key")


async def validate_twilio_request(request: Request, post_params: dict[str, str]) -> None:
    """
    Validate ``X-Twilio-Signature`` when ``TWILIO_WEBHOOK_VALIDATE`` is true.
    Set ``TWILIO_WEBHOOK_PUBLIC_URL`` to the exact public URL Twilio posts to if behind a proxy
    (e.g. ``https://yourhost.com/api/webhooks/sms`` for the SMS webhook).
    """
    if (os.getenv("TWILIO_WEBHOOK_VALIDATE") or "").strip().lower() not in (
        "1",
        "true",
        "yes",
    ):
        return
    auth_token = (os.getenv("TWILIO_AUTH_TOKEN") or "").strip()
    if not auth_token:
        _log().warning(
            "TWILIO_WEBHOOK_VALIDATE set but TWILIO_AUTH_TOKEN missing "
            "(RequestValidator requires the account Auth Token, not API key secret)"
        )
        return

    from twilio.request_validator import RequestValidator

    sig = request.headers.get("X-Twilio-Signature") or ""
    public_url = (os.getenv("TWILIO_WEBHOOK_PUBLIC_URL") or "").strip()
    url = public_url or str(request.url)
    validator = RequestValidator(auth_token)
    if not validator.validate(url, post_params, sig):
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")


async def twilio_webhook_form(request: Request) -> dict[str, str]:
    """Parse Twilio ``application/x-www-form-urlencoded`` body once and validate signature."""
    form = await request.form()
    params = {str(k): str(v) for k, v in form.multi_items()}
    await validate_twilio_request(request, params)
    return params
