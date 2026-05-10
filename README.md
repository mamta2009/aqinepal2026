# AQI Nepal 2026 — Early warning platform

Public repository for the **Nepal air quality & respiratory early-warning demo**: FastAPI backend, static landing/documentation, registration flows, Mongo-backed notifications, and an operator admin console.

**Upstream:** [https://github.com/mamta2009/aqinepal2026](https://github.com/mamta2009/aqinepal2026)

## What’s in this tree

| Path | Purpose |
|------|---------|
| [`early-warning-system/`](early-warning-system/) | **Application root** — run the backend from `early-warning-system/backend/` and read **[`early-warning-system/README.md`](early-warning-system/README.md)** |
| [`early-warning-system/docs/IMPLEMENTATION_SNAPSHOT.md`](early-warning-system/docs/IMPLEMENTATION_SNAPSHOT.md) | **Canonical technical reference** (APIs, env load order, Mongo collections, AQ resolver, admin routes) |
| [`early-warning-system/docs-private/`](early-warning-system/docs-private/) | Internal UNICEF/strategy drafts; **cross-check runnable claims against the implementation snapshot before external use** |

Root-level `.zip` archives and local guides (`CURSOR_SETUP_GUIDE.md`, `PACKAGE_COMPLETE.md`, `prompts.md`) are convenience copies; day-to-day development follows `early-warning-system/`.

## Quick start

```bash
cd early-warning-system/backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # optionally also merge keys from ../config/.env.example
# Edit .env (Mongo URL, notification keys, AQ keys as needed)

python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Then open **http://127.0.0.1:8000/** (marketing landing), **http://127.0.0.1:8000/documentation**, **http://127.0.0.1:8000/registration**, and (with operator credentials configured) **http://127.0.0.1:8000/admin/dashboard**.

Secrets: **`backend/.env`** is ignored by git — never commit it.
