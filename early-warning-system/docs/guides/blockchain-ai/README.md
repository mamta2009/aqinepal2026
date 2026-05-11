# blockchain_AI package in this repo

Contents from **`frontend/blockchain_AI.zip`** are mirrored here for review and versioning.

**Upstream application repo:** [`github.com/mamta2009/aqinepal2026`](https://github.com/mamta2009/aqinepal2026)

**API surface, AQ resolver, env keys, and `provenance` schema:** see **[`../IMPLEMENTATION_SNAPSHOT.md`](../IMPLEMENTATION_SNAPSHOT.md)** (`docs/guides/`).

## What runs in the server

| Piece | Purpose |
| --- | --- |
| [`backend/blockchain_integration.py`](../../../backend/blockchain_integration.py) | Digest / optional EIP-191 signing hooks on API payloads (`build_verification`, RPC ping helpers). Always safe to enable. |
| [`backend/onchain_logger.py`](../../../backend/onchain_logger.py) | Optional **Polygon transactions** that anchor hashed events (alert / action / outcome), adapted from **`reference_blockchain_logger.py`**. **Off by default** — costs native gas (POL on mainnet, test POL on Amoy) when enabled. |
| [`backend/onchain_hooks.py`](../../../backend/onchain_hooks.py) | **Product bridge:** invokes the logger from alerts, facility actions, heat evaluate, and admin-only helpers; persists every run (tx, skip, or failure) to MongoDB **`onchain_anchor_log`**. |

## Reference-only (not imported at startup)

| File | Notes |
| --- | --- |
| [`reference_blockchain_logger.py`](../../blockchain-ai/reference_blockchain_logger.py) | Original ZIP implementation; **`onchain_logger.py`** is the maintained runtime copy. |
| [`reference_ai_models_extended.py`](../../blockchain-ai/reference_ai_models_extended.py) | Extended model sketches; demo API uses [`backend/ai_models.py`](../../../backend/ai_models.py) instead. |

## Enable on-chain logging

Set in `config/.env` or `backend/.env`:

- `POLYGON_ONCHAIN_LOG=true`
- `POLYGON_PRIVATE_KEY=…` (fund the signer on the **same** network you select below)
- `BLOCKCHAIN_ONCHAIN_NETWORK=amoy` — **recommended** for experiments (Polygon PoS testnet; Mumbai is legacy)
- or `mainnet` if you consciously accept **real POL** gas for production anchoring

Optional RPC overrides: `POLYGON_AMOY_RPC_URL`, `POLYGON_RPC_URL` (mainnet), `POLYGON_MUMBAI_RPC_URL` (deprecated).

### Verify wiring before mainnet

1. Stay on **Amoy**, fund the signer from a [Polygon faucet](https://faucet.polygon.technology/).
2. Open **`GET /admin/dashboard`** → unlock → **Polygon** → **Refresh blockchain overview** (confirm RPC + balance + `POLYGON_ONCHAIN_LOG`).
3. Click **Send test on-chain touch** (or call `POST /api/admin/blockchain/smoke-touch` with operator auth) — confirm the resulting **SMOKE_TEST** row under **Load recent anchors** and the **Polygonscan** tx link when present.
4. Only then switch `.env` to **mainnet**, fund **real POL**, restart workers, and re-run the smoke test.

### Where operators review anchors

- **Admin dashboard (UI):** Polygon section → **Load recent anchors** (`GET /api/admin/blockchain/anchors`).
- **Not exposed to public `/users`:** end users do not get a transaction browser; transparency is via operator tools and on-chain explorers using the published tx hashes.

Check low-level status: **`GET /api/blockchain/status`** and **`GET /api/blockchain/integration`**.

## Guides (markdown in this repo)

- [`INTEGRATION_GUIDE.md`](./INTEGRATION_GUIDE.md) — original step-by-step from the ZIP (narrative may pre-date `onchain_hooks.py`; prefer **IMPLEMENTATION_SNAPSHOT** for route truth).

Internal strategy drafts live under **`docs-private/`**. They do **not** appear on `/guides`; operators can open them after authenticating under **Admin → Private documentation**.
