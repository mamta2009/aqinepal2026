# Early warning system (Nepal AQI demo)

FastAPI backend, static **landing**, **registration**, **documentation hub**, dashboard UI, and **operator admin console**. Technical behaviour (env keys, AQ resolver order, MongoDB, notifications, provenance JSON) is maintained in **`docs/IMPLEMENTATION_SNAPSHOT.md`** — prefer that file over older marketing summaries when describing what the deployment actually does.

**Repository:** [github.com/mamta2009/aqinepal2026](https://github.com/mamta2009/aqinepal2026)

---

## Setup (about 10 minutes)

### 1. Python dependencies

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment variables

Templates:

- **`backend/.env.example`** — primary template (Mongo, AQ keys, Twilio/Resend, admin keys)
- **`config/.env.example`** — optional second file; merged after `backend/.env` for unset keys only

```bash
cd backend
cp .env.example .env
# Optionally copy additional keys from ../config/.env.example into backend/.env
```

**Do not commit `backend/.env`.** Git ignores `.env`; use `.env.example` for placeholders only.

### 3. Run the API

```bash
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Use **`127.0.0.1`** or **`localhost`** in the browser ([`main.py`](backend/main.py) warns that `http://0.0.0.0:8000` often appears blank).

### 4. Main browser URLs

| Page | URL | Notes |
|------|-----|--------|
| Marketing landing | `http://127.0.0.1:8000/` | [`landing/landing.html`](landing/landing.html) |
| Documentation hub | `http://127.0.0.1:8000/documentation` | Diagrams + links; not full `docs/` tree |
| Registration | `http://127.0.0.1:8000/registration` | Public enrollee flow |
| Data dashboard UI | `http://127.0.0.1:8000/frontend/index.html` | AQ / cases / hooks to registration & docs |
| Operator admin | `http://127.0.0.1:8000/admin/dashboard` | Requires **`NOTIFICATION_API_KEY`** per request; PIN gate reads **`ADMIN_CONSOLE_PIN`** (or `REGISTRATION_DIRECTORY_SECRET`; dev fallback documented in code) |

- **Interactive API docs:** [`http://127.0.0.1:8000/docs`](http://127.0.0.1:8000/docs)
- **Route map:** [`http://127.0.0.1:8000/api/system-discovery`](http://127.0.0.1:8000/api/system-discovery)

Operator help copy on the dashboard points to **`/documentation`** for non-technical admins.

---

## Example API calls

### Air quality & weather

```bash
# Headline AQ (resolver order → IMPLEMENTATION_SNAPSHOT.md)
curl "http://127.0.0.1:8000/api/air-quality/current?city=Kathmandu"

curl "http://127.0.0.1:8000/api/weather/current?city=Kathmandu"

curl "http://127.0.0.1:8000/api/weather/openweather/current?city=Kathmandu"
```

Responses may include **`source`** and **`provenance`** (`deployment_role`, confidence tier, A2A hints).

### Core checks

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/cities
curl http://127.0.0.1:8000/api/deployment-status
```

### Synthetic health demos

```bash
curl http://127.0.0.1:8000/api/cases/week/Kathmandu
curl http://127.0.0.1:8000/api/cases/all-cities
```

Weekly patterns come from **`health_data_generator.py`** unless you plug in DHIS2 or another source.

---

## Project structure

```
early-warning-system/
├── backend/
│   ├── main.py                 # FastAPI app, mounts landing + docs + admin page
│   ├── admin_panel.py          # /api/admin/* operator JSON APIs
│   ├── notifications_api.py    # registration, alerts, webhooks (see snapshot)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── index.html              # Dashboard
├── config/
│   └── .env.example
├── docs/
│   ├── IMPLEMENTATION_SNAPSHOT.md   # Canonical behaviour reference
│   ├── tech/                        # Diagrams surfaced on /documentation
│   └── blockchain-ai/               # On-chain logging notes + ZIP mirrors
├── docs-private/               # Partner/internal drafts — verify claims vs snapshot
├── landing/                    # landing.html, registration_portal.html, admin_dashboard.html, assets
├── render.yaml                 # Render.com blueprint (optional)
└── README.md                   # This file
```

---

## Highlights

- **MongoDB-backed** enrollees and notification logs when `MONGODB_URL` / `DATABASE_URL` is set.
- **Multi-channel alerts** via Twilio (SMS/WhatsApp) and Resend (email) when keys are configured.
- **Blockchain hooks** optional (`POLYGON_*`); defaults keep on-chain spends off — see **`docs/blockchain-ai/README.md`**.
- **Regional demo cities** driven by **`backend/cities_config.py`** (Bagmati-area + configured extensions).
- **Deployment:** push to GitHub and connect **`render.yaml`** (or another host running `uvicorn`).

---

## Documentation index

| Document | Audience |
|---------|----------|
| [`docs/IMPLEMENTATION_SNAPSHOT.md`](docs/IMPLEMENTATION_SNAPSHOT.md) | Engineers / integrators — env, APIs, Mongo, AQ pipeline |
| [`docs/blockchain-ai/README.md`](docs/blockchain-ai/README.md) | Turning on Polygon logging safely |
| [`docs/blockchain-ai/INTEGRATION_GUIDE.md`](docs/blockchain-ai/INTEGRATION_GUIDE.md) | Historical step-by-step (sample code may differ from `main.py`; prefer snapshot routes) |
| [`docs-private/README.md`](docs-private/README.md) | How internal UNICEF drafts relate to runnable truth |
| [`landing/LANDING_PAGE_GUIDE.md`](landing/LANDING_PAGE_GUIDE.md) | Editing static pages |

---

## License

Specify a **`LICENSE`** file in this repository when you finalize distribution terms; until then assume **all rights reserved** unless otherwise stated elsewhere.
