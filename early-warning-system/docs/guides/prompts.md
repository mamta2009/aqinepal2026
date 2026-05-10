## CURSOR AI PROMPTS — STATUS

These were the suggested prompts vs what the repo implements now.

**Resolver order, env variables, and provenance fields:** see **`early-warning-system/docs/guides/IMPLEMENTATION_SNAPSHOT.md`**.

### For `backend/main.py`

| Prompt | Status |
|--------|--------|
| Weather / AQ upstreams (WeatherAPI direct, WAQI, Rapid fallback; OpenWeather supplementary) | **Done** — `external_integrations.py` + `GET /api/air-quality/current`, `GET /api/weather/current`, `GET /api/weather/openweather/*`. |
| Provenance for agents / A2A | **Done** — **`provenance.deployment_role`**, **`confidence`**, **`a2a`** on applicable JSON (see snapshot). |
| MongoDB endpoint to store respiratory case reports | **Done** — `POST /api/health/cases/daily-report` (JSON body) inserts into **`respiratory_daily_reports`** when `MONGODB_URL` is set to a **real** connection string (not the `username:password` placeholder). |
| Blockchain verification on health endpoints via `blockchain_integration` | **Done** — `GET /api/health` plus case/daily-report responses include **`verification`** (SHA-256 + optional EIP-191 sign). Existing case routes unchanged for verification. |
| DHIS2 API pull + MongoDB store | **Partial** — `GET /api/dhis2/system-check` validates `/api/system/info` when **`DHIS2_*`** env is set. **Batch ETL into MongoDB** is intentionally left as project-specific wiring (documented in response field). |

**Examples**

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/runtime-config
curl "http://localhost:8000/api/air-quality/current?city=Kathmandu"
curl -X POST http://localhost:8000/api/health/cases/daily-report \
  -H "Content-Type: application/json" \
  -d '{"city":"Kathmandu","facility_id":"H001","respiratory_cases":12,"severe_cases":2,"reported_by":"nurse"}'
curl http://localhost:8000/api/dhis2/system-check
```

---

### For `frontend/index.html`

| Prompt | Status |
|--------|--------|
| API_BASE via environment variables | **Done (server-fed)** — on load the page calls **`GET /api/runtime-config`**, driven by **`PUBLIC_API_ORIGIN`** and **`API_PATH_PREFIX`** in `config/.env`. Same-origin dashboards use **`/api`** automatically. |
| Dark mode toggle in settings | **Done** — **Dark theme** checkbox; preference in **`localStorage`**. Uncheck switches to **light** (`html[data-theme="light"]` CSS overrides). |
| Mobile responsiveness for geographic selector | **Done** — extra **`max-width: 600px`** rules: stacked mode buttons full-width, full-width city select, tightened padding. Existing **`900px`** grid stacking kept. |

---

### For new backend modules

| Prompt | Status |
|--------|--------|
| `health_data_generator.py` | **Done** — `HealthDataGenerator` lives in **`early-warning-system/backend/health_data_generator.py`** and is imported by `main.py`. |
| `blockchain_integration.py` | **Done** — Polygon RPC ping, payload anchoring, optional signing (**`POLYGON_PRIVATE_KEY`**). |
| `ai_models.py` | **Done** — `predict_week_trend()` (**sklearn linear regression** when available, else moving average); exposed at **`GET /api/models/predict/week/{city}`** and used by the dashboard forecast strip. |

---

## TROUBLESHOOTING (UPDATED)

### "Module not found"

```bash
cd early-warning-system/backend && source .venv/bin/activate
pip install -r requirements.txt
```

### "`pkg_resources` / `web3` import fails"

Pin is in **`requirements.txt`**: **`setuptools>=69,<82`**. Re-run `pip install -r requirements.txt`.

### Port 8000 in use / clean restart

```bash
cd early-warning-system && ./scripts/stop.sh && ./scripts/start.sh
```

Or: `python -m uvicorn main:app --reload --port 8001` from `backend/`.

### CORS / empty charts

Prefer **`http://localhost:8000/frontend/index.html`** (same origin). If opening `file:///`, defaults still hit **`localhost:8000`** for **`/api/runtime-config`**.

### DHIS2 or Mongo returns "not configured"

Copy **`config/.env.example` → `config/.env`** and replace placeholders with **real** values; restart the backend.

---

## PACKAGE REMINDERS

- Run **`python backend/main.py`** or **`./scripts/start.sh`** from **`early-warning-system`**.
- Dashboard: **`http://localhost:8000/frontend/index.html`**.

---
