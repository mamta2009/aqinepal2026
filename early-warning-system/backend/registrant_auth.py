"""Bcrypt-backed passwords + registrant dashboard session JWT."""

from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from bson import ObjectId
from fastapi import Header, HTTPException

import db_state
import facility_auth

logger = logging.getLogger(__name__)

JWT_ALG = "HS256"
REGISTRANT_JWT_ISS = "early-warning-system"
REGISTRANT_JWT_AUD = "registrant-session"


def hash_password(password: str) -> str:
    """Bcrypt-hash a password for storage on ``contacts.password_hash``."""
    pw = password.encode("utf-8")[:71]
    return bcrypt.hashpw(pw, bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(password: str, hashed: str | None) -> bool:
    if not hashed or not password:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:71], hashed.encode("ascii"))
    except Exception:  # noqa: BLE001
        return False


def _registrant_token_ttl_hours() -> int:
    try:
        return max(1, min(24 * 30, int((os.getenv("REGISTRANT_SESSION_TOKEN_HOURS") or "336").strip())))
    except ValueError:
        return 336


def registrant_jwt_signing_secret() -> str:
    explicit = (os.getenv("REGISTRANT_JWT_SECRET") or "").strip()
    if explicit:
        return explicit
    fac = (os.getenv("FACILITY_JWT_SECRET") or "").strip()
    if fac:
        return hashlib.sha256(b"v1|registrant-derived|" + fac.encode("utf-8")).hexdigest()
    notif_key = (os.getenv("NOTIFICATION_API_KEY") or "").strip()
    if not notif_key:
        raise HTTPException(
            status_code=503,
            detail="Set REGISTRANT_JWT_SECRET (or FACILITY_JWT_SECRET / NOTIFICATION_API_KEY for dev) "
            "before issuing registrant sessions.",
        )
    digest = hashlib.sha256(b"v1|MAMTA|registrant-session|" + notif_key.encode("utf-8")).hexdigest()
    logger.warning("REGISTRANT_JWT_SECRET not set — deriving from NOTIFICATION_API_KEY (dev-style only).")
    return digest


def registrant_can_facility_actions(doc: dict[str, Any]) -> bool:
    vs = str(doc.get("verification_status") or "").strip().lower()
    if vs != "verified":
        return False
    apr_raw = doc.get("approval_status")
    if apr_raw is not None:
        a = str(apr_raw).strip().lower()
        if a in ("revoked", "pending"):
            return False
        if a != "approved":
            return False
    return bool(facility_auth.effective_facility_id(doc))


def compute_registrant_scopes(doc: dict[str, Any]) -> list[str]:
    vs = str(doc.get("verification_status") or "").strip().lower()
    if vs != "verified":
        return []
    scopes = ["dashboard"]
    if registrant_can_facility_actions(doc):
        scopes.append("facility_actions")
    return scopes


def mint_registrant_session_token(contact: dict[str, Any]) -> tuple[str, int]:
    hours = _registrant_token_ttl_hours()
    now = datetime.now(timezone.utc)
    cid = str(contact["_id"]) if isinstance(contact.get("_id"), ObjectId) else str(contact["_id"])
    payload: dict[str, Any] = {
        "iss": REGISTRANT_JWT_ISS,
        "aud": REGISTRANT_JWT_AUD,
        "sub": cid,
        "cid": cid,
        "typ": "registrant-session",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=hours)).timestamp()),
    }
    secret = registrant_jwt_signing_secret()
    token = jwt.encode(payload, secret, algorithm=JWT_ALG)
    assert isinstance(token, str)
    return token, hours * 3600


def decode_registrant_token_optional(token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    secret = registrant_jwt_signing_secret()
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=[JWT_ALG],
            audience=REGISTRANT_JWT_AUD,
            issuer=REGISTRANT_JWT_ISS,
        )
    except jwt.PyJWTError:
        return None


@dataclass(frozen=True)
class RegistrantSession:
    contact_id: str
    email: str
    name: str
    scopes: list[str]


async def resolve_registrant_session(*, bearer_token: str | None) -> RegistrantSession:
    if not bearer_token:
        raise HTTPException(
            status_code=401,
            detail="Sign in required: Authorization: Bearer <session token> from POST /api/auth/login",
        )
    claims = decode_registrant_token_optional(bearer_token)
    if claims is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")

    cid = str(claims.get("cid") or claims.get("sub") or "").strip()
    try:
        oid = ObjectId(cid)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid session identity") from exc

    db = db_state.require_mongo_db()
    doc = await db.contacts.find_one({"_id": oid})
    if doc is None:
        raise HTTPException(status_code=401, detail="Contact no longer registered")
    if str(doc.get("approval_status") or "").strip().lower() == "revoked":
        raise HTTPException(status_code=403, detail="This registration has been revoked")
    vs = str(doc.get("verification_status") or "").strip().lower()
    if vs != "verified":
        raise HTTPException(status_code=403, detail="Complete email/phone verification before using the dashboard")

    scopes = compute_registrant_scopes(doc)
    if "dashboard" not in scopes:
        raise HTTPException(status_code=403, detail="Dashboard access not available for this account state")

    return RegistrantSession(
        contact_id=cid,
        email=str(doc.get("email") or ""),
        name=str(doc.get("name") or ""),
        scopes=scopes,
    )


async def load_registrant_session(
    authorization: str | None = Header(None),
) -> RegistrantSession:
    token: str | None = None
    if authorization and authorization.strip().lower().startswith("bearer "):
        token = authorization.strip()[7:].strip()
    return await resolve_registrant_session(bearer_token=token)
