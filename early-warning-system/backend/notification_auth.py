"""Optional API key for notification admin routes; optional Twilio webhook signature validation."""

from __future__ import annotations

import hmac
import os
from typing import Any

from fastapi import Header, HTTPException, Request

logger = None  # lazily use notifications logger to avoid import cycle


def _log() -> Any:
    global logger
    if logger is None:
        import logging

        logger = logging.getLogger(__name__)
    return logger


def notification_api_key_configured() -> bool:
    return bool((os.getenv("NOTIFICATION_API_KEY") or "").strip())


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


async def require_strict_notification_api_key(
    authorization: str | None = Header(None),
    x_api_key: str | None = Header(None),
) -> None:
    """
    Admin UI / operator routes: ``NOTIFICATION_API_KEY`` must be set in the environment
    (fails closed — unlike ``require_notification_api_key`` which no-ops when unset).
    """
    key = (os.getenv("NOTIFICATION_API_KEY") or "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Configure NOTIFICATION_API_KEY in the server environment to enable admin endpoints.",
        )
    token: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token and x_api_key:
        token = x_api_key.strip()
    if not token or not hmac.compare_digest(token.encode("utf-8"), key.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid or missing notification API key")


async def require_notification_api_key(
    authorization: str | None = Header(None),
    x_api_key: str | None = Header(None),
) -> None:
    """When ``NOTIFICATION_API_KEY`` is set, require ``Authorization: Bearer <key>`` or ``X-API-Key``."""
    key = (os.getenv("NOTIFICATION_API_KEY") or "").strip()
    if not key:
        return
    token: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token and x_api_key:
        token = x_api_key.strip()
    if not token or token != key:
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
