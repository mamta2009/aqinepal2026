# Climate Compass

**Repository:** [github.com/mamta2009/aqinepal2026](https://github.com/mamta2009/aqinepal2026)

- **Guides:** [`docs/guides/`](docs/guides/)
- **API + static UI:** FastAPI in [`backend/`](backend/) — OpenAPI at `/docs`
- **Frontend source:** Next.js static export in [`frontend/`](frontend/)

## Architecture

1. Build the Next.js app as a static export (`frontend/out`).
2. Run FastAPI. It serves:
   - `/api/*` — JSON APIs
   - `/docs` — Swagger UI
   - `/`, `/dashboard/`, … — static files from `frontend/out`

Browser auth uses HttpOnly cookies on the FastAPI host (`cc_registrant_token`, `ew_admin_session`).

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

## Docker

```bash
docker compose up -d --build
```

The image builds the static export and serves it from FastAPI.
