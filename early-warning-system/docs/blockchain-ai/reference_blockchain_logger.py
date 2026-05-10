# blockchain_integration.py
"""
Blockchain Integration Module
Logs critical events (alerts, actions, outcomes) to Polygon blockchain
for immutable audit trail and transparency.

Uses Polygon Mumbai testnet for MVP (free)
Polygon mainnet for production ($0.01-0.10 per transaction)
"""

from web3 import Web3
from eth_account import Account
from datetime import datetime
import logging
import json
from typing import Optional, Dict, Any
import os

logger = logging.getLogger(__name__)


class BlockchainLogger:
    """
    Logs critical events to Polygon blockchain.
    
    Events logged:
    - ALERT: When a respiratory risk alert is triggered
    - ACTION: When health workers take preventive actions
    - OUTCOME: Daily respiratory case counts
    
    All events are hashed for privacy (no sensitive data stored on-chain)
    """
    
    def __init__(
        self,
        network: str = "mumbai",  # "mumbai" for testnet, "mainnet" for production
        private_key: Optional[str] = None,
        enable: bool = True
    ):
        """
        Initialize blockchain connection.
        
        Args:
            network: 'mumbai' (testnet, free) or 'mainnet' (production, small cost)
            private_key: Polygon wallet private key (from env variable)
            enable: If False, blockchain logging is disabled (for development)
        """
        self.enable = enable
        self.network = network
        self.events = []
        
        if not enable:
            logger.info("Blockchain logging is DISABLED (development mode)")
            return
        
        try:
            # Network configuration
            if network == "mumbai":
                self.rpc_url = "https://rpc-mumbai.maticvigil.com"
                self.network_name = "Polygon Mumbai Testnet"
                self.explorer_url = "https://mumbai.polygonscan.com"
            elif network == "mainnet":
                self.rpc_url = "https://rpc-mainnet.maticvigil.com"
                self.network_name = "Polygon Mainnet"
                self.explorer_url = "https://polygonscan.com"
            else:
                raise ValueError(f"Unknown network: {network}")
            
            # Connect to blockchain
            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            
            if not self.w3.is_connected():
                raise ConnectionError(f"Could not connect to {self.network_name}")
            
            logger.info(f"✓ Connected to {self.network_name}")
            
            # Load wallet
            if not private_key:
                private_key = os.getenv("POLYGON_PRIVATE_KEY")
                
            if not private_key:
                raise ValueError("POLYGON_PRIVATE_KEY not set in environment")
            
            # Ensure key has 0x prefix
            if not private_key.startswith("0x"):
                private_key = "0x" + private_key
            
            self.account = Account.from_key(private_key)
            logger.info(f"✓ Wallet loaded: {self.account.address}")
            
            # Get balance
            balance = self.w3.eth.get_balance(self.account.address)
            balance_matic = self.w3.from_wei(balance, 'ether')
            logger.info(f"✓ Wallet balance: {balance_matic:.4f} MATIC")
            
        except Exception as e:
            logger.error(f"✗ Blockchain initialization failed: {e}")
            self.enable = False


    def log_alert(
        self,
        city: str,
        alert_level: str,
        pm25: float,
        risk_score: float,
        facility_id: Optional[str] = None
    ) -> Optional[Dict[str, str]]:
        """
        Log alert event to blockchain.
        
        Args:
            city: City name (Kathmandu, Lalitpur, Bhaktapur)
            alert_level: HIGH, MODERATE, LOW
            pm25: PM2.5 value in µg/m³
            risk_score: Risk score 0-100
            facility_id: Target facility ID (optional)
        
        Returns:
            Dict with tx_hash and event details, or None if disabled
        """
        if not self.enable:
            return None
        
        try:
            timestamp = int(datetime.utcnow().timestamp())
            
            # Create event data
            event_data = {
                "event_type": "ALERT",
                "city": city,
                "alert_level": alert_level,
                "pm25": pm25,
                "risk_score": risk_score,
                "facility_id": facility_id or "general",
                "timestamp": timestamp
            }
            
            # Hash the data (privacy: don't store sensitive info on-chain)
            event_hash = self._hash_event(event_data)
            
            # Send to blockchain
            tx_hash = self._send_transaction(event_hash, "ALERT")
            
            # Store locally for reference
            self.events.append({
                "event_type": "ALERT",
                "tx_hash": tx_hash,
                "event_hash": event_hash,
                "data": event_data,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            logger.info(f"✓ Alert logged to blockchain: {tx_hash}")
            
            return {
                "tx_hash": tx_hash,
                "event_hash": event_hash,
                "explorer_url": f"{self.explorer_url}/tx/{tx_hash}",
                "alert_level": alert_level,
                "pm25": pm25
            }
            
        except Exception as e:
            logger.error(f"✗ Failed to log alert: {e}")
            return None


    def log_action(
        self,
        facility_id: str,
        action: str,
        verified: bool = True,
        details: Optional[str] = None
    ) -> Optional[Dict[str, str]]:
        """
        Log facility action to blockchain.
        
        Actions:
        - stocked_oxygen: O₂ cylinders stocked
        - staff_called: Pediatric staff briefed
        - protocol_reviewed: Rapid triage protocol reviewed
        - supplies_checked: Medications verified
        
        Args:
            facility_id: Facility identifier
            action: Action type
            verified: Is action verified by supervisor?
            details: Optional additional details
        
        Returns:
            Dict with tx_hash and event details
        """
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
                "timestamp": timestamp
            }
            
            event_hash = self._hash_event(event_data)
            tx_hash = self._send_transaction(event_hash, "ACTION")
            
            self.events.append({
                "event_type": "ACTION",
                "tx_hash": tx_hash,
                "event_hash": event_hash,
                "data": event_data,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            logger.info(f"✓ Action logged to blockchain: {tx_hash}")
            
            return {
                "tx_hash": tx_hash,
                "event_hash": event_hash,
                "explorer_url": f"{self.explorer_url}/tx/{tx_hash}",
                "action": action,
                "facility_id": facility_id,
                "verified": verified
            }
            
        except Exception as e:
            logger.error(f"✗ Failed to log action: {e}")
            return None


    def log_outcome(
        self,
        facility_id: str,
        date: str,
        respiratory_cases: int,
        severe_cases: int
    ) -> Optional[Dict[str, str]]:
        """
        Log daily outcome metrics to blockchain.
        
        Args:
            facility_id: Facility identifier
            date: Date (YYYY-MM-DD format)
            respiratory_cases: Total respiratory admissions
            severe_cases: Cases requiring oxygen
        
        Returns:
            Dict with tx_hash and event details
        """
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
                "timestamp": timestamp
            }
            
            event_hash = self._hash_event(event_data)
            tx_hash = self._send_transaction(event_hash, "OUTCOME")
            
            self.events.append({
                "event_type": "OUTCOME",
                "tx_hash": tx_hash,
                "event_hash": event_hash,
                "data": event_data,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            logger.info(f"✓ Outcome logged to blockchain: {tx_hash}")
            
            return {
                "tx_hash": tx_hash,
                "event_hash": event_hash,
                "explorer_url": f"{self.explorer_url}/tx/{tx_hash}",
                "facility_id": facility_id,
                "respiratory_cases": respiratory_cases
            }
            
        except Exception as e:
            logger.error(f"✗ Failed to log outcome: {e}")
            return None


    def verify_event(self, tx_hash: str) -> Dict[str, Any]:
        """
        Verify an event on blockchain.
        
        Args:
            tx_hash: Transaction hash to verify
        
        Returns:
            Verification details
        """
        if not self.enable:
            return {"error": "Blockchain logging disabled"}
        
        try:
            tx_receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            
            return {
                "tx_hash": tx_hash,
                "block_number": tx_receipt['blockNumber'],
                "from": tx_receipt['from'],
                "status": "confirmed" if tx_receipt['status'] == 1 else "failed",
                "explorer_url": f"{self.explorer_url}/tx/{tx_hash}",
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {"error": str(e), "tx_hash": tx_hash}


    def get_events(self, event_type: Optional[str] = None) -> list:
        """
        Get all logged events (local copy, not from blockchain).
        
        Args:
            event_type: Filter by event type (ALERT, ACTION, OUTCOME)
        
        Returns:
            List of events
        """
        if event_type:
            return [e for e in self.events if e['event_type'] == event_type]
        return self.events


    # ===== PRIVATE METHODS =====

    def _hash_event(self, event_data: Dict[str, Any]) -> str:
        """
        Hash event data using SHA-256.
        
        Privacy: We hash the data so blockchain stores proof of event
        without exposing sensitive information.
        """
        from hashlib import sha256
        
        # Convert to JSON string (deterministic order)
        event_str = json.dumps(event_data, sort_keys=True)
        event_hash = sha256(event_str.encode()).hexdigest()
        
        return event_hash


    def _send_transaction(self, event_hash: str, event_type: str) -> str:
        """
        Send transaction to blockchain.
        
        Simple approach: Store event hash in transaction data field
        More advanced: Deploy smart contract and call it (requires more gas)
        
        For MVP, we use simple approach (cheaper, simpler)
        """
        try:
            nonce = self.w3.eth.get_transaction_count(self.account.address)
            gas_price = self.w3.eth.gas_price
            
            # Estimate gas (for simple transaction)
            gas_limit = 21000
            
            # Create transaction
            # We store the event hash as transaction input data
            tx = {
                'nonce': nonce,
                'gasPrice': gas_price,
                'gas': gas_limit,
                'to': self.account.address,  # Send to self (proof of existence)
                'value': 0,
                'data': event_hash,  # Store event hash in data field
                'chainId': self._get_chain_id()
            }
            
            # Sign transaction
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.account.key)
            
            # Send transaction
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            # Return hex string
            return self.w3.to_hex(tx_hash)
            
        except Exception as e:
            logger.error(f"Transaction failed: {e}")
            raise


    def _get_chain_id(self) -> int:
        """Get blockchain chain ID (1 for Ethereum, 80001 for Mumbai, etc)"""
        if self.network == "mumbai":
            return 80001
        elif self.network == "mainnet":
            return 137
        else:
            return self.w3.eth.chain_id


    def get_balance(self) -> str:
        """Get wallet MATIC balance"""
        if not self.enable:
            return "Blockchain disabled"
        
        balance = self.w3.eth.get_balance(self.account.address)
        balance_matic = self.w3.from_wei(balance, 'ether')
        return f"{balance_matic:.4f} MATIC"


    def get_address(self) -> str:
        """Get wallet address"""
        return self.account.address if self.enable else "Blockchain disabled"


# ===== USAGE EXAMPLE =====
"""
# Initialize blockchain logger
blockchain = BlockchainLogger(
    network="mumbai",  # Use testnet for MVP
    private_key=os.getenv("POLYGON_PRIVATE_KEY")
)

# Log an alert
alert_tx = blockchain.log_alert(
    city="Kathmandu",
    alert_level="HIGH",
    pm25=188.5,
    risk_score=75.0,
    facility_id="ktm_hospital_01"
)

# Log an action
action_tx = blockchain.log_action(
    facility_id="ktm_hospital_01",
    action="stocked_oxygen",
    verified=True,
    details="12 cylinders stocked"
)

# Log an outcome
outcome_tx = blockchain.log_outcome(
    facility_id="ktm_hospital_01",
    date="2024-05-04",
    respiratory_cases=12,
    severe_cases=3
)

# Verify on blockchain
verification = blockchain.verify_event(alert_tx['tx_hash'])
print(f"View on blockchain: {verification['explorer_url']}")

# Get all logged alerts
alerts = blockchain.get_events("ALERT")
"""
