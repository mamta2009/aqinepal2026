# AQI Nepal 2026 — Early warning platform

Public repository for the **Nepal air quality & respiratory early-warning demo**: FastAPI backend, static landing, **guides** hub (`/guides`), registration flows, Mongo-backed notifications, and an operator admin console.

**Upstream:** [https://github.com/mamta2009/aqinepal2026](https://github.com/mamta2009/aqinepal2026)

## What’s in this tree

| Path | Purpose |
|------|---------|
| [`early-warning-system/`](early-warning-system/) | **Application root** — run from `early-warning-system/backend/`; **[`README.md`](early-warning-system/README.md)** is the stub entry |
| **[`early-warning-system/docs/guides/`](early-warning-system/docs/guides/README.md)** | **All non-private Markdown** (implementation snapshot, Cursor guide, prompts, blockchain notes, landing guide) |
| [`early-warning-system/docs/guides/IMPLEMENTATION_SNAPSHOT.md`](early-warning-system/docs/guides/IMPLEMENTATION_SNAPSHOT.md) | **Canonical technical reference** (APIs, env load order, Mongo, AQ resolver, admin routes) |
| [`early-warning-system/docs-private/`](early-warning-system/docs-private/) | Partner-restricted drafts — **`docs-private/` Markdown is not linked on `/guides`**; preview from **Admin → Private documentation** (requires `NOTIFICATION_API_KEY`). |

Archived convenience copies (`files.zip`, etc.) aside, the living guides live under **`early-warning-system/docs/guides/`**.

## Quick start

```bash
cd early-warning-system/backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env

python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Then open **`http://127.0.0.1:8000/`**, **`http://127.0.0.1:8000/guides`**, **`http://127.0.0.1:8000/registration`**, **`http://127.0.0.1:8000/admin/dashboard`**. Older **`/documentation`** URLs redirect to **`/guides`**; **`/guides/md/…`** renders individual Markdown files from **`docs/guides/`**.

Secrets: **`backend/.env`** is ignored — never commit it.
