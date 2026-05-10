# 🎯 COMPLETE PACKAGE GUIDE - Use in Cursor Code

You now have `early-warning-system.zip` with everything ready to go.

**Technical truth (API resolver, env vars, provenance/A2A, notifications):** keep [`early-warning-system/docs/IMPLEMENTATION_SNAPSHOT.md`](early-warning-system/docs/IMPLEMENTATION_SNAPSHOT.md) updated when wiring integrations.

---

## 📦 What's Inside the ZIP

```
early-warning-system/
├── backend/
│   ├── main.py                 ← FastAPI application (READY TO USE)
│   ├── cities_config.py        ← CITIES_CONFIG (8 demo municipalities; AQ + registration)
│   ├── notification_auth.py    ← Optional NOTIFICATION_API_KEY + Twilio webhook signature
│   ├── notifications_api.py ← Registration, broadcast, evaluate, Twilio webhooks, analytics
│   ├── twilio_notify.py       ← SMS / WhatsApp via Twilio (sandbox + production From)
│   ├── db_state.py            ← Shared MongoDB handle for notification collections
│   ├── requirements.txt       ← Python dependencies (install from this directory)
│   └── .env.example           ← Template; copy to .env (see Setup Environment)
├── landing/
│   └── registration_portal.html ← Optional: health-worker signup UI (/registration)
├── frontend/
│   └── index.html              ← Dashboard (READY TO USE)
├── config/
│   └── .env.example            ← Environment setup
├── README.md                   ← Quick start guide
├── .gitignore                  ← Git ignore rules
└── docs/                       ← (Documentation folder)
```

---

## 🚀 OPEN IN CURSOR (2 minutes)

### Step 1: Extract ZIP
```bash
# On Mac/Linux
unzip early-warning-system.zip
cd early-warning-system

# On Windows
# Double-click the ZIP file to extract
# Open the folder
```

### Step 2: Open in Cursor
```bash
# Option A: From command line
cursor .

# Option B: In Cursor
# File → Open Folder → Select early-warning-system
```

### Step 3: Cursor sees:
```
📁 early-warning-system (at root)
  📁 backend
    📄 main.py              ← Open this file
    📄 notifications_api.py  ← Alerts / contacts / webhooks
    📄 requirements.txt
  📁 landing
    📄 registration_portal.html  ← GET /registration
  📁 frontend
    📄 index.html          ← Open this file
  📁 config
    📄 .env.example        ← Copy to .env
  📄 README.md             ← Read this first
  📄 .gitignore
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

**Template files:** **`backend/.env.example`** (backend-centric keys + notifications security/automation) and **`config/.env.example`** (broader integration list). Keep them in sync with **`docs/IMPLEMENTATION_SNAPSHOT.md`** when adding env vars.

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

Quick URLs (same origin as API): **`http://localhost:8000/frontend/index.html`** (dashboard → **Register for alerts** → **`/registration`**) and **`http://localhost:8000/registration`** (form → **`POST /api/contacts/register`**). See **Notifications** section below for routes.

### 4. Run Backend
```bash
cd ../backend
source .venv/bin/activate   # if not already
python main.py

# Or with auto-reload:
python -m uvicorn main:app --reload
```

The server serves both the API and static files: open the dashboard at **`http://localhost:8000/frontend/index.html`** so the UI and API share the same origin (recommended). Opening `frontend/index.html` as a `file://` URL still falls back to `http://localhost:8000` for API calls.

