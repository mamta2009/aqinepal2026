# Climate Compass — how live data is fetched and used

This guide explains **where current readings come from**, **in what order providers are tried**, and **how the web and mobile UIs use the results**. For env keys and route tables, also see [`IMPLEMENTATION_SNAPSHOT.md`](IMPLEMENTATION_SNAPSHOT.md).

**Product:** Climate Compass  
**Code:** `backend/external_integrations.py`, `backend/main.py`, `backend/aq_snapshot_sync.py`, `backend/cities_config.py`

---

## Big picture

```text
Browser / Expo app
        │
        ▼
FastAPI  GET /api/air-quality/current
         GET /api/heat/current
         GET /api/weather/current
         GET /api/environment/overview
         GET /api/cases/week/{city}          ← synthetic cases (not live AQ)
         GET /api/models/predict/week/{city} ← forecast on synthetic week
        │
        ▼
Resolver order (air vs heat differ — see below)
        │
        ▼
Normalized JSON + source + provenance
```

| Kind of data | Live from upstream? | Primary path |
|--------------|---------------------|--------------|
| Headline air (dashboard / mobile home) | Yes | **WAQI** stations → WeatherAPI → RapidAPI |
| Heat (°C / feels-like) | Yes | **WeatherAPI** → RapidAPI → OpenWeather |
| Weather / rain context | Yes | **WeatherAPI** → RapidAPI (plus optional OpenWeather routes) |
| Weekly respiratory cases | No (demo generator) | `health_data_generator` / cases APIs |
| 24h air chart & stress sandbox | Built in the client | Seeded from latest **PM2.5 or AQI** |
| 5-day forecast strip | Hybrid | Server week-trend model + client seed from live air |

---

## Headline air quality

### Endpoint

```http
GET /api/air-quality/current?city=Kathmandu
```

You may also pass `lat` + `lon`. City names must match keys in `cities_config.py` (`CITIES_CONFIG`).

Implementation entry point: **`air_quality_current_waqi_then_rapid`** in `external_integrations.py`.

### Provider order (first success wins)

1. **WAQI map/bounds** (`/map/bounds/`)  
   - Builds a lat/lng box around the city.  
   - Collects nearby stations with a numeric AQI (skips `"-"` / offline).  
   - Picks the **median AQI** of stations within ~**30 km** (`WAQI_STATION_RADIUS_KM`).  
   - Returns `source: "waqi"`, usually with **`aqi`** set and **`pm25_ug_m3: null`**.

2. **WAQI search** (`/search/?keyword=…`)  
   - Used when bounds return no usable nearby stations.  
   - Same median / nearby selection idea from search hits.

3. **WeatherAPI.com** (`WEATHERAPI_COM_API_KEY` / `WEATHERAPI_API_KEY`)  
   - Model / satellite-style AQ estimate (`aqi=yes` on current weather).  
   - Used as **air fallback only** — not preferred over local stations.  
   - May include **PM2.5 µg/m³** and/or a **US EPA 1–6** style index.

4. **RapidAPI** weather/air product  
   - Last resort when WAQI and WeatherAPI are missing or fail.

### What is intentionally skipped

Broken WAQI **`/feed/`** paths (geo, keyword, station id) often return **`can not connect`** and only slow the client. Climate Compass **does not** call them first for live headline AQ or for snapshot sync.

Optional `aqicn_station_uid` in `cities_config.py` (e.g. Kathmandu `14868`) is kept for reference; live resolution uses map/bounds + search, not a blocking station feed hop.

### Important normalization rule

AQICN / WAQI **`iaqi.pm25.v`** is a **pollutant sub-index on the AQI scale**, **not** µg/m³.

- `_normalize_waqi_payload` therefore leaves **`pm25_ug_m3: null`**.  
- Putting that value into µg/m³ used to make the UI convert again (e.g. ~AQI **118** when stations were ~50–60).  
- UIs must prefer the reported **`aqi`** when µg/m³ is absent.

### Typical WAQI payload shape

```json
{
  "source": "waqi",
  "air_quality": {
    "aqi": 58,
    "aqi_scale": "waqi",
    "pm25_ug_m3": null,
    "station_name": "… (median of N nearby)",
    "station_count": 4,
    "observed_at": "…"
  },
  "provenance": { "deployment_role": "…", "confidence": { "tier": "…" } }
}
```

### Caching

`AIR_QUALITY_COORD_CACHE_SECONDS` (default ~120s) deduplicates identical rounded lat/lon requests on the canonical route.

### Snapshot sync (Mongo)

When `AQ_SNAPSHOT_SYNC_ENABLED` is on, `aq_snapshot_sync.py` uses the **same** resolver as live `/api/air-quality/current` and upserts into `air_quality_snapshots`. Operators can also hit:

- `GET /api/air-quality/snapshots`
- `POST /api/air-quality/snapshots/refresh`

---

## Heat

### Endpoint

```http
GET /api/heat/current?city=Kathmandu
```

Implementation: **`heat_current_preferred`**.

### Provider order

