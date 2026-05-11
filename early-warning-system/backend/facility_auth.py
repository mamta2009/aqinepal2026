"""JWT auth for facility-operational endpoints (Mongo-backed verified + approved registrants only)."""

from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from bson import ObjectId
from fastapi import Header, HTTPException

import db_state

logger = logging.getLogger(__name__)

JWT_ALG = "HS256"
JWT_ISS = "early-warning-system-facility"
JWT_AUD = "facility-actions"


def auto_approve_verified_contacts() -> bool:
    """When false, new verifies stay pending until admin PATCH."""
    raw = (os.getenv("AUTO_APPROVE_VERIFIED_CONTACTS") or "true").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _facility_token_ttl_hours() -> int:
    try:
        return int((os.getenv("FACILITY_ACCESS_TOKEN_HOURS") or "168").strip())
    except ValueError:
        return 168


def _facility_login_ttl_minutes() -> int:
    try:
        return int((os.getenv("FACILITY_LOGIN_CODE_TTL_MINUTES") or "15").strip())
    except ValueError:
        return 15


def facility_login_code_ttl_minutes() -> int:
    """One-time dashboard login OTP lifetime (facility token exchange)."""
    return max(5, min(120, _facility_login_ttl_minutes()))


def facility_jwt_signing_secret() -> str:
    """
    Prefer explicit secret. If omitted, derives a stable fallback from ``NOTIFICATION_API_KEY``
    when that is configured (deterministic HS256 signing for small deployments).

    Rotate ``FACILITY_JWT_SECRET`` in production independently of admin API keys when possible.
    """
    explicit = (os.getenv("FACILITY_JWT_SECRET") or "").strip()
    if explicit:
        return explicit
    notif_key = (os.getenv("NOTIFICATION_API_KEY") or "").strip()
    if not notif_key:
        raise HTTPException(
            status_code=503,
            detail="Set FACILITY_JWT_SECRET (or NOTIFICATION_API_KEY for dev fallback signing) "
            "before issuing facility access tokens.",
        )
    digest = hashlib.sha256(b"v1|MAMTA|facility-actions|" + notif_key.encode("utf-8")).hexdigest()
    logger.warning(
        "FACILITY_JWT_SECRET not set — deriving HS256 key from NOTIFICATION_API_KEY (dev-style only)."
    )
    return digest


@dataclass(frozen=True)
class FacilityCaller:
    contact_id: str
    facility_id: str
    facility_name: str | None
    city: str | None
    email: str


def effective_facility_id(contact: dict[str, Any]) -> str | None:
    """
    Stable facility scope for action-log / JWT.

    Prefer explicit ``facility_id`` when set; otherwise derive ``site-{ObjectId}`` when the
    enrollee named at least one facility (list or legacy string) so reporting works without
    operators pasting IDs.
    """
    fid = str(contact.get("facility_id") or "").strip()
    if fid:
        return fid
    names = contact.get("facility_names")
    has_names = isinstance(names, list) and any(str(x).strip() for x in names)
    legacy = contact.get("facility_name")
    has_legacy = isinstance(legacy, str) and legacy.strip()
    if not (has_names or has_legacy):
        return None
    oid = contact.get("_id")
    if isinstance(oid, ObjectId):
        return f"site-{str(oid)}"
    if oid is not None:
        return f"site-{str(oid)}"
    return None


def facility_display_name(contact: dict[str, Any]) -> str | None:
    """Prefer ``facility_names`` list; fallback to legacy ``facility_name`` string."""
    raw = contact.get("facility_names")
    if isinstance(raw, list):
        parts = [str(x).strip() for x in raw if str(x).strip()]
        if parts:
            return " · ".join(parts)
    fn = contact.get("facility_name")
    if isinstance(fn, str) and fn.strip():
        return fn.strip()
    return None