### 5. Open Dashboard
```
Preferred (same origin): http://localhost:8000/frontend/index.html
Alternative: open frontend/index.html from disk (API still targets localhost:8000)
```

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
python main.py
# → http://localhost:8000  (API + /frontend)
```

### Notifications stack (`notifications_api.py`, `twilio_notify.py`, `db_state.py`)

When **`MONGODB_URL`** is configured, startup ensures indexes for contact registration and notification logs. Twilio and Resend are optional; configure only the channels you use.

**Diagram (code-aligned):** [`early-warning-system/docs/tech/NOTIFICATION_FLOW_DIAGRAM.svg`](early-warning-system/docs/tech/NOTIFICATION_FLOW_DIAGRAM.svg) — also embedded on **`/documentation`** (*Notification & alert flow*). **Evaluate:** **`POST /api/alerts/evaluate`** pulls live AQ for a **`CITIES_CONFIG`** city and broadcasts when **`min_level`** and cooldown allow (cron-friendly). **Alternate:** your job may call **`/api/air-quality/current`** and then **`POST /api/alerts/broadcast`**. **Daily cases:** optional spike→broadcast after **`POST /api/health/cases/daily-report`** when daily surge env vars are enabled (see **Notifications** env bullets).

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
✅ Header links: /registration (Register for alerts), /documentation
✅ Weekly respiratory bar chart: GET /api/cases/week/{city}
✅ Footer Chain line from GET /api/blockchain/status + last payload verification
✅ AQ card + compare: GET /api/air-quality/current (server resolver: WeatherAPI → WAQI → Rapid)
✅ provenance on JSON: deployment_role + confidence tier for tooling / agents

If you deploy elsewhere, open via that host so runtime-config resolves correctly.
```

### config/.env.example
```
Copy to config/.env. Key integrations (see docs/IMPLEMENTATION_SNAPSHOT.md for full resolver order):

- WEATHERAPI_COM_API_KEY — direct WeatherAPI.com (preferred for AQ + /api/weather/current)
- WAQI_TOKEN — WAQI / aqicn (AQ fallback)
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

See also: docs/IMPLEMENTATION_SNAPSHOT.md (technical contract for demos)
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
- AQ from live resolver when configured (WeatherAPI-first); compare table staggers requests (~0.65s) to ease Rapid quota
```

---

## ✅ SUCCESS CHECKLIST

- [ ] ZIP extracted
- [ ] Opened in Cursor
- [ ] Backend dependencies installed
- [ ] main.py running (no errors)
- [ ] API endpoints responding
- [ ] Dashboard loading
- [ ] City selector working
- [ ] Data showing in charts
- [ ] (Optional) MongoDB running and `MONGODB_URL` set — `notification_registry: true` on `/api/health`
- [ ] (Optional) Twilio/Resend keys set if testing SMS, WhatsApp, or email flows

---

## 🎯 NEXT STEPS IN CURSOR

### Option 1: Deploy to Render (30 minutes)
```bash
# In Cursor Terminal

# 1. Initialize git
git init
git add .
git commit -m "Initial commit"

# 2. Create GitHub repo
# Go to github.com, create repo
# Add remote

git remote add origin https://github.com/username/early-warning-system
git branch -M main
git push -u origin main

# 3. Connect to Render
# Go to render.com
# New Web Service
# Connect GitHub repo
# Deploy!
```

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
Prefer http://localhost:8000/frontend/index.html (same origin = no CORS for API)
Opening from file:// uses http://localhost:8000 for API; ensure CORS middleware is on (it is)
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

Download the ZIP → Extract → Open in Cursor → Run → See it work

Everything is pre-built. You just need to:
1. Extract
2. Open in Cursor  
3. Run `python main.py`
4. Open dashboard in browser
5. Done!

From there, you can:
- Deploy to Render (automatic)
- Modify with Cursor's AI
- Add real data when ready
- Show UNICEF a working system

---

## 📁 FILE LOCATIONS

```
📥 Download: early-warning-system.zip (16KB)
📂 Extract: early-warning-system/ folder
🎯 Open: In Cursor as a workspace
▶️ Run: python backend/main.py
🌐 View: http://localhost:8000/frontend/index.html  
Register UI: http://localhost:8000/registration (when `landing/registration_portal.html` is present)  
📤 Deploy: git push → Render auto-deploys
```

---

## ⏱️ TIMELINE

- **Right now**: Extract and open in Cursor (2 min)
- **Next 5 min**: Run backend, test API
- **Next 5 min**: Open dashboard, verify it works
- **Next 30 min**: (Optional) Deploy to Render
- **Today**: Working system ready
- **This week**: Get real health data
- **Next week**: Show UNICEF

---

## FINAL CHECKLIST

- ✅ ZIP downloaded: early-warning-system.zip
- ✅ Everything inside: backend, frontend, config
- ✅ Ready to open: In Cursor or any editor
- ✅ Ready to run: `python main.py`
- ✅ Ready to deploy: Push to GitHub → Render auto-deploys
- ✅ Ready to show: Working system today

**You're all set. Extract the ZIP and let's go!** 🚀
