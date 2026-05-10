"""
Optional Polygon transaction logger from the blockchain_AI package.

Hashes events (alert / action / outcome) and submits a self-transaction with payload
data for an on-chain audit footprint. Off by default — set POLYGON_ONCHAIN_LOG=true
and POLYGON_PRIVATE_KEY; use Polygon Amoy testnet POL for experiments (Mumbai is retired).

Original reference: docs/blockchain-ai/reference_blockchain_logger.py
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# In-process override only (does not rewrite .env). Cleared after process restart — then .env wins.
_RUNTIME_POLYGON_NET: Optional[str] = None


def polygon_bundle_for_normalized_network(network: str) -> tuple[str, str, str, int]:
    """
    For label ``amoy`` | ``mumbai`` | ``mainnet``: return ``(label, rpc_url, explorer_origin, chain_id_constant)``.
    """
    n = network.strip().lower()
    if n == "mainnet":
        rpc = os.getenv("POLYGON_RPC_URL", "https://polygon-rpc.com")
        return "mainnet", rpc, "https://polygonscan.com", 137
    if n == "mumbai":
        rpc = os.getenv(
            "POLYGON_MUMBAI_RPC_URL", "https://rpc-mumbai.maticvigil.com"
        )
        return "mumbai", rpc, "https://mumbai.polygonscan.com", 80001
    rpc = os.getenv(
        "POLYGON_AMOY_RPC_URL", "https://rpc-amoy.polygon.technology"
    )
    return "amoy", rpc, "https://amoy.polygonscan.com", 80002


def _normalized_env_network_fallback() -> str:
    raw = os.getenv("BLOCKCHAIN_ONCHAIN_NETWORK", "amoy").strip().lower()
    if raw not in ("amoy", "mumbai", "mainnet"):
        logger.warning(
            "BLOCKCHAIN_ONCHAIN_NETWORK=%s invalid; using amoy", raw
        )
        return "amoy"
    return raw


def runtime_polygon_network() -> Optional[str]:
    """In-process alias only — ``None`` means follow ``BLOCKCHAIN_ONCHAIN_NETWORK`` in .env."""
    return _RUNTIME_POLYGON_NET


def set_runtime_polygon_network(value: Optional[str]) -> None:
    """
    Restrict to ``amoy`` | ``mumbai`` | ``mainnet`` or ``None`` to clear override.
    Does **not** change ``.env``.
    """
    global _RUNTIME_POLYGON_NET
    if value is None:
        _RUNTIME_POLYGON_NET = None
        return
    x = value.strip().lower()
    if x not in ("amoy", "mumbai", "mainnet"):
        raise ValueError(f"unsupported network {value!r}")
    _RUNTIME_POLYGON_NET = x


def effective_polygon_network() -> str:
    """Prefer runtime override else ``BLOCKCHAIN_ONCHAIN_NETWORK`` (env)."""
    rt = runtime_polygon_network()
    if rt in ("amoy", "mumbai", "mainnet"):
        return rt
    return _normalized_env_network_fallback()


def effective_polygon_bundle() -> tuple[str, str, str, int]:
    return polygon_bundle_for_normalized_network(effective_polygon_network())


class BlockchainLogger:
    """Logs hashed events to Polygon Amoy, legacy Mumbai, or mainnet (optional, costs gas when enabled)."""

    def __init__(
        self,
        network: str = "amoy",
        private_key: Optional[str] = None,
        enable: bool = True,
    ):
        self.enable = enable
        n_fixed = network.strip().lower()
        self.network = n_fixed
        self.events: List[dict[str, Any]] = []
        self.w3 = None
        self.account = None
        self.rpc_url = ""
        self.network_name = ""
        self.explorer_url = ""

        if not enable:
            logger.info("BlockchainLogger: disabled")
            return

        try:
            from eth_account import Account
            from web3 import Web3
        except ImportError as exc:
            logger.error("BlockchainLogger: web3/eth_account missing — %s", exc)
            self.enable = False
            return

        try:
            if n_fixed not in ("amoy", "mumbai", "mainnet"):
                raise ValueError(f"Unknown network: {network}")
            _, self.rpc_url, self.explorer_url, _ = polygon_bundle_for_normalized_network(
                n_fixed
            )
            self.network_name = {
                "amoy": "Polygon Amoy Testnet",
                "mumbai": "Polygon Mumbai Testnet (deprecated)",
                "mainnet": "Polygon Mainnet",
            }[n_fixed]

            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            if not self.w3.is_connected():
                raise ConnectionError(f"Could not connect to {self.network_name}")

            logger.info("BlockchainLogger: connected to %s", self.network_name)

            if not private_key:
                private_key = os.getenv("POLYGON_PRIVATE_KEY", "")
            pk = (private_key or "").strip()
            if not pk or "your_private" in pk.lower():
                raise ValueError("POLYGON_PRIVATE_KEY not set")
            if not pk.startswith("0x"):
                pk = "0x" + pk

            self.account = Account.from_key(pk)
            logger.info("BlockchainLogger: wallet %s", self.account.address)

            balance = self.w3.eth.get_balance(self.account.address)
            balance_matic = self.w3.from_wei(balance, "ether")
            logger.info("BlockchainLogger: balance %.4f native", float(balance_matic))

        except Exception as exc:  # noqa: BLE001
            logger.error("BlockchainLogger init failed: %s", exc)
            self.enable = False

    def log_alert(
        self,
        city: str,
        alert_level: str,
        pm25: float,
        risk_score: float,
        facility_id: Optional[str] = None,
    ) -> Optional[Dict[str, str]]:
        if not self.enable:
            return None
        try:
            timestamp = int(datetime.utcnow().timestamp())
            event_data = {
                "event_type": "ALERT",
                "city": city,
                "alert_level": alert_level,
                "pm25": pm25,
                "risk_score": risk_score,
                "facility_id": facility_id or "general",
                "timestamp": timestamp,
            }
            event_hash = self._hash_event(event_data)
            tx_hash = self._send_transaction(event_hash, "ALERT")
            self.events.append(
                {
                    "event_type": "ALERT",
                    "tx_hash": tx_hash,
                    "event_hash": event_hash,
                    "data": event_data,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
            return {
                "tx_hash": tx_hash,
                "event_hash": event_hash,
                "explorer_url": f"{self.explorer_url}/tx/{tx_hash}",
                "alert_level": alert_level,
                "pm25": str(pm25),
            }
        except Exception as exc:  # noqa: BLE001
            logger.error("log_alert failed: %s", exc)
            return None

    def log_action(
        self,
        facility_id: str,
        action: str,
        verified: bool = True,
        details: Optional[str] = None,
    ) -> Optional[Dict[str, str]]:
        if not self.enable:
            return None
        try:
            timestamp = int(datetime.utcnow().timestamp())
            event_data = {
                "event_type": "ACTION",
                "facility_id": facility_id,
                "action": action,
                "verified": verified,
                "details": details or "",
                "timestamp": timestamp,
            }
            event_hash = self._hash_event(event_data)
            tx_hash = self._send_transaction(event_hash, "ACTION")
            self.events.append(
                {
                    "event_type": "ACTION",
                    "tx_hash": tx_hash,
                    "event_hash": event_hash,
                    "data": event_data,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
            return {
                "tx_hash": tx_hash,
                "event_hash": event_hash,
                "explorer_url": f"{self.explorer_url}/tx/{tx_hash}",
                "action": action,
                "facility_id": facility_id,
            }
        except Exception as exc:  # noqa: BLE001
            logger.error("log_action failed: %s", exc)
            return None

    def log_outcome(
        self,
        facility_id: str,
        date: str,
        respiratory_cases: int,
        severe_cases: int,
    ) -> Optional[Dict[str, str]]:
        if not self.enable:
            return None
        try:
            timestamp = int(datetime.utcnow().timestamp())
            event_data = {
                "event_type": "OUTCOME",
                "facility_id": facility_id,
                "date": date,
                "respiratory_cases": respiratory_cases,
                "severe_cases": severe_cases,
                "timestamp": timestamp,
            }
            event_hash = self._hash_event(event_data)
            tx_hash = self._send_transaction(event_hash, "OUTCOME")
            self.events.append(
                {
                    "event_type": "OUTCOME",
                    "tx_hash": tx_hash,
                    "event_hash": event_hash,
                    "data": event_data,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
            return {
                "tx_hash": tx_hash,
                "event_hash": event_hash,
                "explorer_url": f"{self.explorer_url}/tx/{tx_hash}",
                "facility_id": facility_id,
                "respiratory_cases": str(respiratory_cases),
            }
        except Exception as exc:  # noqa: BLE001
            logger.error("log_outcome failed: %s", exc)
            return None

    def verify_event(self, tx_hash: str) -> Dict[str, Any]:
        if not self.enable:
            return {"error": "Blockchain logging disabled"}
        try:
            tx_receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            return {
                "tx_hash": tx_hash,
                "block_number": int(tx_receipt["blockNumber"]),
                "from": tx_receipt["from"],
                "status": "confirmed" if tx_receipt["status"] == 1 else "failed",
                "explorer_url": f"{self.explorer_url}/tx/{tx_hash}",
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as exc:  # noqa: BLE001
            return {"error": str(exc), "tx_hash": tx_hash}

    def get_events(self, event_type: Optional[str] = None) -> list:
        if event_type:
            return [e for e in self.events if e["event_type"] == event_type]
        return self.events

    def _hash_event(self, event_data: Dict[str, Any]) -> str:
        from hashlib import sha256

        event_str = json.dumps(event_data, sort_keys=True, default=str)
        return sha256(event_str.encode()).hexdigest()

    def _send_transaction(self, event_hash: str, event_type: str) -> str:
        from eth_account import Account

        try:
            nonce = self.w3.eth.get_transaction_count(self.account.address)
            gas_price = self.w3.eth.gas_price
            payload = bytes.fromhex(event_hash)

            try:
                gas_est = self.w3.eth.estimate_gas(
                    {
                        "from": self.account.address,
                        "to": self.account.address,
                        "value": 0,
                        "data": payload,
                    }
                )
                gas_limit = min(int(gas_est) + 20000, 500000)
            except Exception:  # noqa: BLE001
                gas_limit = 100000

            tx: dict[str, Any] = {
                "nonce": nonce,
                "gasPrice": gas_price,
                "gas": gas_limit,
                "to": self.account.address,
                "value": 0,
                "data": payload,
                "chainId": self._get_chain_id(),
            }

            signed_tx = Account.sign_transaction(tx, self.account.key)
            raw = getattr(signed_tx, "raw_transaction", None) or getattr(
                signed_tx, "rawTransaction"
            )
            tx_hash = self.w3.eth.send_raw_transaction(raw)
            return self.w3.to_hex(tx_hash)
        except Exception as exc:  # noqa: BLE001
            logger.error("Transaction failed (%s): %s", event_type, exc)
            raise

    def _get_chain_id(self) -> int:
        if self.network == "amoy":
            return 80002
        if self.network == "mumbai":
            return 80001
        if self.network == "mainnet":
            return 137
        return int(self.w3.eth.chain_id)


def build_logger_from_env() -> Optional[BlockchainLogger]:
    """If POLYGON_ONCHAIN_LOG is truthy, return a BlockchainLogger else None."""
    flag = os.getenv("POLYGON_ONCHAIN_LOG", "false").lower()
    if flag not in ("1", "true", "yes"):
        return None
    net = effective_polygon_network()
    return BlockchainLogger(network=net, enable=True)
