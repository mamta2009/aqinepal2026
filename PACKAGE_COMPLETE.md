# 📦 Nepal AQI early-warning — package summary

## ✅ What you have

### Source code (GitHub — recommended)

**Repository:** [https://github.com/mamta2009/aqinepal2026](https://github.com/mamta2009/aqinepal2026)

```bash
git clone https://github.com/mamta2009/aqinepal2026.git
cd aqinepal2026/early-warning-system
```

Documentation for behaviour and APIs: **[`early-warning-system/docs/IMPLEMENTATION_SNAPSHOT.md`](early-warning-system/docs/IMPLEMENTATION_SNAPSHOT.md)**.  
Hands-on Cursor walkthrough (same URLs and layout): **[`CURSOR_SETUP_GUIDE.md`](CURSOR_SETUP_GUIDE.md)** (repo root).

### Optional ZIP delivery

An **`early-warning-system.zip`** (if someone shared one) mirrors the **`early-warning-system/`** folder: backend, **`landing/`** (marketing, **`/documentation`**, **`/registration`**, **`/admin/dashboard`**), **`frontend/`**, **`config/`**, **`docs/`**.

---

## 🚀 Getting started (~10 minutes)

```bash
git clone https://github.com/mamta2009/aqinepal2026.git
cd aqinepal2026/early-warning-system/backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — Mongo keys, AQ keys, NOTIFICATION_API_KEY, etc.

python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Use **`http://127.0.0.1:8000`** in the browser (avoid **`http://0.0.0.0:8000`** — often blank).

| Page | URL |
|------|-----|
| Marketing landing | `http://127.0.0.1:8000/` |
| Documentation hub | `http://127.0.0.1:8000/documentation` |
| Registration | `http://127.0.0.1:8000/registration` |
| Dashboard | `http://127.0.0.1:8000/frontend/index.html` |
| Operator admin | `http://127.0.0.1:8000/admin/dashboard` |
| OpenAPI | `http://127.0.0.1:8000/docs` |

---

## 📚 Documentation index (in-repo)

| File | Purpose |
|------|---------|
| [`README.md`](README.md) | Repo overview + pointers into `early-warning-system/` |
| [`early-warning-system/README.md`](early-warning-system/README.md) | App quick start, structure, URLs |
| [`early-warning-system/docs/IMPLEMENTATION_SNAPSHOT.md`](early-warning-system/docs/IMPLEMENTATION_SNAPSHOT.md) | Canonical APIs, env, Mongo, AQ resolver, **`/api/admin/*`** |
| [`CURSOR_SETUP_GUIDE.md`](CURSOR_SETUP_GUIDE.md) | Cursor-centric setup and troubleshooting |
| [`early-warning-system/docs/blockchain-ai/`](early-warning-system/docs/blockchain-ai/) | Optional Polygon on-chain logging |

Older “`/outputs`” or duplicate guides elsewhere may exist from packaging history; **`IMPLEMENTATION_SNAPSHOT.md`** wins when wording conflicts with the running code.

---

## ✅ What runs out of the box

- FastAPI backend, static **`/frontend`**, **`landing/`** pages, **`GET /documentation`**, **`GET /admin/dashboard`**
- Synthetic weekly health patterns (**`health_data_generator.py`**) unless you integrate DHIS2 or other feeds
- Air-quality resolver (**WeatherAPI → WAQI → Rapid**, per snapshot) plus supplementary weather routes where keys exist
- **`provenance`** / A2A-style hints on responses when integrations return data
- Regional/national demo mode flags in payloads
- Optional MongoDB enrollees, logs, broadcasts when **`MONGODB_URL`** (or **`DATABASE_URL`**) is set
- Optional Twilio / Resend when configured; **`NOTIFICATION_API_KEY`** protects operator notification JSON routes (and admin JSON under **`/api/admin/*`**)
- Blockchain helpers and optional gas-spend on Polygon — **off by default** (`docs/blockchain-ai/`)

---

## 📋 Repository layout (app tree)

```
early-warning-system/
├── backend/           ← main.py, admin_panel.py, notifications_api.py, …
├── landing/           ← landing.html, documentation.html, registration_portal.html, admin_dashboard.html
├── frontend/index.html
├── config/.env.example
├── docs/
├── docs-private/       ← Internal drafts — still in git; see README there
├── render.yaml
└── README.md
```

---

## ⚡ Smoke test (quick)

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/cases/week/Kathmandu
curl "http://127.0.0.1:8000/api/air-quality/current?city=Kathmandu"
```

---

## 📤 Deploy

1. Repo is already on GitHub: **mamta2009/aqinepal2026**. Fork or mirror to a **private** repo if you must exclude materials under **`docs-private/`** from publication.
2. Connect **Render** (or another host): run **`uvicorn`** from **`early-warning-system/backend`** with production env vars. See **`early-warning-system/render.yaml`** as a starting blueprint.
3. Hosting cost depends on provider and tiers — size the service to traffic and MongoDB separately.

---

## 🔧 Troubleshooting (short)

| Problem | Fix |
|---------|-----|
| “Module not found” | Activate **`backend/.venv`**; `pip install -r backend/requirements.txt` |
| Port **8000** in use | `python -m uvicorn main:app --reload --host 127.0.0.1 --port 8001` |
| Blank browser page | Use **`127.0.0.1`** or **`localhost`**, not **`0.0.0.0`** |
| CORS | Prefer **`http://127.0.0.1:8000/frontend/index.html`** (same origin as API) |
| Admin JSON **401** / **403** | Set **`NOTIFICATION_API_KEY`** in **`backend/.env`**; send **`Authorization: Bearer …`** |

---

## 🎯 Realistic demo data vs production

Weekly case curves are **synthetic WHO-style patterns** suitable to prove dashboards and alerting — **not** a substitute for ministry surveillance until you swap the pipeline. See **`IMPLEMENTATION_SNAPSHOT.md`** for what is keyed vs heuristic.

---

**Last aligned with docs:** May 2026 (repository **aqinepal2026**, branch **main**). Update this file if the canonical snapshot or URLs change.