def mint_facility_access_token(contact: dict[str, Any]) -> tuple[str, int]:
    hours = max(1, min(24 * 60, _facility_token_ttl_hours()))
    now = datetime.now(timezone.utc)
    cid = str(contact["_id"]) if isinstance(contact.get("_id"), ObjectId) else str(contact["_id"])
    fid = effective_facility_id(contact) or ""
    payload: dict[str, Any] = {
        "iss": JWT_ISS,
        "aud": JWT_AUD,
        "sub": cid,
        "cid": cid,
        "fid": fid,
        "city": contact.get("city"),
        "typ": "facility-actions",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=hours)).timestamp()),
    }
    secret = facility_jwt_signing_secret()
    token = jwt.encode(payload, secret, algorithm=JWT_ALG)
    # PyJWT>=2 returns str
    assert isinstance(token, str)
    return token, hours * 3600


def decode_facility_access_token_optional(token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    secret = facility_jwt_signing_secret()
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=[JWT_ALG],
            audience=JWT_AUD,
            issuer=JWT_ISS,
        )
    except jwt.PyJWTError:
        return None


async def resolve_facility_caller(
    *,
    bearer_token: str | None,
) -> FacilityCaller:
    if not bearer_token:
        raise HTTPException(
            status_code=401,
            detail="Facility actions require Authorization: Bearer <facility access token> "
            "(exchange code via POST /api/auth/facility-token).",
        )
    claims = decode_facility_access_token_optional(bearer_token)
    from_registrant_session = False
    if claims is None:
        import registrant_auth as _reg

        rclaims = _reg.decode_registrant_token_optional(bearer_token)
        if rclaims:
            cid_try = str(rclaims.get("cid") or rclaims.get("sub") or "").strip()
            if not cid_try:
                raise HTTPException(status_code=401, detail="Invalid registrant session token")
            try:
                oid_pre = ObjectId(cid_try)
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(status_code=401, detail="Invalid token identity") from exc
            db_pre = db_state.require_mongo_db()
            doc_pre = await db_pre.contacts.find_one({"_id": oid_pre})
            if doc_pre is None:
                raise HTTPException(status_code=401, detail="Contact no longer registered")
            if "facility_actions" not in _reg.compute_registrant_scopes(doc_pre):
                raise HTTPException(
                    status_code=403,
                    detail="Facility reporting requires a verified, approved account with a facility / site on file — finish registration or wait for partner approval.",
                )
            claims = {"cid": cid_try, "fid": ""}
            from_registrant_session = True
        else:
            raise HTTPException(status_code=401, detail="Invalid or expired facility access token")

    cid = str(claims.get("cid") or claims.get("sub") or "").strip()
    fid_claim = "" if from_registrant_session else str(claims.get("fid") or "").strip()
    try:
        oid = ObjectId(cid)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid token identity") from exc

    db = db_state.require_mongo_db()
    doc = await db.contacts.find_one({"_id": oid})
    if doc is None:
        raise HTTPException(status_code=401, detail="Contact no longer registered")
    vs = str(doc.get("verification_status") or "").strip().lower()
    apr_raw = doc.get("approval_status")
    if vs != "verified":
        raise HTTPException(status_code=403, detail="Contact is not verified")

    # Legacy documents may omit approval_status (treated like approved once verified).
    if apr_raw is not None:
        a = str(apr_raw).strip().lower()
        if a == "revoked":
            raise HTTPException(status_code=403, detail="Facility reporting access revoked")
        if a == "pending":
            raise HTTPException(status_code=403, detail="Registration pending partner approval — cannot report yet")
        if a != "approved":
            raise HTTPException(status_code=403, detail="Contact not approved for facility reporting")

    facility_id_live = effective_facility_id(doc)
    if not facility_id_live:
        raise HTTPException(
            status_code=403,
            detail="Add at least one facility / site name during registration (or ask an admin to set facility_id).",
        )
    if fid_claim and fid_claim != facility_id_live:
        raise HTTPException(status_code=403, detail="Facility scope mismatch")

    facility_name = facility_display_name(doc)
    cit = doc.get("city")
    email = str(doc.get("email") or "")
    return FacilityCaller(
        contact_id=cid,
        facility_id=facility_id_live,
        facility_name=facility_name,
        city=str(cit).strip() if isinstance(cit, str) else None,
        email=email,
    )


async def load_facility_caller(
    authorization: str | None = Header(None),
) -> FacilityCaller:
    token: str | None = None
    if authorization and authorization.strip().lower().startswith("bearer "):
        token = authorization.strip()[7:].strip()
    return await resolve_facility_caller(bearer_token=token)
