# Climate Compass

**Climate Compass** is the Nepal air quality and respiratory readiness application in this repository: FastAPI APIs, Next.js static UI, Expo mobile app, public guides, registration / alerts, facility tools, and an operator admin console.

**Repository:** [github.com/mamta2009/aqinepal2026](https://github.com/mamta2009/aqinepal2026)

- **Guides:** [`docs/guides/`](docs/guides/) — start with [`APPLICATION_OVERVIEW.md`](docs/guides/APPLICATION_OVERVIEW.md) and [`IMPLEMENTATION_SNAPSHOT.md`](docs/guides/IMPLEMENTATION_SNAPSHOT.md)
- **API + static UI:** FastAPI in [`backend/`](backend/) — OpenAPI at `/docs`
- **Frontend source:** Next.js static export in [`frontend/`](frontend/)
- **Mobile:** Expo app in [`mobile-app/`](mobile-app/)

## Architecture

1. Build the Next.js app as a static export (`frontend/out`).
2. Run FastAPI. It serves:
   - `/api/*` — JSON APIs
   - `/docs` — Swagger UI
   - `/`, `/dashboard/`, … — static files from `frontend/out`

Browser auth uses HttpOnly cookies on the FastAPI host (`cc_registrant_token`, `ew_admin_session`).

### Air quality vs weather

| Concern            | Primary path                                             | Notes                                                           |
| ------------------ | -------------------------------------------------------- | --------------------------------------------------------------- |
| Headline air score | **WAQI** local stations (map/bounds median, then search) | Prefer reported **AQI**; do not treat WAQI `iaqi.pm25` as µg/m³ |
| Air fallback       | WeatherAPI.com, then RapidAPI                            | Model estimate when stations are unavailable                    |
| Heat / rain        | WeatherAPI.com (then RapidAPI)                           | Separate from headline AQ                                       |

Broken WAQI `/feed/` paths are skipped. Dashboard and mobile charts/compare/forecast seed from **PM2.5 when present, otherwise station AQI**.

## Quick start

```bash
# Terminal 1 — API (and UI once exported)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — build (or rebuild) the static UI
cd frontend
cp .env.example .env.local
npm install
npm run build
```

Then open `http://127.0.0.1:8000/`. Restart or reload uvicorn after the first build so it picks up `frontend/out`.

### Optional: Next.js dev server

```bash
cd frontend
# .env.local:
# NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
# NEXT_PUBLIC_SITE_URL=http://localhost:3000
npm run dev
```

### Optional: mobile app

```bash
cd mobile-app
cp .env.example .env   # if present; point API base at the FastAPI host
npm install
npx expo start
```

## Docker (backend only)

```bash
docker compose up -d --build
```

Docker builds and runs the FastAPI API only. Build the Next.js UI on the host (`cd frontend && npm run build`) or deploy it separately. To have the API container serve a host-built export, uncomment the `./frontend/out` volume in `docker-compose.yml` and set `FRONTEND_OUT_DIR=/app/frontend/out` in the compose environment.
