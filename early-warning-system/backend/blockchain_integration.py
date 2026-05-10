"""
Cryptographic anchoring + optional EIP-191 signing for health payloads.
Optional Polygon RPC ping (no gas) to confirm network reachability.

Set POLYGON_PRIVATE_KEY in config/.env to attach an Ethereum-style signature
to payloads (compatible with Polygon / EVM tooling).
"""

from __future__ import annotations

import hashlib
import json
import os
from typing import Any, Callable, Mapping, Optional


def canonical_json(payload: Mapping[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode(
        "utf-8"
    )


def anchor_hash(payload: Mapping[str, Any]) -> str:
    """SHA-256 over canonical JSON (audit trail without on-chain fees)."""
    return hashlib.sha256(canonical_json(dict(payload))).hexdigest()


def try_sign_anchor(content_hash_hex: str) -> Optional[dict[str, Any]]:
    """Returns signer + signature bytes (hex) if POLYGON_PRIVATE_KEY is set."""
    raw = os.getenv("POLYGON_PRIVATE_KEY", "").strip()
    if not raw or raw in ("your_private_key_without_0x", "0xyour_private_key_without_0x"):
        return None
    if raw.startswith("0x"):
        raw = raw[2:]
    try:
        from eth_account import Account
        from eth_account.messages import encode_defunct
    except ImportError:
        return None

    account = Account.from_key(raw)
    message = encode_defunct(text=f"EarlyWarningNepal:v1:{content_hash_hex}")
    signed = account.sign_message(message)
    sig = signed.signature
    sig_hex = sig.hex() if hasattr(sig, "hex") else bytes(sig).hex()
    if not sig_hex.startswith("0x"):
        sig_hex = "0x" + sig_hex
    return {"signer_address": account.address, "signature": sig_hex}


def build_verification(
    *,
    envelope: Mapping[str, Any],
    signer: Callable[[str], Optional[dict[str, Any]]] = try_sign_anchor,
) -> dict[str, Any]:
    """Metadata block attached to API responses."""
    content_hash_hex = anchor_hash(envelope)
    block: dict[str, Any] = {
        "scheme": "SHA-256(canonical-json)",
        "content_hash": f"0x{content_hash_hex}",
        "network_configured": os.getenv("BLOCKCHAIN_NETWORK", "polygon").lower(),
        "blockchain_enabled": os.getenv("BLOCKCHAIN_ENABLED", "true").lower() in (
            "1",
            "true",
            "yes",
        ),
    }
    sig = signer(content_hash_hex)
    block["cryptographically_signed"] = bool(sig)
    if sig:
        block["signer_address"] = sig["signer_address"]
        block["signature"] = sig["signature"]
        block["message_domain"] = "EarlyWarningNepal:v1"
    return block


def polygon_rpc_ping() -> dict[str, Any]:
    """Read-only RPC check — does not submit transactions."""
    rpc = (
        os.getenv("POLYGON_RPC_URL")
        or os.getenv("POLYGON_AMOY_RPC_URL")
        or "https://polygon-rpc.com"
    )
    net = os.getenv("BLOCKCHAIN_NETWORK", "polygon").lower()
    out: dict[str, Any] = {
        "network": net,
        "rpc_url": rpc,
        "connected": False,
    }
    try:
        from web3 import Web3

        w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={"timeout": 8}))
        out["connected"] = bool(w3.is_connected())
        if out["connected"]:
            out["latest_block_number"] = int(w3.eth.block_number)
    except Exception as exc:  # noqa: BLE001 — surface as status
        out["error"] = type(exc).__name__
    return out
