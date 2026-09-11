# Climate Compass

**Climate Compass** is Nepal’s air quality and respiratory readiness platform: live station-based air scores, heat and rain context, illustrative forecasts, public guides, registration for alerts, a facility layer for health workers, and a PIN-locked operator console.

**Repository:** [https://github.com/mamta2009/aqinepal2026](https://github.com/mamta2009/aqinepal2026)

## What’s in this tree

| Path                                                                                                                         | Purpose                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[early-warning-system/](early-warning-system/)`                                                                             | **Application root** — run from `early-warning-system/backend/`; `[README.md](early-warning-system/README.md)` is the product entry                                    |
| `[early-warning-system/docs/guides/](early-warning-system/docs/guides/README.md)`                                            | **All non-private Markdown** (implementation snapshot, Cursor guide, prompts, blockchain notes, landing guide)                                                         |
| `[early-warning-system/docs/guides/IMPLEMENTATION_SNAPSHOT.md](early-warning-system/docs/guides/IMPLEMENTATION_SNAPSHOT.md)` | **Canonical technical reference** (APIs, env load order, Mongo, AQ resolver, admin routes)                                                                             |
| `[early-warning-system/frontend/](early-warning-system/frontend/)`                                                           | Next.js static UI (dashboard, landing, guides)                                                                                                                         |
| `[early-warning-system/mobile-app/](early-warning-system/mobile-app/)`                                                       | Expo / React Native Climate Compass app                                                                                                                                |
| `[early-warning-system/docs-private/](early-warning-system/docs-private/)`                                                   | Partner-restricted drafts — `docs-private/` **Markdown is not linked on** `/guides`; preview from **Admin → Private documentation** (requires `NOTIFICATION_API_KEY`). |

## Headline air quality (current behaviour)

- **Primary:** WAQI local stations (map/bounds median nearby AQI, then city search)
- **Fallback:** WeatherAPI.com model estimate, then RapidAPI
- Broken WAQI `/feed/` paths are skipped so clients are not delayed
- UI charts and compare views prefer **station AQI** when PM2.5 µg/m³ is not reported; WeatherAPI remains preferred for **heat / rain**

See `IMPLEMENTATION_SNAPSHOT.md` for env keys and route detail.

## Quick start

```bash
cd early-warning-system/backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env

python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Then open `http://127.0.0.1:8000/`, `http://127.0.0.1:8000/guides`, `http://127.0.0.1:8000/registration`, `http://127.0.0.1:8000/admin/dashboard`. Older `/documentation` URLs redirect to `/guides`; `/guides/md/…` renders individual Markdown files from `docs/guides/`.

## Production (Render)

Deploy **FastAPI + uvicorn** from `early-warning-system/backend` using the blueprint `[early-warning-system/render.yaml](early-warning-system/render.yaml)`. Configure secrets and integration keys in the Render dashboard (`MONGODB_URL` / `DATABASE_URL`, `WAQI_TOKEN`, WeatherAPI, Twilio, etc.). One service URL serves **API routes, HTML pages (**`/`**,** `/guides`**,** `/users`**, …), and static** mounts (`/frontend`, `/landing-assets`, …).

**Python version:** Render’s default for **new** services can be **3.14.x**, which breaks `pip install scikit-learn` (no wheels; Cython compile fails). Set `PYTHON_VERSION` in the dashboard to a full **3.12.x** patch (for example `3.12.11`) — or rely on `[.python-version](.python-version)` and `[early-warning-system/backend/.python-version](early-warning-system/backend/.python-version)` in this repo. If you use **Blueprint**, the `PYTHON_VERSION` in `render.yaml` applies once the blueprint is synced.

Secrets: `backend/.env` is ignored — never commit it.
