# Climate Compass

**Climate Compass** is Nepal’s air quality and respiratory readiness platform: FastAPI backend, Next.js **landing** and dashboard, Expo **mobile app**, **guides hub** (`/guides`), **registration** for alerts, facility tools, and an **operator admin console**.

Headline air uses **WAQI local stations first** (median nearby AQI), with WeatherAPI / RapidAPI as air fallback; WeatherAPI remains preferred for heat and rain. **How live data is fetched end-to-end:** **[`DATA_FETCHING.md`](DATA_FETCHING.md)**. Compact API/env truth: **[`IMPLEMENTATION_SNAPSHOT.md`](IMPLEMENTATION_SNAPSHOT.md)**.

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

Use **`127.0.0.1`** or **`localhost`** in the browser (`main.py` warns that `http://0.0.0.0:8000` often appears blank).

### 4. Main browser URLs

| Page | URL | Notes |
|------|-----|--------|
| Marketing landing | `http://127.0.0.1:8000/` | `landing/landing.html` |
| Guides hub (diagrams + links) | `http://127.0.0.1:8000/guides` | Public markdown is under **`/guides/md/…`** |
| Registration | `http://127.0.0.1:8000/registration` | Public enrollee flow |
| Data dashboard UI | `http://127.0.0.1:8000/frontend/index.html` | AQ / cases / hooks to registration |
| Operator admin | `http://127.0.0.1:8000/admin/dashboard` | Requires **`NOTIFICATION_API_KEY`**; PIN gate; **private markdown** viewer |

- **Interactive API docs:** [`http://127.0.0.1:8000/docs`](http://127.0.0.1:8000/docs)
- **Route map:** [`http://127.0.0.1:8000/api/system-discovery`](http://127.0.0.1:8000/api/system-discovery)

---

## Example API calls

### Air quality & weather

```bash
curl "http://127.0.0.1:8000/api/air-quality/current?city=Kathmandu"
curl http://127.0.0.1:8000/api/weather/current?city=Kathmandu
```

### Core checks

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/cities
```

---

## Repository layout — documentation

Public markdown is under **`early-warning-system/docs/guides/`**. Private partner drafts remain in **`early-warning-system/docs-private/`** (browse only via admin API / admin UI).

Diagrams (**SVG**) live in **`early-warning-system/docs/tech/`** (`/guides/media/tech/` on the wire).

See **[README.md](./README.md)** in this folder for a full guides index table. For live provider order and UI seeding, read **[DATA_FETCHING.md](./DATA_FETCHING.md)**.
