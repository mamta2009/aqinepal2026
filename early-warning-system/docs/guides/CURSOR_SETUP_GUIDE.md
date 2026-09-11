# Climate Compass — complete package guide (Cursor)

You can work from a **git clone** (recommended) or from an **`early-warning-system.zip`** extract. Both contain the same **Climate Compass** application tree under **`early-warning-system/`**.

**Public repository:** [https://github.com/mamta2009/aqinepal2026](https://github.com/mamta2009/aqinepal2026)  
**Technical truth:** [`IMPLEMENTATION_SNAPSHOT.md`](IMPLEMENTATION_SNAPSHOT.md) (APIs/env) and [`DATA_FETCHING.md`](DATA_FETCHING.md) (live air/heat/weather flow). Headline air is **WAQI-station-first** (WeatherAPI for heat/rain and air fallback).

---

## 📦 What's in `early-warning-system/`

```
early-warning-system/
├── backend/
│   ├── main.py                 ← FastAPI app; mounts /frontend, landing pages, /guides, /admin/dashboard
│   ├── admin_panel.py          ← Operator JSON APIs under /api/admin/*
│   ├── cities_config.py        ← CITIES_CONFIG (demo municipalities; AQ + registration)
│   ├── notification_auth.py    ← NOTIFICATION_API_KEY + Twilio webhook signature helpers
│   ├── notifications_api.py    ← Registration, broadcast, evaluate, webhooks, analytics
│   ├── twilio_notify.py        ← SMS / WhatsApp via Twilio
│   ├── db_state.py             ← Shared MongoDB handle
│   ├── requirements.txt
│   └── .env.example            ← Primary template; copy to backend/.env
├── landing/
│   ├── landing.html            ← GET /  (marketing landing)
│   ├── guides.html       ← GET /guides (diagrams hub; not full docs/ tree)
│   ├── registration_portal.html ← GET /registration
│   ├── admin_dashboard.html     ← GET /admin/dashboard (operator console; API key + PIN)
│   └── assets/
├── frontend/
│   └── index.html              ← Dashboard at /frontend/index.html
├── config/
│   └── .env.example            ← Optional second file; fills only unset vars after backend/.env
├── docs/
│   ├── guides/
│   │   ├── DATA_FETCHING.md          ← How live air/heat/weather is fetched
│   │   ├── IMPLEMENTATION_SNAPSHOT.md
│   │   ├── CURSOR_SETUP_GUIDE.md …
│   │   └── blockchain-ai/ …
│   ├── tech/                   ← Diagrams surfaced on /guides/media/tech/…
│   └── blockchain-ai/          ← Reference `.py` only (Markdown → `docs/guides/blockchain-ai/`)
├── docs-private/               ← Internal drafts — operator-only Markdown preview in `/admin/dashboard`
├── README.md
└── .gitignore
```

---

## 🚀 OPEN IN CURSOR (2 minutes)

### Step 1a: Clone from GitHub (recommended)
```bash
git clone https://github.com/mamta2009/aqinepal2026.git
cd aqinepal2026/early-warning-system   # or open repo root and cd into early-warning-system/
```

### Step 1b: Or extract ZIP
```bash
unzip early-warning-system.zip
cd early-warning-system
```

### Step 2: Open in Cursor
```bash
cursor .
# File → Open Folder → select the folder that contains backend/ and landing/
```

### Step 3: Cursor sees (typical)
```
📁 early-warning-system
  📁 backend
    📄 main.py, admin_panel.py, notifications_api.py …
    📄 requirements.txt, .env.example
  📁 landing
    📄 landing.html, guides.html, registration_portal.html, admin_dashboard.html
  📁 frontend
    📄 index.html
  📁 config
    📄 .env.example
  📁 docs …
  📄 README.md
```

---

## ⚡ QUICK START IN CURSOR

### 1. Open Terminal in Cursor
```
Cursor Menu → Terminal → New Terminal
```

### 2. Install Dependencies
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Use **Python 3.10+** (3.12 OK). If `pip install` fails, upgrade pip: `pip install -U pip`.

**Important:** `requirements.txt` lives in **`early-warning-system/backend/`**, not the repo root. If you run `pip install -r requirements.txt` from `Project_1_aqi/` you will get “file not found.” Prefer the **project venv** (`backend/.venv`) so other global packages (for example `google-genai`) do not conflict with pinned versions.

After install, keep using the same interpreter for the API: `backend/.venv/bin/python` or activate the venv before `uvicorn`.

### 3. Setup Environment
```bash
cd ../backend
cp .env.example .env
# Edit .env with your keys. Optional: also copy ../config/.env.example → ../config/.env
# (backend/.env loads first; config/.env fills only unset variables.)
```

**Template files:** **`backend/.env.example`** (backend-centric keys + notifications security/automation) and **`config/.env.example`** (broader integration list). Keep them in sync with **`docs/guides/IMPLEMENTATION_SNAPSHOT.md`** when adding env vars.

**Blockchain (optional but real):**

- `POLYGON_RPC_URL` — public read-only endpoint (default `https://polygon-rpc.com`). Used for `/api/blockchain/status` connectivity (no gas).
- `POLYGON_PRIVATE_KEY` — if set to a **real** dev key (not the placeholder), weekly case responses get an **EIP-191 signature** over the content hash (EVM / Polygon-compatible). Never commit real keys.

**Notifications (optional; needs MongoDB for persistence):**

- **`MONGODB_URL`** — must point at a real MongoDB (local or Atlas). Contact registration, logs, and broadcast recipient lists use database **`early_warning`** collections (`contacts`, `notification_logs`, `inbound_messages`, `consent_records`, `alert_broadcasts`, `alert_evaluation_cooldown`). Daily case reports stay in `respiratory_daily_reports`.
- **Twilio** — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. Optional: `TWILIO_MESSAGE_CHANNEL` (`sms` or `whatsapp`), `TWILIO_WHATSAPP_SANDBOX`, `TWILIO_WHATSAPP_USE_SANDBOX`, `ENVIRONMENT` (sandbox-style WhatsApp uses the sandbox “From” number unless overridden). For signed webhooks: **`TWILIO_WEBHOOK_VALIDATE=true`** (uses **`TWILIO_AUTH_TOKEN`**) and set **`TWILIO_WEBHOOK_PUBLIC_URL`** to the exact public URL Twilio POSTs to if the app is behind a proxy (e.g. `https://your-host.example/api/webhooks/sms`).
- **Resend (email)** — `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (verification and email alerts). If unset, registration still works; email verification is skipped with a warning in the JSON response.
- **`NOTIFICATION_DASHBOARD_URL`** — link text in broadcast messages.
- **`NOTIFICATION_API_KEY`** — if set, admin notification routes require **`Authorization: Bearer <key>`** or **`X-API-Key`**. Public: register, verify, webhook POSTs, `GET /registration`, WhatsApp sandbox info.
- **AQ evaluate / automation** — **`ALERT_EVAL_COOLDOWN_MINUTES`** (default ~60; Mongo-backed dedupe per city for **`POST /api/alerts/evaluate`**). **Daily surge** — **`DAILY_REPORT_NOTIFY_ENABLED`**, **`DAILY_SPIKE_CASE_MULTIPLIER`** (default 1.5), **`DAILY_SPIKE_MIN_PRIOR_REPORTS`** (minimum prior rows for a baseline average).

Quick URLs (same origin as API): **`http://127.0.0.1:8000/frontend/index.html`**, **`http://127.0.0.1:8000/registration`** (→ **`POST /api/contacts/register`**), **`http://127.0.0.1:8000/guides`**, **`http://127.0.0.1:8000/admin/dashboard`**. See **Notifications** below for API routes.

### 4. Run Backend
```bash
cd ../backend
source .venv/bin/activate   # if not already

# Recommended (explicit host; avoids blank page if you paste 0.0.0.0 into the browser)
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Or: python main.py  (if your tree still wires this to uvicorn)
```

The server serves the API and static mounts. Use **`http://127.0.0.1:8000`** (or **`http://localhost:8000`**) in the browser — **`http://0.0.0.0:8000` often shows a blank page.**

### 5. Open the app (same origin)
| What | URL |
|------|-----|
| Marketing landing | `http://127.0.0.1:8000/` |
| Guides hub | `http://127.0.0.1:8000/guides` |
| Registration | `http://127.0.0.1:8000/registration` |
| Data dashboard | `http://127.0.0.1:8000/frontend/index.html` |
| Operator admin | `http://127.0.0.1:8000/admin/dashboard` (needs **`NOTIFICATION_API_KEY`** + PIN; see **`docs/guides/IMPLEMENTATION_SNAPSHOT.md`** → *Operator admin*) |
| OpenAPI | `http://127.0.0.1:8000/docs` |
| Route map | `http://127.0.0.1:8000/api/system-discovery` |

Opening `frontend/index.html` as `file://` may still call the API if the dashboard falls back to `localhost:8000` — prefer URLs above.

---

## 📝 FILE-BY-FILE BREAKDOWN

### backend/main.py
```python
# FastAPI application with:
✅ Health check + case endpoints
✅ Realistic WHO-pattern case generator
✅ Static mount: /frontend → ../frontend (dashboard URL below)
✅ blockchain_integration.py — SHA-256 payload anchoring + optional EIP-191 signing
✅ GET /api/blockchain/status — Polygon RPC ping (read-only, no transactions)
✅ MongoDB for persistence when MONGODB_URL is set (daily reports + notification registry DB)
✅ notifications_api router — registration, broadcast, analytics, Twilio webhooks (see below)

# Run:
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
# → http://127.0.0.1:8000  (API + /frontend + landing + /guides + /admin/dashboard)
```

### Notifications stack (`notifications_api.py`, `twilio_notify.py`, `db_state.py`)

When **`MONGODB_URL`** is configured, startup ensures indexes for contact registration and notification logs. Twilio and Resend are optional; configure only the channels you use.

**Diagram (code-aligned):** [`early-warning-system/docs/tech/NOTIFICATION_FLOW_DIAGRAM.svg`](early-warning-system/docs/tech/NOTIFICATION_FLOW_DIAGRAM.svg) — also embedded on **`/guides`** (*Notification & alert flow*). **Evaluate:** **`POST /api/alerts/evaluate`** pulls live AQ for a **`CITIES_CONFIG`** city and broadcasts when **`min_level`** and cooldown allow (cron-friendly). **Alternate:** your job may call **`/api/air-quality/current`** and then **`POST /api/alerts/broadcast`**. **Daily cases:** optional spike→broadcast after **`POST /api/health/cases/daily-report`** when daily surge env vars are enabled (see **Notifications** env bullets).

**Representative routes** (when **`NOTIFICATION_API_KEY`** is set, routes marked 🔒 require Bearer or `X-API-Key`):

| Purpose | Method / path |
|--------|-----------------|
| Registration UI | `GET /registration` |
| Register contact | `POST /api/contacts/register` |
| Verify code | `POST /api/contacts/verify` |
| List / get / update contacts | 🔒 `GET /api/contacts`, 🔒 `GET /api/contacts/{id}`, 🔒 `PUT /api/contacts/{id}/preferences` |
| Send to one contact | 🔒 `POST /api/notifications/send` |
| Broadcast alert | 🔒 `POST /api/alerts/broadcast` |
| Evaluate AQ → broadcast | 🔒 `POST /api/alerts/evaluate` (body: `city`, optional `recipient_type`, `filter_city`, `min_level`, `force`) |
| Twilio test | 🔒 `POST /api/notifications/twilio/test` (body may include `channel`: `sms` or `whatsapp`) |
| WhatsApp sandbox help | `GET /api/notifications/whatsapp/sandbox-info` |
| Inbound / status webhooks | `POST /api/webhooks/sms`, `POST /api/webhooks/whatsapp`, `POST /api/webhooks/message-status` |
| Analytics | 🔒 `GET /api/analytics/notifications`, 🔒 `GET /api/analytics/contacts` |

**`GET /api/health`** includes `notification_registry: true` when the full Mongo database handle is active. **`GET /api/runtime-config`** includes `integrations.resend_configured` and existing integration flags.

Point **Twilio** webhook URLs at your public API host + these paths when testing inbound SMS/WhatsApp from a tunnel (for example ngrok).

### backend/blockchain_integration.py
```python
# Used by main.py:
✅ Canonical JSON → SHA-256 content hash on case payloads
✅ Optional signature if POLYGON_PRIVATE_KEY is configured
✅ Optional Web3 RPC ping (POLYGON_RPC_URL)
# On-chain contract anchoring is a separate step when you deploy a contract.
```

### frontend/index.html
```html
<!-- Dashboard:
✅ API_BASE from GET /api/runtime-config (PUBLIC_API_ORIGIN / API_PATH_PREFIX when set)
✅ Header links: /registration (Register for alerts), /guides
✅ Weekly respiratory bar chart: GET /api/cases/week/{city}
✅ Footer Chain line from GET /api/blockchain/status + last payload verification
✅ AQ card + compare: GET /api/air-quality/current (server resolver: WAQI stations → WeatherAPI → Rapid)
✅ provenance on JSON: deployment_role + confidence tier for tooling / agents

If you deploy elsewhere, open via that host so runtime-config resolves correctly.
```

### config/.env.example
```
Copy to config/.env. Key integrations (see docs/guides/IMPLEMENTATION_SNAPSHOT.md for full resolver order):

- WAQI_TOKEN — WAQI / aqicn (primary headline air via map/bounds + search)
- WEATHERAPI_COM_API_KEY — preferred for heat/rain (/api/weather/current); air fallback after WAQI
- RAPIDAPI_WEATHER_* — Rapid marketplace weather/air fallback + related products
- OPENWEATHER_API_KEY — supplementary OWM routes only (/api/weather/openweather/…)
- OPENROUTER_API_KEY — POST /api/ai/openrouter
- DEPLOYMENT_MODE — REGIONAL default (surfaced in API payloads)
- MONGODB_URL — required for persisted daily reports and the notification registry (contacts, logs, broadcasts, alert_evaluation_cooldown)
- TWILIO_* / RESEND_* — optional; see “Notifications” env bullets in Setup Environment above
- NOTIFICATION_API_KEY / TWILIO_WEBHOOK_* / ALERT_EVAL_* / DAILY_* — optional automation & security (see IMPLEMENTATION_SNAPSHOT.md Notifications section)
MongoDB/DHIS2/Polygon vars as documented in .env.example
```

### README.md
```
Quick start instructions
Project structure
Next steps

See also: docs/guides/IMPLEMENTATION_SNAPSHOT.md (technical contract for demos)
```

---

## 🔧 USING CURSOR'S FEATURES

### Cursor Tools You'll Use:

**1. Edit main.py**
- Right-click → "Edit with AI" to modify endpoints
- Ask: "Add MongoDB connection to main.py"
- Ask: "Add blockchain verification to health endpoints"

**2. Edit index.html**
- Right-click → "Edit with AI" to modify dashboard
- Ask: "Connect dashboard to real API endpoints"
- Ask: "Add dark mode toggle"

**3. Terminal**
- Run: `python main.py`
- Test: `curl http://localhost:8000/api/health`

**4. File Compare**
- Right-click file → "Compare with..." to see what changed

---

## 📊 TEST THE SYSTEM (5 minutes)

### 1. Start Backend
```bash
# In Cursor Terminal
python main.py

# Should see:
# INFO:     Uvicorn running on http://127.0.0.1:8000
# INFO:     Application startup complete
```

### 2. Test API Endpoints
```bash
# Open new terminal tab

# Health check
curl http://localhost:8000/api/health

# Get cases for Kathmandu
curl http://localhost:8000/api/cases/week/Kathmandu

# Get all cities
curl http://localhost:8000/api/cases/all-cities

# Blockchain / RPC + signing readiness
curl http://localhost:8000/api/blockchain/status

# Integration flags + AQ/weather posture (integrations.* on JSON)
curl http://localhost:8000/api/runtime-config

# Resolved air quality (shows source + provenance when keys are set)
curl "http://localhost:8000/api/air-quality/current?city=Kathmandu"

# All should return JSON when the backend is up and keys/quota permit upstream calls.

# Notifications (MongoDB must be configured for registry features)
curl http://localhost:8000/api/health   # check notification_registry + mongodb_persistence
curl http://localhost:8000/api/notifications/whatsapp/sandbox-info
```

### 3. Open Dashboard
```
Browser: http://localhost:8000/frontend/index.html

You should see:
- City selector (8 cities); cases chart filled from the API
- Footer: data status (cases + AQ source/confidence snippet) and blockchain / anchor line (expand tooltip for JSON)
- AQ from live resolver when configured (WAQI-station-first); compare table staggers requests (~0.65s) to ease Rapid quota
```

---

## ✅ SUCCESS CHECKLIST

- [ ] Repo cloned **or** ZIP extracted (`early-warning-system/` as app root)
- [ ] Opened in Cursor
- [ ] Backend venv + `pip install -r requirements.txt`
- [ ] `uvicorn` running (no startup errors), browser uses **`127.0.0.1:8000`** (not **`0.0.0.0`**)
- [ ] API endpoints responding (`/api/health`, etc.)
- [ ] **`http://127.0.0.1:8000/frontend/index.html`** — dashboard loading
- [ ] Landing **`/`** or registration **`/registration`** if you test enrolment
- [ ] City selector working; charts show weekly cases
- [ ] (Optional) MongoDB + **`MONGODB_URL`** → `notification_registry: true` on **`/api/health`**
- [ ] (Optional) **`http://127.0.0.1:8000/guides`** — diagram hub  
- [ ] (Optional) **`http://127.0.0.1:8000/admin/dashboard`** — **`NOTIFICATION_API_KEY`** + PIN (see **`docs/guides/IMPLEMENTATION_SNAPSHOT.md`**)
- [ ] (Optional) Twilio / Resend keys for SMS, WhatsApp, or email flows

---

## 🎯 NEXT STEPS IN CURSOR

### Option 1: Deploy to Render (30 minutes)
The application source already lives at **[github.com/mamta2009/aqinepal2026](https://github.com/mamta2009/aqinepal2026)**. For a fresh machine: clone, set env on the host, deploy `early-warning-system/backend` with `uvicorn` (see **`render.yaml`** in the repo).

```bash
git clone https://github.com/mamta2009/aqinepal2026.git
cd aqinepal2026
# Configure Render (or another host) to run from early-warning-system with your .env secrets
```

Fork or create a **private** repo copy if you must not publish `docs-private/` or other materials — then point Render at that remote instead.

### Option 2: Modify & Enhance (1-2 hours)
```
In Cursor, ask AI to:
- "Add MongoDB integration to main.py"
- "Add real DHIS2 API connection"
- "Improve dashboard styling"
- "Add blockchain verification"
- "Add AI prediction models"
- "Wire automated alerts from air-quality thresholds to /api/alerts/broadcast"
```

### Option 3: Add Real Data (Tomorrow)
```
Contact health ministry
Get real DHIS2 data
Update endpoint
Replace synthetic data
```

---

## 🛠️ CURSOR AI PROMPTS

### For main.py:
```
"Add a new endpoint that integrates with MongoDB
to store respiratory case reports"

"Add blockchain verification to the health 
endpoints using the blockchain_integration module"

"Create an endpoint that pulls data from DHIS2
API and stores in MongoDB"

"After AQI exceeds a threshold, call POST /api/alerts/broadcast
with the right city and alert level"
```

### For index.html:
```
"Update the API_BASE constant to use 
environment variables instead of hardcoding"

"Add a dark mode toggle to the settings panel"

"Improve the mobile responsiveness of the 
geographic selector"
```

### For new files:
```
"Create a health_data_generator.py module with
realistic respiratory case patterns"

"Create a blockchain_integration.py module for
Polygon verification"

"Create an ai_models.py with respiratory 
case prediction models"
```

---

## 📞 TROUBLESHOOTING

### Issue: "Module not found"
```bash
pip install -r requirements.txt
```

### Issue: `pkg_resources` / `web3` import error
```bash
# web3 6.x needs setuptools that still includes pkg_resources (<82)
pip install -r requirements.txt
```

### Issue: "Port 8000 already in use"
```bash
# Use different port
python -m uvicorn main:app --reload --port 8001
```

### Issue: "CORS error in dashboard"
```
Prefer http://127.0.0.1:8000/frontend/index.html (same origin = no CORS for API)
Opening from file:// may call http://localhost:8000 for API; ensure the backend is up and CORS middleware is on (it is)
```

### Issue: "No data showing in charts"
```
Weekly case bars require a successful GET /api/cases/week/{city}
Open DevTools → Network; fix CORS or wrong API host
Ensure you are not running two servers on port 8000
```

### Issue: "Blockchain shows RPC offline"
```
Normal in restricted networks — anchoring (hash) still works; only the public RPC ping failed
Set POLYGON_RPC_URL to a reachable endpoint or ignore for local demos
```

### Issue: `Could not open requirements file`
```
Run pip from early-warning-system/backend/ or pass the full path:
  pip install -r early-warning-system/backend/requirements.txt
```

### Issue: pip “dependency conflicts” with `google-genai` / `fastapi-mail`
```
Those packages are usually installed outside this project. Use backend/.venv only for this app
so pins (anyio, httpx, fastapi) do not clash with unrelated tools.
```

### Issue: Notification routes return 503 “MongoDB not configured”
```
Set MONGODB_URL in backend/.env (or config/.env). Start mongod locally or use Atlas.
Restart the API after changing env.
```

### Issue: WhatsApp test messages fail from Twilio
```
Join the Twilio WhatsApp sandbox from your phone first; use GET /api/notifications/whatsapp/sandbox-info.
For production, use an approved WhatsApp sender and review Twilio/template requirements.
```

---

## 🚀 YOU'RE READY!

**Clone** [aqinepal2026](https://github.com/mamta2009/aqinepal2026) (or extract the ZIP) → Open `early-warning-system/` in Cursor → install deps → Run `uvicorn` → Open the URLs in the table above.

1. Clone or extract  
2. Open in Cursor  
3. `pip install -r backend/requirements.txt` (from a venv in `backend/`)  
4. `python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000` from `backend/`  
5. Open **`http://127.0.0.1:8000/`** or the dashboard/guides links  

From there, you can:
- Deploy via Render (see **`early-warning-system/render.yaml`**) or another **`uvicorn` host — point it at **`github.com/mamta2009/aqinepal2026`**
- Modify with Cursor's AI
- Add real data when ready
- Show UNICEF a working system

---

## 📁 FILE LOCATIONS

```
📥 Source: git clone https://github.com/mamta2009/aqinepal2026.git (or early-warning-system.zip)
📂 App root: aqinepal2026/early-warning-system/ (or unzip folder)
🎯 Open: Cursor → that folder (contains backend/, landing/, frontend/)
▶️ Run: cd backend && source .venv/bin/activate && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
🌐 Landing:    http://127.0.0.1:8000/
📖 Docs hub:    http://127.0.0.1:8000/guides
📝 Register:   http://127.0.0.1:8000/registration
📊 Dashboard:  http://127.0.0.1:8000/frontend/index.html
🔧 Admin:      http://127.0.0.1:8000/admin/dashboard
📤 Deploy:      Render (see early-warning-system/render.yaml) or any uvicorn-capable host
```

---

## ⏱️ TIMELINE

- **Right now**: Clone or unzip; open **`early-warning-system/`** in Cursor (~2 min)
- **Next 5 min**: Run backend, test API
- **Next 5 min**: Open dashboard, verify it works
- **Next 30 min**: (Optional) Deploy to Render
- **Today**: Working system ready
- **This week**: Get real health data
- **Next week**: Show UNICEF

---

## FINAL CHECKLIST

- ✅ Repo cloned or ZIP extracted (`early-warning-system/` visible)
- ✅ `backend/.venv` + `pip install -r requirements.txt`
- ✅ `backend/.env` from `.env.example` (never commit `.env`)
- ✅ `uvicorn` running on `127.0.0.1:8000`
- ✅ Landing / documentation / registration / dashboard reachable in browser
- ✅ (Optional) `NOTIFICATION_API_KEY` + MongoDB → `/admin/dashboard` + registry features

**You're all set.** 🚀