1. WeatherAPI.com  
2. RapidAPI weather-style JSON  
3. OpenWeatherMap current  

`effective_temp_c` is typically **`max(temp_c, feelslike_c)`**. Heat alert bands (LOW / MODERATE / HIGH / SEVERE) use server env thresholds (see dashboard / snapshot docs).

---

## Weather (conditions / rain)

### Endpoint

```http
GET /api/weather/current?city=Kathmandu
```

Prefers **WeatherAPI.com**, then RapidAPI. OpenWeather routes under `/api/weather/openweather/*` are **supplementary / cross-check** and are **not** merged into the headline air resolver.

---

## Environment overview (multi-city)

```http
GET /api/environment/overview
```

Returns a compact row per configured city (air + heat sources). Status labels prefer continuous **AQI** bands when present; PM2.5 detail may show **—** when only AQI is available.

---

## How the UI uses live air

Web (`frontend/`) and mobile (`mobile-app/`) share the same ideas:

| Surface | Behaviour when WAQI returns AQI only |
|---------|--------------------------------------|
| Climate guidance / outdoor answer | `airQualityBand({ aqi })` — Good ≤50, Moderate ≤100, Sensitive ≤150, else Unhealthy |
| Air chip / brief measurement | Prefer **`aqiScore`**, do not invent µg/m³ from WAQI sub-index |
| Compare cities | Plot **PM2.5 or AQI**; threshold line only when µg/m³ exists |
| 24h air chart | Smooth green illustrative curve seeded from PM2.5 else AQI |
| 5-day forecast cards | Seed from PM2.5 else AQI; unit label switches (µg/m³ vs AQI) |
| Recent alerts (client rows) | PM2.5 vs threshold if present, else station AQI band |
| Stress sandbox | Slider seeds from PM2.5 else AQI else a demo default |

Illustrative charts are **not** observed hourly history — they wobble around the latest live reading for teaching / discussion.

---

## Cases and AI forecast (not live AQ)

| Endpoint | What it is |
|----------|------------|
| `GET /api/cases/week/{city}` | Synthetic weekly respiratory case pattern for demos |
| `GET /api/models/predict/week/{city}` | Week-trend model (`ai_models.predict_week_trend`) on that synthetic series |
| Dashboard “Cases this week” / surge panels | Driven by cases APIs, not WAQI |

Do not describe these as ministry or DHIS2 case counts unless ETL is wired (`DHIS2_*` + `/api/dhis2/system-check` are health checks only today).

---

## Provenance

Successful integration responses usually include:

- **`source`** — e.g. `waqi`, `weatherapi_com`, `rapidapi_weather_air_quality`
- **`provenance.deployment_role`** — how Climate Compass treats that path
- **`provenance.confidence`** — heuristic score / tier / basis (**not** formal measurement CIs)
- **`provenance.a2a`** — hints for agent workflows

Use these fields when explaining trust and routing to partners or operators.

---

## Env keys (minimum for live AQ + heat)

| Variable | Role |
|----------|------|
| `WAQI_TOKEN` (aliases `WAQI_API_TOKEN`, `WAQI_API_KEY`) | Primary headline air |
| `WEATHERAPI_COM_API_KEY` (alias `WEATHERAPI_API_KEY`) | Heat/rain preferred; air fallback |
| `RAPIDAPI_WEATHER_*` | Weather/air last resort |
| `OPENWEATHER_API_KEY` | Supplementary weather / pollution cross-check only |
| `AIR_QUALITY_COORD_CACHE_SECONDS` | Optional AQ cache TTL |
| `AQ_SNAPSHOT_SYNC_ENABLED` / `AQ_SNAPSHOT_SYNC_HOURS` | Optional Mongo snapshot sync |

Templates: `backend/.env.example` (and optional `config/.env.example`).

---

## Quick checks

```bash
# Headline air (expect source waqi when token works)
curl "http://127.0.0.1:8000/api/air-quality/current?city=Kathmandu"

# Heat
curl "http://127.0.0.1:8000/api/heat/current?city=Kathmandu"

# Weather
curl "http://127.0.0.1:8000/api/weather/current?city=Kathmandu"

# Multi-city strip
curl "http://127.0.0.1:8000/api/environment/overview"
```

Inspect JSON: `source`, `air_quality.aqi`, `air_quality.pm25_ug_m3`, `provenance`.

Unit tests for WAQI picking / normalization: `backend/tests/test_waqi_area_reading.py`.

---

## Related docs

| Doc | Use when |
|-----|----------|
| [`IMPLEMENTATION_SNAPSHOT.md`](IMPLEMENTATION_SNAPSHOT.md) | Full API / Mongo / admin truth |
| [`DASHBOARD_FEATURES.md`](DASHBOARD_FEATURES.md) | What each dashboard card means |
| [`APPLICATION_OVERVIEW.md`](APPLICATION_OVERVIEW.md) | Setup and main URLs |

**Last aligned:** Sep 2026 — WAQI-station-first headline air, WeatherAPI for heat/rain and air fallback.
