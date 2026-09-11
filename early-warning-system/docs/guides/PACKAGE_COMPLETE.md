# Climate Compass — package summary

## What you have

### Source code (GitHub — recommended)

**Repository:** [https://github.com/mamta2009/aqinepal2026](https://github.com/mamta2009/aqinepal2026)

**Product:** **Climate Compass** — Nepal air quality and respiratory readiness (WAQI-first station AQI, heat/rain via WeatherAPI, alerts, guides, admin).

```bash
git clone https://github.com/mamta2009/aqinepal2026.git
cd aqinepal2026/early-warning-system
```

Documentation for behaviour and APIs: **[`IMPLEMENTATION_SNAPSHOT.md`](IMPLEMENTATION_SNAPSHOT.md)** (this folder).  
Hands-on Cursor walkthrough: **[`CURSOR_SETUP_GUIDE.md`](CURSOR_SETUP_GUIDE.md)** — same **`/guides`** URLs as the running site.

### Optional ZIP delivery

An **`early-warning-system.zip`** (if someone shared one) mirrors the **`early-warning-system/`** folder: backend, **`landing/`** (marketing **`/guides`** via **`guides.html`**, **`/registration`**, **`/admin/dashboard`**), **`frontend/`**, **`config/`**, **`docs/`** (guides under **`docs/guides/`**).

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

| Page              | URL                                         |
| ----------------- | ------------------------------------------- |
| Marketing landing | `http://127.0.0.1:8000/`                    |
| Guides hub        | `http://127.0.0.1:8000/guides`              |
| Registration      | `http://127.0.0.1:8000/registration`        |
| Dashboard         | `http://127.0.0.1:8000/frontend/index.html` |
| Operator admin    | `http://127.0.0.1:8000/admin/dashboard`     |
| OpenAPI           | `http://127.0.0.1:8000/docs`                |

---

## 📚 Documentation index (in-repo)

| File                                                       | Purpose                                                                     |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| [`README.md`](../../../README.md)                          | Repository root — points into `early-warning-system/`                       |
| [`../../README.md`](../../README.md)                       | App **`early-warning-system/README.md`** stub (links here)                  |
| [`IMPLEMENTATION_SNAPSHOT.md`](IMPLEMENTATION_SNAPSHOT.md) | Canonical APIs, env, Mongo, AQ resolver, **`/api/admin/*`**                 |
| [`CURSOR_SETUP_GUIDE.md`](CURSOR_SETUP_GUIDE.md)           | Cursor-centric setup                                                        |
| [`README.md`](README.md)                                   | **Guides index** — lists every **`docs/guides/*.md`** topic                 |
| [`blockchain-ai/README.md`](blockchain-ai/README.md)       | Polygon / on-chain Markdown (companion **`docs/blockchain-ai/*.py`** stubs) |
| [`../blockchain-ai/README.md`](../blockchain-ai/README.md) | Short pointer from **`docs/blockchain-ai/`** into this folder               |

Older “`/outputs`” or duplicate guides elsewhere may exist from packaging history; **`IMPLEMENTATION_SNAPSHOT.md`** wins when wording conflicts with the running code.

---

## ✅ What runs out of the box

- FastAPI backend, static **`/frontend`**, **`landing/`** pages, **`GET /guides`**, **`GET /admin/dashboard`**
- Synthetic weekly health patterns (**`health_data_generator.py`**) unless you integrate DHIS2 or other feeds
- Air-quality resolver (**WAQI stations → WeatherAPI → Rapid**, per snapshot) plus WeatherAPI-first heat/rain routes where keys exist
- **`provenance`** / A2A-style hints on responses when integrations return data
- Regional/national demo mode flags in payloads
- Optional MongoDB enrollees, logs, broadcasts when **`MONGODB_URL`** (or **`DATABASE_URL`**) is set
- Optional Twilio / Resend when configured; **`NOTIFICATION_API_KEY`** protects operator notification JSON routes (and admin JSON under **`/api/admin/*`**)
- Blockchain helpers and optional gas-spend on Polygon — **off by default**; product wiring in **`backend/onchain_hooks.py`**, operator audit in Mongo **`onchain_anchor_log`** (`docs/guides/blockchain-ai/README.md`)

---

## 📋 Repository layout (app tree)

```
early-warning-system/
├── backend/           ← main.py, admin_panel.py, notifications_api.py, …
├── landing/           ← landing.html, guides.html, registration_portal.html, admin_dashboard.html
├── frontend/index.html
├── config/.env.example
├── docs/
│   ├── guides/                    ← Every public Markdown file + `/guides/md/…` rendering
│   ├── tech/*.svg                 ← Architectural diagrams (/guides/media/tech/…)
│   └── blockchain-ai/             ← Reference Python only (guides live under docs/guides/blockchain-ai/)
├── docs-private/                  ← Internal markdown — `/admin/dashboard` → Private documentation
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

| Problem                      | Fix                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| “Module not found”           | Activate **`backend/.venv`**; `pip install -r backend/requirements.txt`                  |
| Port **8000** in use         | `python -m uvicorn main:app --reload --host 127.0.0.1 --port 8001`                       |
| Blank browser page           | Use **`127.0.0.1`** or **`localhost`**, not **`0.0.0.0`**                                |
| CORS                         | Prefer **`http://127.0.0.1:8000/frontend/index.html`** (same origin as API)              |
| Admin JSON **401** / **403** | Set **`NOTIFICATION_API_KEY`** in **`backend/.env`**; send **`Authorization: Bearer …`** |

---

## 🎯 Realistic demo data vs production

Weekly case curves are **synthetic WHO-style patterns** suitable to prove dashboards and alerting — **not** a substitute for ministry surveillance until you swap the pipeline. See **`IMPLEMENTATION_SNAPSHOT.md`** for what is keyed vs heuristic.

---

**Last aligned with docs:** Sep 2026 (repository **aqinepal2026**, product name **Climate Compass**, branch **main**). Update this file if the canonical snapshot or URLs change.
