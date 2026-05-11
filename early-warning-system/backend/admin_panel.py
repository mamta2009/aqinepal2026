"""Operator admin APIs: system health, integrations, registrants, activity, password reset."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta
from typing import Any, Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

import db_state
import external_integrations
import registrant_auth
import guide_documents
from notification_auth import (
    cookie_secure_for_request,
    operator_session_cookie_name,
    operator_session_ttl_hours,
    require_admin_operator,
)
from notifications_api import (
    ContactRegistration,
    operator_resend_registration_verification_by_id,
    persist_contact_registration,
)
from notifications_api import _normalize_city_list, _normalize_facility_names

from onchain_logger import effective_polygon_bundle, runtime_polygon_network, set_runtime_polygon_network

import onchain_hooks

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def ensure_operator_console_session_indexes(db: Any) -> None:
    """TTL on ``expires_at`` plus lookup by ``token_sha256`` for operator console cookies."""
    coll = db["operator_console_sessions"]
    await coll.create_index([("expires_at", 1)], expireAfterSeconds=0)
    await coll.create_index("token_sha256", unique=True)


def _strip_pin_or_secret(raw: str | None) -> str:
    if raw is None:
        return ""
    s = raw.strip()
    if s.startswith("\ufeff"):
        s = s[1:].strip()
    return s.strip('"').strip("'")


def operator_console_pin_source() -> Literal["admin_console_pin", "registration_directory_secret", "default_dev"]:
    """Which env value supplies the operator UI PIN (for diagnostics only; never the PIN itself)."""
    p = _strip_pin_or_secret(os.getenv("ADMIN_CONSOLE_PIN"))
    if p:
        return "admin_console_pin"
    p2 = _strip_pin_or_secret(os.getenv("REGISTRATION_DIRECTORY_SECRET"))
    if p2:
        return "registration_directory_secret"
    return "default_dev"


def admin_console_pin_env_nonempty() -> bool:
    """True when ``ADMIN_CONSOLE_PIN`` is non-empty after trim (may still differ from effective PIN if ignored)."""
    return bool(_strip_pin_or_secret(os.getenv("ADMIN_CONSOLE_PIN")))


def _expected_console_pin() -> str:
    """
    Operator UI gate. Prefer ``ADMIN_CONSOLE_PIN``; else ``REGISTRATION_DIRECTORY_SECRET``;
    else dev default ``2026!`` (change in production).

    If ``ADMIN_CONSOLE_PIN`` is set-but-empty or whitespace-only, it is treated as unset and the
    chain falls through — set a non-empty value in the deployment environment.
    """
    p = _strip_pin_or_secret(os.getenv("ADMIN_CONSOLE_PIN"))
    if p:
        return p
    p2 = _strip_pin_or_secret(os.getenv("REGISTRATION_DIRECTORY_SECRET"))
    if p2:
        return p2
    return "2026!"


def _pin_digest(value: str) -> bytes:
    return hashlib.sha256(value.encode("utf-8")).digest()


class AdminConsoleUnlockIn(BaseModel):
    pin: str = Field(..., min_length=1, max_length=240)


@router.post("/console-unlock-pin")
async def admin_console_unlock_pin(
    request: Request, body: AdminConsoleUnlockIn, response: Response
) -> dict[str, Any]:
    """
    Validates the operator PIN and issues an HttpOnly cookie bound to a row in MongoDB
    (``operator_console_sessions``). JSON admin routes accept this session **or**
    ``Authorization: Bearer NOTIFICATION_API_KEY`` for automation.
    """
    await asyncio.sleep(0.06)
    got = _strip_pin_or_secret(body.pin)
    if not got:
        raise HTTPException(
            status_code=422,
            detail="PIN is empty after trimming — check for spaces-only input or paste errors.",
        )
    exp = _expected_console_pin()
    if not hmac.compare_digest(_pin_digest(got), _pin_digest(exp)):
        await asyncio.sleep(0.28)
        raise HTTPException(status_code=401, detail="Incorrect PIN")

    db = db_state.require_mongo_db()
    token = secrets.token_hex(32)
    token_sha256 = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = datetime.utcnow()
    ttl_h = operator_session_ttl_hours()
    sess_exp = now + timedelta(hours=ttl_h)
    await db.operator_console_sessions.insert_one(
        {
            "token_sha256": token_sha256,
            "created_at": now,
            "expires_at": sess_exp,
        }
    )

    cn = operator_session_cookie_name()
    max_age = int(ttl_h * 3600)
    response.set_cookie(
        key=cn,
        value=token,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        secure=cookie_secure_for_request(request),
        path="/",
    )
    return {"success": True}


@router.post("/console-session-logout")
async def admin_console_session_logout(request: Request, response: Response) -> dict[str, Any]:
    """Invalidate the MongoDB session row and clear the HttpOnly cookie."""
    cn = operator_session_cookie_name()
    raw = (request.cookies.get(cn) or "").strip()
    if raw and len(raw) >= 16:
        th = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        db = db_state.mongo_db
        if db is not None:
            try:
                await db.operator_console_sessions.delete_many({"token_sha256": th})
            except Exception:  # noqa: BLE001
                pass
    response.delete_cookie(key=cn, path="/")
    return {"success": True}


def _env_set(name: str) -> bool:
    return bool((os.getenv(name) or "").strip())


def _mask_e164_tail(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) < 4:
        return "••••"
    return f"••••{digits[-4:]}"


def _env_hints() -> dict[str, bool]:
    keys = [
        "MONGODB_URL",
        "DATABASE_URL",
        "MONGODB_URI",
        "NOTIFICATION_API_KEY",
        "SENDGRID_API_KEY",
        "SENDGRID_FROM_EMAIL",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_PHONE_NUMBER",
        "WAQI_TOKEN",
        "WAQI_API_TOKEN",
        "RAPIDAPI_WEATHER_API_KEY",
        "RAPIDAPI_WEATHER_HOST",
        "WEATHERAPI_COM_API_KEY",
        "OPENROUTER_API_KEY",
            "FACILITY_JWT_SECRET",
            "REGISTRANT_JWT_SECRET",
            "AUTO_APPROVE_VERIFIED_CONTACTS",
            "REGISTRATION_DIRECTORY_SECRET",
            "ADMIN_CONSOLE_PIN",
            "POLYGON_PRIVATE_KEY",
            "BLOCKCHAIN_ONCHAIN_NETWORK",
            "POLYGON_ONCHAIN_LOG",
        "DHIS2_URL",
    ]
    return {k: _env_set(k) for k in keys}


@router.get("/system-status")
async def admin_system_status(
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    mongo_block: dict[str, Any] = {"configured": False, "ping_ok": False, "detail": None}
    try:
        mongo_url = bool(db_state.mongo_env_connection_string())
        mongo_block["configured"] = mongo_url
        if mongo_url:
            db = db_state.require_mongo_db()
            await db.admin.command("ping")
            mongo_block["ping_ok"] = True
    except Exception as exc:  # noqa: BLE001
        mongo_block["detail"] = str(exc)[:800]

    from notifications_api import public_resend_email_ready  # local import avoids cycles at startup

    return {
        "service_time_utc": datetime.utcnow().isoformat() + "Z",
        "mongodb": mongo_block,
        "integrations": {
            **external_integrations.integrations_public_status(),
            "sendgrid_email_ready": public_resend_email_ready(),
            "resend_email_ready": public_resend_email_ready(),
        },
        "env_flags": _env_hints(),
    }


@router.get("/activity/summary")
async def admin_activity_summary(
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    db = db_state.require_mongo_db()
    now = datetime.utcnow()
    since = now - timedelta(hours=24)
    agg: dict[str, Any] = {
        "contacts_total": await db.contacts.count_documents({}),
        "contacts_verified": await db.contacts.count_documents({"verification_status": "verified"}),
        "contacts_pending_verify": await db.contacts.count_documents({"verification_status": "pending"}),
        "action_logs_last_24h": 0,
        "notification_logs_last_24h": 0,
    }
    try:
        agg["action_logs_last_24h"] = await db.action_logs.count_documents(
            {"timestamp": {"$gte": since}}
        )
    except Exception:  # noqa: BLE001
        pass
    try:
        agg["notification_logs_last_24h"] = await db.notification_logs.count_documents(
            {"timestamp": {"$gte": since}}
        )
    except Exception:  # noqa: BLE001
        pass
    return agg


@router.get("/activity/recent-action-logs")
async def admin_recent_action_logs(
    limit: int = Query(40, ge=1, le=200),
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    db = db_state.require_mongo_db()
    cur = db.action_logs.find({}).sort("timestamp", -1).limit(limit)
    rows = await cur.to_list(length=limit)
    out: list[dict[str, Any]] = []
    for raw in rows:
        r = dict(raw)
        rid = r.pop("_id", None)
        r["_id"] = str(rid) if rid is not None else None
        rh = r.get("reported_by_email_hash")
        if isinstance(rh, str) and len(rh) > 16:
            r["reported_by_email_hash"] = rh[:16] + "…"
        out.append(r)
    return {"count": len(out), "entries": out}


class AdminPasswordReset(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)


@router.patch("/contacts/{contact_id}/password")
async def admin_reset_contact_password(
    contact_id: str,
    body: AdminPasswordReset,
    _: None = Depends(require_admin_operator),
):
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(contact_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid contact_id") from exc

    doc = await db.contacts.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Contact not found")

    new_hash = registrant_auth.hash_password(body.new_password)
    await db.contacts.update_one({"_id": oid}, {"$set": {"password_hash": new_hash}})
    return {"success": True, "message": "Password updated — share the new credential through a secure channel."}


def _onchain_logging_enabled() -> bool:
    return (os.getenv("POLYGON_ONCHAIN_LOG") or "").strip().lower() in ("1", "true", "yes")


class BlockchainRuntimeNetworkPatch(BaseModel):
    """
    In-process override until this API worker exits — does **not** edit ``backend/.env``.
    Send ``{"network": null}`` in JSON so this process follows ``BLOCKCHAIN_ONCHAIN_NETWORK`` again.
    """

    network: Literal["amoy", "mainnet", "mumbai"] | None = None


@router.patch("/blockchain/runtime-network")
async def admin_patch_polygon_runtime_network(
    body: BlockchainRuntimeNetworkPatch,
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    """
    Quick Amoy / mainnet switch for RPC balance checks and the optional on-chain logger (if enabled).
    Bake the same value into ``.env`` + restart so new processes match production config.
    """
    try:
        set_runtime_polygon_network(body.network)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    import main as app_main  # deferred to avoid import cycle with admin router

    rebuild = app_main.reload_onchain_tx_logger_global()
    lbl, rpc, explorer, cid = effective_polygon_bundle()
    warn: str | None = None
    if lbl == "mainnet":
        warn = (
            "Mainnet POL is real money — keep POLYGON_ONCHAIN_LOG=false until you intend to spend gas."
        )
    msg = (
        "Runtime override cleared — following `BLOCKCHAIN_ONCHAIN_NETWORK` in `.env`."
        if body.network is None
        else f"Runtime network set to `{lbl}` for this process; mirror in `.env` + restart for persistence."
    )
    return {
        "success": True,
        "message": msg,
        "runtime_network_override": runtime_polygon_network(),
        "env_blockchain_onchain_network": (os.getenv("BLOCKCHAIN_ONCHAIN_NETWORK") or "").strip()
        or "amoy",
        "effective_onchain_network": lbl,
        "chain_id": cid,
        "rpc_url_display": rpc.split("?")[0],
        "explorer_site": explorer,
        "polygon_onchain_logging_rebuilt_active": rebuild.get("onchain_logging_active"),
        "warning_mainnet_pol": warn,
    }


def _polygon_faucet_links(network_label: str) -> list[dict[str, str]]:
    if network_label == "amoy":
        return [
            {
                "name": "Polygon official faucet (Amoy POL)",
                "url": "https://faucet.polygon.technology/",
            },
            {
                "name": "Chainlink Polygon Amoy",
                "url": "https://faucets.chain.link/polygon-amoy",
            },
            {
                "name": "Alchemy Polygon Amoy",
                "url": "https://www.alchemy.com/faucets/polygon-amoy",
            },
            {"name": "Polygon docs — faucets & tooling", "url": "https://docs.polygon.technology/tools/gas/matic-faucet/"},
        ]
    if network_label == "mumbai":
        return [{"name": "Mumbai sunset — use Amoy instead", "url": "https://polygon.technology/blog"}]
    return [{"name": "Mainnet POL is real money — use an exchange wallet", "url": ""}]


def _serialize_contact_public(c: dict[str, Any], *, mask_phone: bool) -> dict[str, Any]:
    doc = dict(c)
    oid = doc.pop("_id", None)
    doc["_id"] = str(oid) if oid is not None else None
    for k in (
        "verification_code",
        "facility_login_code",
        "facility_login_expires_at",
        "password_hash",
        "session_reverification_code",
        "session_reverification_expires_at",
    ):
        doc.pop(k, None)
    if mask_phone:
        if doc.get("phone_number"):
            doc["phone_number"] = _mask_e164_tail(doc["phone_number"])
        if doc.get("whatsapp_number"):
            doc["whatsapp_number"] = _mask_e164_tail(doc["whatsapp_number"])
    return doc


class OperatorContactCreateIn(ContactRegistration):
    """Public registration payload plus operator-only dispatch toggle."""

    send_verification: bool = Field(
        False,
        description=(
            "If true, pending + OTP like ``POST /api/contacts/register``; "
            "if false (default), mark verified immediately without outbound codes."
        ),
    )


@router.post("/registrants")
async def admin_create_registrant(
    body: OperatorContactCreateIn,
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    reg = ContactRegistration.model_validate(body.model_dump(exclude={"send_verification"}))
    return await persist_contact_registration(
        reg, dispatch_verification=body.send_verification
    )


@router.get("/registrants")
async def admin_list_registrants(
    skip: int = Query(0, ge=0, le=50000),
    limit: int = Query(200, ge=1, le=500),
    filter_status: str = Query(
        "all",
        description="'all', 'active' (registered & not archived), or 'archived' (inactive).",
    ),
    email_contains: str | None = Query(None, description="Substring match on email (case-insensitive)."),
    unmasked_phones: bool = Query(
        False,
        description="Return full phone / WhatsApp (trusted console only).",
    ),
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    """All registrants (including archived contacts with ``active:false``)."""
    db = db_state.require_mongo_db()
    st = filter_status.strip().lower()
    if st not in ("all", "active", "archived"):
        raise HTTPException(status_code=400, detail="filter_status must be all | active | archived")
    q: dict[str, Any] = {}
    if st == "active":
        # Not archived: include legacy rows with no `active` field (only explicit false is archive).
        q["$nor"] = [{"active": False}]
    elif st == "archived":
        q["active"] = False
    if email_contains and email_contains.strip():
        q["email"] = {"$regex": email_contains.strip(), "$options": "i"}
    cur = (
        db.contacts.find(q).sort([("created_at", -1), ("_id", -1)]).skip(skip).limit(limit + 1)
    )
    batch = await cur.to_list(length=limit + 1)
    has_more = len(batch) > limit
    rows = batch[:limit]
    return {
        "skip": skip,
        "limit": limit,
        "filter_status": st,
        "has_more": has_more,
        "count_this_page": len(rows),
        "registrants": [_serialize_contact_public(r, mask_phone=not unmasked_phones) for r in rows],
    }


@router.post("/registrants/{contact_id}/resend-verification")
async def admin_resend_verification_email(
    contact_id: str,
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    """
    Send a fresh verification code to pending enrollees (email/SMS/WhatsApp per their preferences).
    Bypasses the public resend cooldown — for operator helpdesk use.
    """
    return await operator_resend_registration_verification_by_id(contact_id)


class AdminRegistrantEnrolmentPatch(BaseModel):
    """Update site names, internal facility id, and/or alert coverage municipalities (see ``CITIES_CONFIG`` keys)."""

    facility_names: list[str] | None = Field(
        default=None,
        description="Full replacement list of facility/site display names; merge with ``facility_name`` line when both sent.",
    )
    facility_name: str | None = Field(
        default=None,
        description="Additional free-text / newline facility line (same convention as public registration).",
    )
    facility_id: str | None = Field(
        default=None,
        description="Internal stable facility identifier; send empty string to clear.",
    )
    cities: list[str] | None = Field(
        default=None,
        description="Coverage municipalities (must be keys from ``GET /api/cities``). Replaces stored list when set.",
    )
    city: str | None = Field(
        default=None,
        description="Legacy primary municipality key — combined with ``cities`` when updating coverage.",
    )


@router.patch("/registrants/{contact_id}/enrolment")
async def admin_patch_registrant_enrolment(
    contact_id: str,
    body: AdminRegistrantEnrolmentPatch,
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    """Adjust facilities and/or locations for an existing enrollee without re-registering."""
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(contact_id.strip())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid contact_id") from exc

    doc = await db.contacts.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Contact not found")

    provided = body.model_dump(exclude_unset=True)
    if not provided:
        raise HTTPException(status_code=400, detail="Provide at least one of facility_names, facility_name, facility_id, cities, city")

    set_doc: dict[str, Any] = {"updated_at": datetime.utcnow()}

    if "facility_names" in provided or "facility_name" in provided:
        norm_f, summary = _normalize_facility_names(body.facility_names, body.facility_name)
        set_doc["facility_names"] = norm_f
        set_doc["facility_name"] = summary

    if "facility_id" in provided:
        raw_fid = body.facility_id
        if raw_fid is None or (isinstance(raw_fid, str) and not raw_fid.strip()):
            set_doc["facility_id"] = None
        else:
            set_doc["facility_id"] = str(raw_fid).strip()

    if "cities" in provided or "city" in provided:
        inherit_cities = doc.get("cities")
        if not isinstance(inherit_cities, list):
            inherit_cities = []
        list_arg: list[str] | None = None
        if "cities" in provided and body.cities is not None:
            list_arg = [str(x).strip() for x in body.cities if str(x).strip()]
        elif "city" in provided:
            list_arg = [str(x) for x in inherit_cities]
        legacy_city: str | None = None
        if "city" in provided:
            legacy_city = body.city
        elif "cities" in provided:
            legacy_city = str(doc.get("city") or "").strip() or None
        norm_c, primary = _normalize_city_list(list_arg if list_arg else None, legacy_city)
        if not norm_c:
            raise HTTPException(status_code=400, detail="Select at least one valid municipality (see GET /api/cities)")
        set_doc["cities"] = norm_c
        set_doc["city"] = primary

    await db.contacts.update_one({"_id": oid}, {"$set": set_doc})
    updated = await db.contacts.find_one({"_id": oid})
    return {
        "success": True,
        "message": "Enrolment scope updated.",
        "facility_names": updated.get("facility_names") if updated else None,
        "facility_name": updated.get("facility_name") if updated else None,
        "facility_id": updated.get("facility_id") if updated else None,
        "cities": updated.get("cities") if updated else None,
        "city": updated.get("city") if updated else None,
    }


class RegistrantActivePatch(BaseModel):
    active: bool = Field(description="Use false to archive / soft-delete; true to restore.")


@router.patch("/registrants/{contact_id}")
async def admin_patch_registrant_active_state(
    contact_id: str,
    body: RegistrantActivePatch,
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    db = db_state.require_mongo_db()
    try:
        oid = ObjectId(contact_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid contact_id") from exc

    res = await db.contacts.update_one(
        {"_id": oid},
        {"$set": {"active": body.active, "updated_at": datetime.utcnow()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"success": True, "active": body.active}


@router.delete("/registrants/{contact_id}")
async def admin_delete_registrant(
    contact_id: str,
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    """
    Permanent delete — frees the unique email constraint for QA.
    Also removes consent audit rows keyed by string ``contact_id``.
    """
    db = db_state.require_mongo_db()
    cid = contact_id.strip()
    try:
        oid = ObjectId(cid)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid contact_id") from exc

    d_co = await db.consent_records.delete_many({"contact_id": cid})
    d_ct = await db.contacts.delete_one({"_id": oid})
    if d_ct.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {
        "success": True,
        "contact_removed": True,
        "consent_records_removed": int(d_co.deleted_count),
    }


@router.get("/blockchain/overview")
async def admin_blockchain_overview(
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    """
    Read-only operator view for Polygon signer + RPC + testnet faucets.
    On-chain transactions still follow ``POLYGON_ONCHAIN_LOG`` — fund the signer on the displayed network only.
    """
    net_label, rpc_url, explorer, chain_id = effective_polygon_bundle()
    env_bn = (os.getenv("BLOCKCHAIN_ONCHAIN_NETWORK") or "").strip() or "amoy"
    rt_ov = runtime_polygon_network()
    is_mainnet = net_label == "mainnet"
    pk_raw = (os.getenv("POLYGON_PRIVATE_KEY") or "").strip()
    pk_ok = bool(pk_raw and "your_private" not in pk_raw.lower())

    faucet_links = []
    deploy_note = (
        "Permanent: set ``BLOCKCHAIN_ONCHAIN_NETWORK`` plus the matching ``POLYGON_*_RPC_URL`` in ``backend/.env`` and restart all API workers. "
        "Quick try (this process only): use PATCH ``/api/admin/blockchain/runtime-network`` or the dashboard buttons — override clears on restart. "
        "Mainnet: fund **real POL** via an exchange or bridge, not a faucet; only then consider ``POLYGON_ONCHAIN_LOG=true``. "
        "Amoy QA: claim test POL from https://faucet.polygon.technology/ (paste the signer address)."
    )
    if pk_ok:
        faucet_links = _polygon_faucet_links(net_label)

    out: dict[str, Any] = {
        "polygon_onchain_log": _onchain_logging_enabled(),
        "onchain_network": net_label,
        "env_blockchain_onchain_network": env_bn,
        "runtime_network_override": rt_ov,
        "chain_id": chain_id,
        "is_mainnet": is_mainnet,
        "is_testnet": not is_mainnet,
        "private_key_configured": pk_ok,
        "rpc_url_display": rpc_url.split("?")[0],
        "rpc_connected": False,
        "deploy_note": deploy_note,
        "testnet_faucets": [f for f in faucet_links if f.get("url")],
        "wallet_address": None,
        "balance_native": None,
        "explorer_wallet_url": None,
    }

    if not pk_ok:
        out["hint"] = "Set ``POLYGON_PRIVATE_KEY`` then restart."
        return out

    try:
        from eth_account import Account
        from web3 import Web3
    except ImportError:
        out["hint"] = "Install ``web3`` and ``eth-account`` for balance checks."
        return out

    try:
        pk = pk_raw if pk_raw.startswith("0x") else "0x" + pk_raw
        acct = Account.from_key(pk)
        out["wallet_address"] = acct.address
        out["explorer_wallet_url"] = f"{explorer}/address/{acct.address}"

        w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 12}))
        out["rpc_connected"] = bool(w3.is_connected())
        if out["rpc_connected"]:
            bal = w3.eth.get_balance(acct.address)
            wei = int(bal)
            out["balance_wei"] = wei
            out["balance_native"] = str(w3.from_wei(wei, "ether"))
        else:
            out["hint"] = "RPC unreachable — verify ``POLYGON_*_RPC_URL`` for your network choice."
    except Exception as exc:  # noqa: BLE001
        out["hint"] = f"Wallet RPC check failed ({type(exc).__name__})."

    return out


@router.get("/private-documentation/md-files")
async def admin_private_md_paths(
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    """Markdown paths under docs-private/, for operator eyes only."""
    paths = guide_documents.list_private_markdown_basenames()
    return {"paths": paths, "count": len(paths)}


@router.get("/private-documentation/md")
async def admin_private_md_html(
    path: str = Query(..., min_length=1, max_length=512, description="Path relative to docs-private/ (*.md only)"),
    _: None = Depends(require_admin_operator),
) -> dict[str, str]:
    """
    Return sanitized HTML fragment rendered from Markdown (docs-private/).
    Intended for embedding in `/admin/dashboard` after operator authentication (session cookie or API key).
    """
    full = guide_documents.safe_markdown_under(guide_documents.PRIVATE_MARKDOWN_ROOT, path)
    if full is None:
        raise HTTPException(status_code=404, detail="Private markdown path not allowed or not found.")
    raw = full.read_text(encoding="utf-8")
    title = guide_documents.derive_title(raw, fallback=full.stem.replace("_", " "))
    fragment = guide_documents.markdown_to_html_fragment(raw)
    return {"path": path, "title": title, "html_fragment": fragment}


class OutcomeAnchorIn(BaseModel):
    """Operator-initiated outcome row (maps to ``BlockchainLogger.log_outcome`` when Polygon logging is on)."""

    facility_id: str = Field(..., min_length=1, max_length=256)
    facility_display_name: Optional[str] = Field(
        None,
        max_length=500,
        description="Human-readable facility / site name for audit rows only (blockchain still uses facility_id).",
    )
    day: str = Field(..., min_length=8, max_length=32, description="YYYY-MM-DD")
    respiratory_cases: int = Field(..., ge=0, le=1_000_000)
    severe_cases: int = Field(..., ge=0, le=1_000_000)


@router.post("/blockchain/smoke-touch")
async def admin_blockchain_smoke_touch(
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    """
    Submit one minimal on-chain action (``log_action``) to verify the live signer + RPC.
    Costs **gas** on the effective network — confirm Amoy before using mainnet (real POL).
    """
    db = db_state.require_mongo_db()
    net_label, _, _, _ = effective_polygon_bundle()
    result = await onchain_hooks.anchor_admin_smoke_touch(db)
    return {
        "success": True,
        "network": net_label,
        "is_mainnet": net_label == "mainnet",
        "blockchain": result,
        "note": (
            "Check Admin → Load recent anchors for event_type SMOKE_TEST; "
            "explorer link appears when a tx was sent."
        ),
    }


@router.get("/blockchain/anchors")
async def admin_list_onchain_anchors(
    limit: int = Query(50, ge=1, le=200),
    event_type: Optional[str] = Query(
        None,
        description="Filter: ALERT, ACTION, OUTCOME, HEAT_ALERT, SMOKE_TEST",
    ),
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    """Recent anchored events (Mongo audit + optional tx hashes) — operators only."""
    db = db_state.require_mongo_db()
    q: dict[str, Any] = {}
    if event_type and str(event_type).strip():
        q["event_type"] = str(event_type).strip().upper()
    cur = db.onchain_anchor_log.find(q).sort("timestamp", -1).limit(limit)
    rows = await cur.to_list(length=limit)
    out: list[dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        oid = d.pop("_id", None)
        d["_id"] = str(oid) if oid is not None else ""
        ts = d.get("timestamp")
        if isinstance(ts, datetime):
            d["timestamp"] = ts.isoformat() + "Z"
        out.append(d)
    return {"count": len(out), "anchors": out}


@router.post("/blockchain/log-outcome")
async def admin_log_outcome_anchor(
    body: OutcomeAnchorIn,
    _: None = Depends(require_admin_operator),
) -> dict[str, Any]:
    """
    Record an outcome measurement on-chain (when enabled) and in ``onchain_anchor_log``.
    """
    db = db_state.require_mongo_db()
    day = body.day.strip()
    disp = (body.facility_display_name or "").strip() or None
    r = await onchain_hooks.anchor_outcome_measurement(
        db,
        facility_id=body.facility_id.strip(),
        day=day,
        respiratory_cases=body.respiratory_cases,
        severe_cases=body.severe_cases,
        source="admin_console",
        facility_display_name=disp,
    )
    return {
        "success": True,
        "blockchain": r,
        "note": "Rows always appear in /api/admin/blockchain/anchors; tx fields exist when POLYGON_ONCHAIN_LOG is active.",
    }
