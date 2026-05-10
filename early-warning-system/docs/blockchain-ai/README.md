# blockchain_AI package in this repo

Contents from **`frontend/blockchain_AI.zip`** are mirrored here for review and versioning.

**API surface, AQ resolver, env keys, and `provenance` schema:** see **[`../IMPLEMENTATION_SNAPSHOT.md`](../IMPLEMENTATION_SNAPSHOT.md)** (root `docs/`).

## What runs in the server

| Piece | Purpose |
| --- | --- |
| [`backend/blockchain_integration.py`](../../backend/blockchain_integration.py) | Digest / optional EIP-191 signing hooks on API payloads (`build_verification`, RPC ping helpers). Always safe to enable. |
| [`backend/onchain_logger.py`](../../backend/onchain_logger.py) | Optional **Polygon transactions** that anchor hashed events (alert / action / outcome), adapted from **`reference_blockchain_logger.py`**. **Off by default** — costs MATIC gas when enabled. |

## Reference-only (not imported at startup)

| File | Notes |
| --- | --- |
| `reference_blockchain_logger.py` | Original ZIP implementation; **`onchain_logger.py`** is the maintained runtime copy. |
| `reference_ai_models_extended.py` | Extended model sketches; demo API uses [`backend/ai_models.py`](../../backend/ai_models.py) instead. |

## Enable on-chain logging

Set in `config/.env` or `backend/.env`:

- `POLYGON_ONCHAIN_LOG=true`
- `POLYGON_PRIVATE_KEY=0x...` (funded on Mumbai for tests)
- `BLOCKCHAIN_ONCHAIN_NETWORK=mumbai` (or `mainnet` if you accept mainnet cost/risk)

Optional: `POLYGON_MUMBAI_RPC_URL`, `POLYGON_RPC_URL`.

Check status: `GET /api/blockchain/status` and `GET /api/blockchain/integration`.

## Guides (public repo)

- `INTEGRATION_GUIDE.md` — original step-by-step from the ZIP.

Internal strategy notes previously in this folder may live under `docs-private/` and are intentionally **not** served by the demo website.
