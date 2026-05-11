"""
Early Warning System - FastAPI Backend
Nepal Respiratory Health Surge Prediction
Open-Source | Blockchain-Verified | AI-Powered
"""

from __future__ import annotations

import logging
import os
import time
import csv
import asyncio
import hashlib
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import date, datetime
from io import StringIO
from typing import Any

from bson import ObjectId
import httpx
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import ai_models
import aq_snapshot_sync
import blockchain_integration
import db_state
import external_integrations
import guide_documents
import onchain_hooks
from cities_config import CITIES_CONFIG
from facility_presets import FACILITY_PRESETS_BY_CITY
from facility_auth import FacilityCaller, load_facility_caller
from health_data_generator import HealthDataGenerator
from notification_auth import notification_api_key_configured, operator_session_ttl_hours

# Load env: backend/.env first, then config/.env (python-dotenv default override=False:
# already-set keys are kept, so backend values win over config for duplicates).
_backend_root = os.path.dirname(os.path.abspath(__file__))
_config_dir = os.path.normpath(os.path.join(_backend_root, "..", "config"))
load_dotenv(os.path.join(_backend_root, ".env"))
load_dotenv(os.path.join(_config_dir, ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

mongo_reports: Any = None
onchain_tx_logger: Any = None
aq_scheduler: Any = None


def reload_onchain_tx_logger_global() -> dict[str, Any]:
    """Rebuild global ``onchain_tx_logger`` after env or runtime network overrides change."""
    global onchain_tx_logger
    from onchain_logger import build_logger_from_env, effective_polygon_network

    onchain_tx_logger = None
    try:
        onchain_tx_logger = build_logger_from_env()
        if onchain_tx_logger is not None and not onchain_tx_logger.enable:
            onchain_tx_logger = None
        if onchain_tx_logger is None:
            logger.info(
                "Polygon on-chain tx logger: off "
                "(set POLYGON_ONCHAIN_LOG=true + POLYGON_PRIVATE_KEY to enable txs)"
            )
        else:
            logger.info(
                "Polygon on-chain event logger: enabled — %s — network=%s",
                getattr(onchain_tx_logger, "network_name", ""),
                getattr(onchain_tx_logger, "network", ""),
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Polygon on-chain logger unavailable: %s", exc)
        onchain_tx_logger = None
    active = bool(onchain_tx_logger and getattr(onchain_tx_logger, "enable", False))
    return {
        "onchain_logging_active": active,
        "effective_network": effective_polygon_network(),
    }


def _public_deployment_mode_label() -> str:
    """Uppercase deployment mode from ``DEPLOYMENT_MODE`` (default REGIONAL)."""
    return (os.getenv("DEPLOYMENT_MODE") or "REGIONAL").strip().upper() or "REGIONAL"


def _iso_date_param(label: str, value: str) -> str:
    try:
        date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail=f"{label} must be YYYY-MM-DD"
        ) from exc
    return value


def _mongo_url_usable(url: str) -> bool:
    u = (url or "").strip()
    if not u:
        return False
    if "username:password@" in u.replace(" ", ""):
        return False
    if "your_" in u.lower():
        return False
    return True


async def _connect_mongo() -> tuple[Any | None, Any | None]:
    url, url_key = db_state.mongo_env_connection_string_and_key()
    if not url:
        db_state.set_mongo_last_connect_error(
            "no usable Mongo URI: set `MONGODB_URL` or `MONGODB_URI`; `DATABASE_URL` is only used if it starts with `mongodb://` or `mongodb+srv://` (Render often uses `DATABASE_URL` for Postgres)."
        )
        logger.info("MongoDB: skipped (no MONGODB_URL / MONGODB_URI / DATABASE_URL resembling mongodb)")
        return None, None
    if not _mongo_url_usable(url):
        db_state.set_mongo_last_connect_error(
            "connection string looks like a template (e.g. literal `username:password@` or `your_…`). "
            "Replace it with the full Atlas SRV URI from Cluster → Connect."
        )
        logger.info("MongoDB: skipped (placeholder or invalid MONGODB_* URI)")
        return None, None
    try:
        from motor.motor_asyncio import AsyncIOMotorClient

        client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5000)
        await client.admin.command("ping")
        db_explicit, db_src = db_state.mongo_env_database_name_and_source()
        if db_explicit:
            db = client[db_explicit]
            resolved = db_src
        else:
            try:
                db = client.get_default_database()
            except Exception:
                db = None
            if db is None:
                db = client["early_warning"]
                resolved = "fallback_early_warning"
            else:
                resolved = "from_connection_uri_path"
        logger.info(
            "MongoDB: connected — URI from env key `%s`, database `%s` (selection: %s)",
            url_key,
            db.name,
            resolved,
        )
        reports = db["respiratory_daily_reports"]
        db_state.set_mongo_last_connect_error(None)
        return reports, db
    except Exception as exc:  # noqa: BLE001
        err = str(exc).strip()[:500]
        db_state.set_mongo_last_connect_error(err or repr(exc))
        logger.warning("MongoDB unavailable: %s", exc)
        return None, None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global mongo_reports, onchain_tx_logger, aq_scheduler
    mongo_reports, mdb = await _connect_mongo()
    db_state.set_mongo_database(mdb)
    aq_scheduler = None
    if mdb is not None:
        from notifications_api import ensure_notification_indexes

        await ensure_notification_indexes(mdb)
        await ensure_operator_console_session_indexes(mdb)
        await aq_snapshot_sync.ensure_operational_data_indexes(mdb)
        if aq_snapshot_sync.aq_snapshot_sync_enabled():
            from apscheduler.schedulers.asyncio import AsyncIOScheduler

            aq_scheduler = AsyncIOScheduler()
            aq_scheduler.add_job(
                aq_snapshot_sync.sync_all_air_quality_snapshots,
                "interval",
                hours=aq_snapshot_sync.aq_snapshot_sync_hours(),
                kwargs={"db": mdb},
                id="aq_air_snapshots",
                replace_existing=True,
            )
            aq_scheduler.start()
            asyncio.create_task(aq_snapshot_sync.sync_all_air_quality_snapshots(mdb))
            logger.info(
                "AQ snapshot sync: APScheduler every %sh (AQ_SNAPSHOT_SYNC_ENABLED)",
                aq_snapshot_sync.aq_snapshot_sync_hours(),
            )
    try:
        reload_onchain_tx_logger_global()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Polygon on-chain logger startup: %s", exc)
        onchain_tx_logger = None
    logger.info(
        "Browser URLs: landing http://127.0.0.1:8000/ — do NOT use http://0.0.0.0:8000 (often blank)."
    )
    yield
    if aq_scheduler is not None:
        try:
            aq_scheduler.shutdown(wait=False)
        except Exception:  # noqa: BLE001
            pass
        aq_scheduler = None
    if mongo_reports is not None:
        try:
            mongo_reports.database.client.close()
        except Exception:  # noqa: BLE001
            pass
    db_state.set_mongo_database(None)


app = FastAPI(
    title="Early Warning System API",
    description="Nepal Respiratory Health Early Warning System",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from admin_panel import (  # noqa: E402
    admin_console_pin_env_nonempty,
    ensure_operator_console_session_indexes,
    operator_console_pin_source,
    router as admin_panel_router,
)
from notifications_api import (  # noqa: E402
    eligible_broadcast_contact_clause,
    public_resend_email_ready,
    router as notifications_router,
)

app.include_router(notifications_router)
app.include_router(admin_panel_router)

_air_qual_coord_cache: dict[str, tuple[float, str, dict[str, Any]]] = {}
_air_qual_coord_locks: dict[str, asyncio.Lock] = {}


def _air_qual_cache_ttl_seconds() -> float:
    """Cache successful /api/air-quality responses per rounded lat/lon to avoid Rapid bursts."""
    try:
        v = float((os.getenv("AIR_QUALITY_COORD_CACHE_SECONDS") or "120").strip())
    except ValueError:
        return 120.0
    return max(0.0, min(900.0, v))


def _air_qual_coord_key(lat: float, lon: float) -> str:
    return f"{round(lat, 4)}::{round(lon, 4)}"


async def _air_quality_at_point_cached(lat_v: float, lon_v: float, label: str | None) -> tuple[str, dict[str, Any]]:
    ttl = _air_qual_cache_ttl_seconds()
    key = _air_qual_coord_key(lat_v, lon_v)

    async def _fetch() -> tuple[str, dict[str, Any]]:
        return await external_integrations.air_quality_current_waqi_then_rapid(
            lat=lat_v, lon=lon_v, waqi_city_fallback=label
        )

    if ttl <= 0:
        return await _fetch()

    lock = _air_qual_coord_locks.setdefault(key, asyncio.Lock())
    async with lock:
        now = time.monotonic()
        ent = _air_qual_coord_cache.get(key)
        if ent is not None and ent[0] > now:
            return ent[1], ent[2]
        pair = await _fetch()
        _air_qual_coord_cache[key] = (now + ttl,) + pair
        return pair


def _risk_score_from_pm25_buckets(pm25: float) -> float:
    """0–100 illustrative score aligned with blockchain-ai INTEGRATION_GUIDE buckets."""
    if pm25 > 300:
        return 100.0
    if pm25 > 200:
        return 75.0
    if pm25 > 150:
        return 50.0
    if pm25 > 100:
        return 30.0
    return 10.0


def _legacy_alert_level(risk_score: float) -> str:
    if risk_score >= 70:
        return "HIGH"
    if risk_score >= 40:
        return "MODERATE"
    return "LOW"


def _legacy_recommendation(alert_level: str) -> str:
    return {
        "HIGH": "Stock O₂ cylinders; surge pediatric staffing; rehearse escalation protocol.",
        "MODERATE": "Increase monitoring; reserve surge beds; notify on-call clinicians.",
        "LOW": "Continue routine readiness; ambient conditions lower priority.",
    }.get(alert_level, "Maintain standard procedures.")


class DailyReportIn(BaseModel):
    city: str
    facility_id: str
    respiratory_cases: int = Field(ge=0)
    severe_cases: int = Field(ge=0)
    reported_by: str


class ActionLogIn(BaseModel):
    action_type: str = Field(..., min_length=2, max_length=80)
    details: str | None = Field(None, max_length=4000)
    facility_site: str | None = Field(
        None,
        max_length=200,
        description="Which registered facility/site this preparedness tap refers to (must match a name on file).",
    )


class OpenRouterChatIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=12000)
    system: str | None = Field(None, max_length=8000)
    model: str | None = Field(None, max_length=200)


_DEFAULT_OPENROUTER_SYSTEM = (
    "You help explain early warning and environmental health topics for technical and policy audiences "
    "working in Nepal. Be concise and cautious. You are not providing medical advice, diagnoses, or "
    "official public-health guidance."
)


@app.get("/api/runtime-config")
async def runtime_config():
    """Values from server env — lets the SPA avoid hard-coded API origins when proxied/CDN-hosted."""
    public = (os.getenv("PUBLIC_API_ORIGIN") or "").strip().rstrip("/")
    prefix = (os.getenv("API_PATH_PREFIX") or "/api").strip()
    if not prefix.startswith("/"):
        prefix = "/" + prefix
    return {
        "public_api_origin": public or None,
        "api_path_prefix": prefix,
        "facility_actions": {
            "auth_required": True,
            "dashboard_login_endpoint": "/api/auth/login",
            "dashboard_me_endpoint": "/api/auth/me",
            "facility_login_endpoint": "/api/auth/facility-login",
            "facility_token_endpoint": "/api/auth/facility-token",
            "approval_required": True,
            "auto_approve_note": (
                "When AUTO_APPROVE_VERIFIED_CONTACTS=true, verifying email approves alerting + reporting automatically."
            ),
        },
        "integrations": {
            **external_integrations.integrations_public_status(),
            "resend_configured": public_resend_email_ready(),
            "sendgrid_configured": public_resend_email_ready(),
        },
        "operator_console": {
            "notification_api_key_configured": notification_api_key_configured(),
            "session_ttl_hours": operator_session_ttl_hours(),
            "note": (
                "Admin JSON routes accept an HttpOnly cookie session after POST /api/admin/console-unlock-pin "
                "(MongoDB stores a hash; the browser never holds NOTIFICATION_API_KEY), or Bearer / X-API-Key "
                "when NOTIFICATION_API_KEY is set."
            ),
        },
    }


@app.get("/api/weather/current")
async def weather_current_rapidapi(
    city: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
):
    """
    Current weather JSON: prefers **WeatherAPI.com direct** when ``WEATHERAPI_COM_API_KEY`` is set
    (``https://api.weatherapi.com/v1/current.json``); otherwise RapidAPI via ``rapidapi_weather_current``.

    Use either ``city`` (configured municipality) or both ``lat`` and ``lon``.

    Response includes ``source`` plus ``provenance`` (confidence tier/score + A2A hints; heuristic policy, not statistical CIs).
    """
    if city:
        if city not in CITIES_CONFIG:
            raise HTTPException(status_code=404, detail=f"City {city} not found")
        loc = CITIES_CONFIG[city]
        lat_v, lon_v = float(loc["lat"]), float(loc["lon"])
        label = city
    else:
        if lat is None or lon is None:
            raise HTTPException(
                status_code=400,
                detail="Provide query param city=<name> or both lat and lon",
            )
        lat_v, lon_v = lat, lon
        label = None

    use_direct_weatherapi = bool(external_integrations.weatherapi_com_api_key())
    try:
        if use_direct_weatherapi:
            data = await external_integrations.weatherapi_com_current(lat=lat_v, lon=lon_v)
            wsrc = "weatherapi_com"
        else:
            data = await external_integrations.rapidapi_weather_current(
                lat=lat_v, lon=lon_v, location_label=label
            )
            wsrc = "rapidapi_weather"
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        snippet = ""
        try:
            snippet = (exc.response.text or "")[:800]
        except Exception:  # noqa: BLE001
            snippet = ""
        logger.warning(
            "Weather HTTP %s: %s (source=%s)",
            exc.response.status_code,
            snippet,
            "weatherapi_com" if use_direct_weatherapi else "rapidapi_weather",
        )
        hint = (
            "WeatherAPI.com rejected the request — check WEATHERAPI_COM_API_KEY and plan/quota."
            if use_direct_weatherapi
            else "Weather provider rejected the request — verify RAPIDAPI_WEATHER_HOST and RAPIDAPI_WEATHER_PATH for your RapidAPI subscription."
        )
        raise HTTPException(
            status_code=502,
            detail=hint,
        ) from exc
    except httpx.RequestError as exc:
        logger.warning(
            "Weather upstream request failed: %s (direct_weatherapi=%s)",
            exc,
            use_direct_weatherapi,
        )
        raise HTTPException(
            status_code=502,
            detail="Could not reach weather provider.",
        ) from exc

    return {
        "location_label": label,
        "lat": lat_v,
        "lon": lon_v,
        "source": wsrc,
        "provenance": external_integrations.integration_provenance_for_source(wsrc),
        "weather": data,
    }


@app.get("/api/weather/open-weather13/fiveday")
async def weather_openweather13_fiveday(
    lang: str = Query("EN", description="Upstream lang code, e.g. EN"),
    city: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
):
    """
    Proxies **Open Weather 13** on RapidAPI — ``GET /fivedaysforcast``
    with ``latitude``, ``longitude``, ``lang``. Requires subscription to that product.

    Provide ``city=<name>`` or both ``lat`` and ``lon`` (matching other weather endpoints).
    """
    if city:
        if city not in CITIES_CONFIG:
            raise HTTPException(status_code=404, detail=f"City {city} not found")
        loc = CITIES_CONFIG[city]
        lat_v, lon_v = float(loc["lat"]), float(loc["lon"])
        label = city
    else:
        if lat is None or lon is None:
            raise HTTPException(
                status_code=400,
                detail="Provide query param city=<name> or both lat and lon",
            )
        lat_v, lon_v = lat, lon
        label = None

    try:
        payload = await external_integrations.rapidapi_open_weather13_fiveday(
            latitude=lat_v,
            longitude=lon_v,
            lang=lang,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        snippet = ""
        try:
            snippet = (exc.response.text or "")[:800]
        except Exception:  # noqa: BLE001
            snippet = ""
        logger.warning(
            "Open Weather 13 RapidAPI HTTP %s: %s", exc.response.status_code, snippet
        )
        raise HTTPException(
            status_code=502,
            detail="Open Weather 13 rejected the request — subscribe on RapidAPI and check host/path in .env.",
        ) from exc
    except httpx.RequestError as exc:
        logger.warning("Open Weather 13 request failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Could not reach Open Weather 13 on RapidAPI.",
        ) from exc

    return {
        "location_label": label,
        "lat": lat_v,
        "lon": lon_v,
        "source": "rapidapi_open_weather13",
        "provenance": external_integrations.integration_provenance_for_source(
            "rapidapi_open_weather13"
        ),
        "lang": (lang or "EN").strip().upper()[:16] or "EN",
        "forecast": payload,
    }


@app.get("/api/weather/openweather/current")
async def weather_openweathermap_current(
    city: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    units: str = Query("metric", description="OpenWeatherMap units, e.g. metric, imperial, standard"),
    lang: str = Query("en", description="Upstream lang code for weather descriptions"),
):
    """
    **OpenWeatherMap** Current Weather API 2.5 (temp, humidity, wind, clouds, …) — supplementary
    supporting read. Primary ``GET /api/weather/current`` uses WeatherAPI.com when ``WEATHERAPI_COM_API_KEY`` is set.

    Requires ``OPENWEATHER_API_KEY``. Use ``city=<configured city>`` or both ``lat`` and ``lon``.
    """
    if city:
        if city not in CITIES_CONFIG:
            raise HTTPException(status_code=404, detail=f"City {city} not found")
        loc = CITIES_CONFIG[city]
        lat_v, lon_v = float(loc["lat"]), float(loc["lon"])
        label = city
    else:
        if lat is None or lon is None:
            raise HTTPException(
                status_code=400,
                detail="Provide query param city=<name> or both lat and lon",
            )
        lat_v, lon_v = lat, lon
        label = None

    if not external_integrations.integrations_openweathermap_configured():
        raise HTTPException(
            status_code=503,
            detail="OPENWEATHER_API_KEY is not set — add your OpenWeatherMap key to use this route.",
        )

    try:
        payload = await external_integrations.openweathermap_current_weather(
            lat=lat_v,
            lon=lon_v,
            units=units,
            lang=lang,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        snippet = ""
        try:
            snippet = (exc.response.text or "")[:800]
        except Exception:  # noqa: BLE001
            snippet = ""
        logger.warning(
            "OpenWeatherMap current HTTP %s: %s", exc.response.status_code, snippet
        )
        raise HTTPException(
            status_code=502,
            detail="OpenWeatherMap rejected the request — check OPENWEATHER_API_KEY and account limits.",
        ) from exc
    except httpx.RequestError as exc:
        logger.warning("OpenWeatherMap current request failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Could not reach OpenWeatherMap.",
        ) from exc

    return {
        "location_label": label,
        "lat": lat_v,
        "lon": lon_v,
        "source": "openweathermap_current",
        "provenance": external_integrations.integration_provenance_for_source(
            "openweathermap_current"
        ),
        "note": "Supporting weather read; product headline current weather may use WeatherAPI.com when configured.",
        "units": (units or "metric").strip().lower()[:16] or "metric",
        "lang": (lang or "en").strip().lower()[:16] or "en",
        "data": payload,
    }


@app.get("/api/weather/openweather/air-pollution")
async def weather_openweathermap_air_pollution(
    city: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
):
    """
    **OpenWeatherMap** Air Pollution 2.5 — PM2.5 / component concentrations for **shadow / cross-check** only.
    ``GET /api/air-quality/current`` remains WeatherAPI.com-first when ``WEATHERAPI_COM_API_KEY`` is set.

    Requires ``OPENWEATHER_API_KEY``. Use ``city=<configured city>`` or both ``lat`` and ``lon``.
    """
    if city:
        if city not in CITIES_CONFIG:
            raise HTTPException(status_code=404, detail=f"City {city} not found")
        loc = CITIES_CONFIG[city]
        lat_v, lon_v = float(loc["lat"]), float(loc["lon"])
        label = city
    else:
        if lat is None or lon is None:
            raise HTTPException(
                status_code=400,
                detail="Provide query param city=<name> or both lat and lon",
            )
        lat_v, lon_v = lat, lon
        label = None

    if not external_integrations.integrations_openweathermap_configured():
        raise HTTPException(
            status_code=503,
            detail="OPENWEATHER_API_KEY is not set — add your OpenWeatherMap key to use this route.",
        )

    try:
        payload = await external_integrations.openweathermap_air_pollution(
            lat=lat_v,
            lon=lon_v,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        snippet = ""
        try:
            snippet = (exc.response.text or "")[:800]
        except Exception:  # noqa: BLE001
            snippet = ""
        logger.warning(
            "OpenWeatherMap air_pollution HTTP %s: %s", exc.response.status_code, snippet
        )
        raise HTTPException(
            status_code=502,
            detail="OpenWeatherMap Air Pollution rejected the request — check OPENWEATHER_API_KEY.",
        ) from exc
    except httpx.RequestError as exc:
        logger.warning("OpenWeatherMap air_pollution request failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Could not reach OpenWeatherMap Air Pollution API.",
        ) from exc

    return {
        "location_label": label,
        "lat": lat_v,
        "lon": lon_v,
        "source": "openweathermap_air_pollution",
        "provenance": external_integrations.integration_provenance_for_source(
            "openweathermap_air_pollution"
        ),
        "role": "cross_check_only",
        "note": "Does not replace WeatherAPI.com-first resolver for headline air quality.",
        "data": payload,
    }


@app.get("/api/air-quality/current")
async def air_quality_current(
    city: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
):
    """
    Air quality at a configured city or arbitrary latitude/longitude.

    Resolver order when ``WEATHERAPI_COM_API_KEY`` is set: **WeatherAPI.com direct** first, then **WAQI**, then **RapidAPI**.
    Without that key: **WAQI**, then **RapidAPI**.

    Response ``source`` may be ``weatherapi_com``, ``waqi``, or ``rapidapi_weather_air_quality``.

    ``provenance`` adds human + A2A-friendly ``confidence`` tier/score, ``deployment_role``, and ``a2a`` hints (heuristic, not CIs).
    """
    if city:
        if city not in CITIES_CONFIG:
            raise HTTPException(status_code=404, detail=f"City {city} not found")
        loc = CITIES_CONFIG[city]
        lat_v, lon_v = float(loc["lat"]), float(loc["lon"])
        label = city
    else:
        if lat is None or lon is None:
            raise HTTPException(
                status_code=400,
                detail="Provide query param city=<name> or both lat and lon",
            )
        lat_v, lon_v = lat, lon
        label = None

    try:
        source, payload = await _air_quality_at_point_cached(lat_v, lon_v, label)
    except external_integrations.AirQualityError as exc:
        logger.warning("Air quality unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)[:1400]) from exc

    return {
        "location_label": label,
        "lat": lat_v,
        "lon": lon_v,
        "source": source,
        "provenance": external_integrations.integration_provenance_for_source(source),
        "air_quality": payload,
    }


@app.get("/api/heat/current")
async def heat_current(
    city: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
):
    """
    Heat snapshot °C (WeatherAPI.com direct → Rapid → OpenWeather ``/weather`` fallback).

    ``effective_temp_c`` approximates physiological load as ``max(ambient, feels-like)``.
    Tiers mirror ``POST /api/alerts/evaluate-heat``.
    """
    from notifications_api import _heat_temperature_and_level, _heat_threshold_degrees_c

    if city:
        if city not in CITIES_CONFIG:
            raise HTTPException(status_code=404, detail=f"City {city} not found")
        loc = CITIES_CONFIG[city]
        lat_v, lon_v = float(loc["lat"]), float(loc["lon"])
        label = city
    else:
        if lat is None or lon is None:
            raise HTTPException(
                status_code=400,
                detail="Provide query param city=<name> or both lat and lon",
            )
        lat_v, lon_v = lat, lon
        label = None

    try:
        src, blob = await external_integrations.heat_current_preferred(
            lat=lat_v,
            lon=lon_v,
            location_label=label,
        )
    except external_integrations.HeatCurrentError as exc:
        logger.warning("Heat current unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)[:1400]) from exc

    td, lvl = _heat_temperature_and_level(blob)
    mod_c, hi_c, sev_c = _heat_threshold_degrees_c()

    return {
        "location_label": label,
        "lat": lat_v,
        "lon": lon_v,
        "source": src,
        "provenance": external_integrations.integration_provenance_for_source(src),
        "heat": blob,
        "heat_temperature_display": td,
        "heat_level": lvl.value,
        "thresholds_c": {
            "moderate_at_or_above": mod_c,
            "high_at_or_above": hi_c,
            "severe_at_or_above": sev_c,
        },
    }


@app.get("/api/air-quality/{city}")
async def air_quality_legacy_city_segment(city: str):
    """
    Compatibility shim for integrations that call ``/api/air-quality/Kathmandu``.
    Prefer ``GET /api/air-quality/current?city=Kathmandu``.
    """
    return await air_quality_current(city=city, lat=None, lon=None)


def _serialize_air_snapshot_doc(record: dict[str, Any]) -> dict[str, Any]:
    doc = dict(record)
    oid = doc.get("_id")
    doc["_id"] = str(oid) if oid is not None else None
    sa = doc.get("synced_at")
    if isinstance(sa, datetime):
        doc["synced_at"] = sa.isoformat() + "Z"
    return doc


@app.get("/api/air-quality/snapshots")
async def list_air_quality_snapshots(city: str | None = None):
    """
    Latest persisted AQ reading per city (MongoDB ``air_quality_snapshots``).
    Populated when ``AQ_SNAPSHOT_SYNC_ENABLED`` runs the scheduler, or after a manual refresh.
    """
    mdb = db_state.mongo_db
    if mdb is None:
        raise HTTPException(
            status_code=503,
            detail="MongoDB not configured; set MONGODB_URL",
        )
    if city:
        if city not in CITIES_CONFIG:
            raise HTTPException(status_code=404, detail=f"City {city} not found")
        cur = mdb.air_quality_snapshots.find({"city": city})
    else:
        cur = mdb.air_quality_snapshots.find({}).sort("city", 1)
    rows = await cur.limit(48).to_list(48)
    return {
        "count": len(rows),
        "snapshots": [_serialize_air_snapshot_doc(r) for r in rows],
    }


@app.post("/api/air-quality/snapshots/refresh")
async def refresh_air_quality_snapshots(background_tasks: BackgroundTasks):
    """
    Queue a background full refresh for all configured cities into ``air_quality_snapshots``.
    """
    mdb = db_state.mongo_db
    if mdb is None:
        raise HTTPException(
            status_code=503,
            detail="MongoDB not configured",
        )

    async def job() -> None:
        await aq_snapshot_sync.sync_all_air_quality_snapshots(mdb)

    background_tasks.add_task(job)
    return {"success": True, "queued": True}


def _contact_facility_site_labels(contact_doc: dict[str, Any]) -> list[str]:
    from notifications_api import contact_facility_site_labels

    return contact_facility_site_labels(contact_doc)


def _matches_registered_facility_site(site_raw: str, labels: list[str]) -> bool:
    s = site_raw.strip().lower()
    return any(x.strip().lower() == s for x in labels)


@app.post("/api/action-log")
async def create_action_log(
    entry: ActionLogIn,
    caller: FacilityCaller = Depends(load_facility_caller),
):
    """
    Persist a facility preparedness action attributed to an approved registrant JWT.

    Use ``Authorization: Bearer <token>`` from ``POST /api/auth/facility-token`` after
    ``POST /api/auth/facility-login`` delivers a short-lived OTP to the enrollee's channels.

    Facility / city derive from Mongo — never trusting arbitrary client-supplied identifiers.
    """
    mdb = db_state.mongo_db
    if mdb is None:
        raise HTTPException(status_code=503, detail="MongoDB not configured")
    cid = caller.city
    if cid and cid not in CITIES_CONFIG:
        raise HTTPException(status_code=400, detail=f"City {cid} not in configured municipalities")

    fid = caller.facility_id.strip()
    if not fid:
        raise HTTPException(status_code=403, detail="facility_id missing on approved contact")

    cdoc = await mdb.contacts.find_one({"_id": ObjectId(caller.contact_id)})
    if cdoc is None:
        raise HTTPException(status_code=401, detail="Contact not found")

    labels = _contact_facility_site_labels(cdoc)
    site_in = (entry.facility_site or "").strip()
    facility_site: str | None = None
    if labels:
        if len(labels) > 1 and not site_in:
            raise HTTPException(
                status_code=400,
                detail=(
                    "facility_site is required when you have multiple registered facilities "
                    "— pick which site you are reporting for."
                ),
            )
        if site_in:
            if not _matches_registered_facility_site(site_in, labels):
                raise HTTPException(
                    status_code=400,
                    detail="facility_site must match one of your registered facility names.",
                )
            facility_site = next(
                (x for x in labels if x.strip().lower() == site_in.strip().lower()),
                site_in,
            )
        else:
            facility_site = labels[0]
    elif site_in:
        raise HTTPException(
            status_code=400,
            detail="Add at least one facility name to your profile before tagging actions to a site.",
        )

    doc = {
        "facility_id": fid,
        "contact_id": caller.contact_id,
        "facility_name": caller.facility_name,
        "reported_by_email_hash": hashlib.sha256(caller.email.encode("utf-8")).hexdigest()[:24],
        "action_type": entry.action_type.strip(),
        "city": cid,
        "details": entry.details.strip() if entry.details else None,
        "timestamp": datetime.utcnow(),
    }
    if facility_site:
        doc["facility_site"] = facility_site
    r = await mdb.action_logs.insert_one(doc)
    await onchain_hooks.anchor_facility_action(
        mdb,
        facility_id=fid,
        action_type=entry.action_type.strip(),
        facility_site=facility_site,
        details=entry.details.strip() if entry.details else None,
        action_log_id=str(r.inserted_id),
    )
    return {
        "success": True,
        "id": str(r.inserted_id),
        "facility_id": fid,
        "facility_site": facility_site,
    }


@app.get("/api/action-log/me")
async def list_my_action_logs(
    caller: FacilityCaller = Depends(load_facility_caller),
    limit: int = Query(50, ge=1, le=500),
):
    """List recent preparedness actions only for the caller's authenticated facility."""
    mdb = db_state.mongo_db
    if mdb is None:
        raise HTTPException(status_code=503, detail="MongoDB not configured")
    fid = caller.facility_id.strip()
    cur = (
        mdb.action_logs.find({"facility_id": fid, "contact_id": caller.contact_id})
        .sort("timestamp", -1)
        .limit(limit)
    )
    rows = await cur.to_list(limit)
    out: list[dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        d["_id"] = str(d["_id"])
        ts = d.get("timestamp")
        if isinstance(ts, datetime):
            d["timestamp"] = ts.isoformat() + "Z"
        out.append(d)
    return {"facility_id": fid, "count": len(out), "entries": out}


@app.get("/api/data/export")
async def operational_data_export(
    kind: str = Query(
        "air_snapshots",
        description="Export resource: ``air_snapshots`` or ``action_logs``.",
    ),
    export_format: str = Query(
        "json",
        alias="format",
        description="json or csv.",
    ),
    facility_id: str | None = Query(
        None,
        description="For action_logs CSV/JSON filter.",
    ),
):
    """
    Download persisted operational data (parity with bundled dashboard export patterns).
    No PII in ``air_snapshots``; facility-scoped audit lines may still be sensitive.
    """
    mdb = db_state.mongo_db
    if mdb is None:
        raise HTTPException(status_code=503, detail="MongoDB not configured")
    ef = export_format.strip().lower()
    if ef not in ("json", "csv"):
        raise HTTPException(status_code=400, detail="format must be json or csv")
    resource = kind.strip().lower().replace("-", "_")
    if resource in ("air_snapshots", "air_quality_snapshots", "snapshots"):
        rows = (
            await mdb.air_quality_snapshots.find({})
            .sort("city", 1)
            .limit(64)
            .to_list(64)
        )
        payload = [_serialize_air_snapshot_doc(dict(r)) for r in rows]
        if ef == "json":
            body = JSONResponse(
                {
                    "resource": "air_quality_snapshots",
                    "exported_at": datetime.utcnow().isoformat() + "Z",
                    "count": len(payload),
                    "rows": payload,
                }
            )
            body.headers["Content-Disposition"] = 'attachment; filename="air_snapshots_export.json"'
            return body
        buf = StringIO()
        writer = csv.writer(buf)
        writer.writerow(["city", "synced_at", "source", "aqicn_station_uid", "pm25_ug_m3", "aqi"])
        for d in payload:
            aq = d.get("air_quality") or {}
            writer.writerow(
                [
                    d.get("city"),
                    d.get("synced_at"),
                    d.get("source"),
                    d.get("aqicn_station_uid"),
                    aq.get("pm25_ug_m3") if isinstance(aq, dict) else d.get("pm25_ug_m3"),
                    aq.get("aqi") if isinstance(aq, dict) else d.get("aqi"),
                ]
            )
        resp = PlainTextResponse(buf.getvalue(), media_type="text/csv")
        resp.headers["Content-Disposition"] = 'attachment; filename="air_snapshots_export.csv"'
        return resp

    if resource in ("action_logs", "audit", "logs"):
        q: dict[str, Any] = {}
        if facility_id:
            q["facility_id"] = facility_id
        rows = await mdb.action_logs.find(q).sort("timestamp", -1).limit(2000).to_list(2000)
        simplified: list[dict[str, Any]] = []
        for r in rows:
            ts = r.get("timestamp")
            simplified.append(
                {
                    "_id": str(r["_id"]),
                    "facility_id": r.get("facility_id"),
                    "facility_name": r.get("facility_name"),
                    "contact_id": r.get("contact_id"),
                    "reported_by_email_hash": r.get("reported_by_email_hash"),
                    "action_type": r.get("action_type"),
                    "city": r.get("city"),
                    "details": r.get("details"),
                    "timestamp": ts.isoformat() + "Z" if isinstance(ts, datetime) else ts,
                }
            )
        if ef == "json":
            jr = JSONResponse(
                {
                    "resource": "action_logs",
                    "exported_at": datetime.utcnow().isoformat() + "Z",
                    "filter_facility_id": facility_id,
                    "count": len(simplified),
                    "rows": simplified,
                }
            )
            jr.headers["Content-Disposition"] = 'attachment; filename="action_logs_export.json"'
            return jr
        b2 = StringIO()
        w2 = csv.writer(b2)
        w2.writerow(
            ["id", "facility_id", "facility_name", "contact_id", "action_type", "city", "timestamp", "details"]
        )
        for d in simplified:
            w2.writerow(
                [
                    d["_id"],
                    d.get("facility_id"),
                    d.get("facility_name"),
                    d.get("contact_id"),
                    d.get("action_type"),
                    d.get("city"),
                    d.get("timestamp"),
                    (d.get("details") or "").replace("\r\n", " ").replace("\n", " ")[:2000],
                ]
            )
        r2 = PlainTextResponse(b2.getvalue(), media_type="text/csv")
        r2.headers["Content-Disposition"] = 'attachment; filename="action_logs_export.csv"'
        return r2

    raise HTTPException(
        status_code=400,
        detail="Unsupported kind — use air_snapshots or action_logs",
    )


@app.get("/api/risk-score/{city}")
async def risk_score_legacy(city: str):
    """
    Simple 0–100 respiratory risk aligned with synthetic PM2.5 buckets where PM2.5 is available.

    Canonical data path still uses ``/api/air-quality/current`` — this wraps that result for older clients.
    """
    if city not in CITIES_CONFIG:
        raise HTTPException(status_code=404, detail=f"City {city} not found")
    loc = CITIES_CONFIG[city]
    lat_v, lon_v = float(loc["lat"]), float(loc["lon"])
    try:
        source, aq = await _air_quality_at_point_cached(lat_v, lon_v, city)
    except external_integrations.AirQualityError as exc:
        logger.warning("Risk score unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)[:1400]) from exc

    pm_raw = aq.get("pm25_ug_m3")
    pm25: float | None = None
    if isinstance(pm_raw, (int, float)):
        fv = float(pm_raw)
        if fv == fv:  # reject NaN
            pm25 = fv

    basis: str
    risk: float
    if pm25 is not None:
        risk = _risk_score_from_pm25_buckets(pm25)
        basis = "pm25_integration_buckets"
    elif source == "waqi" and isinstance(aq.get("aqi"), (int, float)):
        aqi_v = float(aq["aqi"])
        risk = max(10.0, min(100.0, aqi_v * (100.0 / 300.0)))
        basis = "waqi_aqi_linear_proxy"
    elif isinstance(aq.get("us_epa_index"), (int, float)):
        ue = float(aq["us_epa_index"])
        risk = max(10.0, min(100.0, ue * (100.0 / 6.0)))
        basis = "us_epa_index_scaled_proxy"
    else:
        basis = "unavailable_insufficient_air_metrics"
        risk = 10.0

    lvl = _legacy_alert_level(risk)
    ts = datetime.utcnow().isoformat() + "Z"
    out = {
        "city": city,
        "lat": lat_v,
        "lon": lon_v,
        "risk_score": round(risk, 2),
        "alert_level": lvl,
        "basis": basis,
        "pm25_ug_m3": pm25,
        "source": source,
        "provenance": external_integrations.integration_provenance_for_source(source),
        "snapshot": aq,
        "recommendation": _legacy_recommendation(lvl),
        "generated_at": ts,
    }
    env = {"type": "risk_score_legacy_v1", "generated_at": ts, "data": out}
    out["verification"] = blockchain_integration.build_verification(envelope=env)
    return out


@app.get("/api/forecast/respiratory/{facility_id}")
async def forecast_respiratory_legacy(
    facility_id: str,
    days_ahead: int = Query(5, ge=1, le=14),
    city: str | None = Query(
        None,
        description="Configured city name; defaults to Kathmandu when omitted (demo facility-123 flow).",
    ),
):
    """
    Lightweight compatibility response for UNICEF/integration docs samples.

    **Note:** Facility records are not stored yet; numeric rows mirror the synthetic trend used by the SPA
    when live PM2.5 is unavailable. Prefer ``GET /api/models/surge-forecast/{city}`` for risk score + surge
    probability, or ``GET /api/models/predict/week/{city}`` for the legacy trend only.
    """
    cty = city or "Kathmandu"
    if cty not in CITIES_CONFIG:
        raise HTTPException(status_code=404, detail=f"City {cty} not found")

    week = HealthDataGenerator.week(cty)
    trend = ai_models.predict_week_trend(week.get("days") or [])
    next_est = float(trend.get("next_day_estimate") or 12)

    rows: list[dict[str, Any]] = []
    for d in range(1, days_ahead + 1):
        cases = max(0, round(next_est * (1.0 + (d - 1) * 0.04)))
        pm25_day = min(280, round(cases * 12 + d * 3))
        rsk = _risk_score_from_pm25_buckets(float(pm25_day))
        lvl = _legacy_alert_level(rsk)
        rows.append(
            {
                "day": d,
                "predicted_pm25": pm25_day,
                "predicted_cases": cases,
                "predicted_severe": max(0, round(cases * 0.15)),
                "alert_level": lvl,
                "recommendation": _legacy_recommendation(lvl),
            }
        )

    ts = datetime.utcnow().isoformat() + "Z"
    return {
        "facility_id": facility_id,
        "facility_name": f"{cty} synthetic preview (demo)",
        "city": cty,
        "forecast": rows,
        "model_accuracy": "illustrative / synthetic baseline",
        "model": trend.get("model"),
        "timestamp": ts,
    }


@app.get("/api/weather/meteostat/monthly")
async def weather_meteostat_monthly(
    start: str = Query(..., description="Inclusive start date YYYY-MM-DD"),
    end: str = Query(..., description="Inclusive end date YYYY-MM-DD"),
    city: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    alt: int | None = None,
):
    """
    RapidAPI Meteostat monthly time series at a point (same pattern as RapidAPI curl).

    Example: ``/api/weather/meteostat/monthly?city=Kathmandu&start=2020-01-01&end=2020-12-31``

    Env: same RapidAPI key as other endpoints; set ``RAPIDAPI_METEOSTAT_HOST=meteostat.p.rapidapi.com``
    (or point ``RAPIDAPI_WEATHER_HOST`` at Meteostat if you do not use WeatherAPI).
    """
    _iso_date_param("start", start)
    _iso_date_param("end", end)

    if city:
        if city not in CITIES_CONFIG:
            raise HTTPException(status_code=404, detail=f"City {city} not found")
        loc = CITIES_CONFIG[city]
        lat_v, lon_v = float(loc["lat"]), float(loc["lon"])
        alt_v = int(loc["elevation"]) if alt is None else alt
        label = city
    else:
        if lat is None or lon is None:
            raise HTTPException(
                status_code=400,
                detail="Provide city=<name> or both lat and lon",
            )
        lat_v, lon_v = lat, lon
        alt_v = int(alt) if alt is not None else 0
        label = None

    try:
        data = await external_integrations.rapidapi_meteostat_point_monthly(
            lat=lat_v,
            lon=lon_v,
            alt=alt_v,
            start=start,
            end=end,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        snippet = ""
        try:
            snippet = (exc.response.text or "")[:800]
        except Exception:  # noqa: BLE001
            snippet = ""
        logger.warning("Meteostat RapidAPI HTTP %s: %s", exc.response.status_code, snippet)
        raise HTTPException(
            status_code=502,
            detail="Meteostat/RapidAPI rejected the request. Check host (meteostat.p.rapidapi.com) and path (/point/monthly).",
        ) from exc
    except httpx.RequestError as exc:
        logger.warning("Meteostat request failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Could not reach Meteostat via RapidAPI.",
        ) from exc

    return {
        "location_label": label,
        "lat": lat_v,
        "lon": lon_v,
        "alt": alt_v,
        "start": start,
        "end": end,
        "source": "rapidapi_meteostat_monthly",
        "provenance": external_integrations.integration_provenance_for_source(
            "rapidapi_meteostat_monthly"
        ),
        "data": data,
    }


@app.post("/api/ai/openrouter")
async def ai_openrouter_chat(body: OpenRouterChatIn):
    """
    OpenRouter chat completions (server-side key). Outputs may be inaccurate; not medical advice.
    """
    try:
        raw = await external_integrations.openrouter_chat(
            user_message=body.message,
            system_message=body.system or _DEFAULT_OPENROUTER_SYSTEM,
            model=body.model,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        snippet = ""
        try:
            snippet = (exc.response.text or "")[:1200]
        except Exception:  # noqa: BLE001
            snippet = ""
        logger.warning("OpenRouter HTTP %s: %s", exc.response.status_code, snippet)
        raise HTTPException(
            status_code=502,
            detail="OpenRouter returned an error. Check model id and quota.",
        ) from exc
    except httpx.RequestError as exc:
        logger.warning("OpenRouter request failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach OpenRouter.") from exc

    choices = raw.get("choices") or []
    if not isinstance(choices, list) or not choices:
        raise HTTPException(status_code=502, detail="OpenRouter returned no choices.")
    msg = choices[0].get("message") if isinstance(choices[0], dict) else {}
    content = ""
    if isinstance(msg, dict):
        content = (msg.get("content") or "").strip()

    return {
        "reply": content,
        "model": raw.get("model") or body.model or (os.getenv("OPENROUTER_MODEL") or "").strip(),
        "disclaimer": "LLM replies can be mistaken; use for explanation only—not clinical or policy decisions.",
    }


@app.get("/api/health")
async def health_check():
    ts = datetime.utcnow().isoformat() + "Z"
    payload = {
        "status": "✅ API Running",
        "version": "3.0.0",
        "features": ["Open-Source", "Blockchain", "AI-Powered"],
        "timestamp": ts,
        "mongodb_persistence": mongo_reports is not None,
        "notification_registry": db_state.mongo_db is not None,
    }
    envelope = {"type": "health_probe_v1", "generated_at": ts, "data": payload}
    return {
        **payload,
        "verification": blockchain_integration.build_verification(envelope=envelope),
    }


async def _probe_weather_upstream_live() -> dict[str, Any]:
    """
    Lightweight Kathmandu probe: same provider order as ``/api/weather/current`` headline path.
    """
    lat, lon = 27.7172, 85.3240
    if external_integrations.integrations_weatherapi_com_configured():
        try:
            await external_integrations.weatherapi_com_current(
                lat=lat, lon=lon, timeout_s=10.0
            )
            return {
                "ok": True,
                "configured": True,
                "mode": "weatherapi_com",
                "detail": None,
            }
        except Exception as exc:  # noqa: BLE001
            return {
                "ok": False,
                "configured": True,
                "mode": "weatherapi_com",
                "detail": str(exc)[:220],
            }
    k_weather, host_weather, _ = external_integrations.rapidapi_weather_credentials()
    if k_weather and host_weather:
        try:
            await external_integrations.rapidapi_weather_current(
                lat=lat, lon=lon, timeout_s=12.0
            )
            return {
                "ok": True,
                "configured": True,
                "mode": "rapidapi_weather",
                "detail": None,
            }
        except Exception as exc:  # noqa: BLE001
            return {
                "ok": False,
                "configured": True,
                "mode": "rapidapi_weather",
                "detail": str(exc)[:220],
            }
    if external_integrations.integrations_openweathermap_configured():
        try:
            await external_integrations.openweathermap_current_weather(
                lat=lat, lon=lon, timeout_s=10.0
            )
            return {
                "ok": True,
                "configured": True,
                "mode": "openweathermap_current",
                "detail": None,
            }
        except Exception as exc:  # noqa: BLE001
            return {
                "ok": False,
                "configured": True,
                "mode": "openweathermap_current",
                "detail": str(exc)[:220],
            }
    return {
        "ok": False,
        "configured": False,
        "mode": "none",
        "detail": "No WeatherAPI.com, RapidAPI weather, or OpenWeather key configured",
    }


@app.get("/api/public/connection-status")
async def public_connection_status() -> dict[str, Any]:
    """
    Unauthenticated integration probe for the admin dashboard footer (Mongo ping, weather probe, PIN resolution hints).
    Does not reveal secrets or the effective PIN.
    """
    raw_url, uri_key_used = db_state.mongo_env_connection_string_and_key()
    logical_db_requested, logical_db_src = db_state.mongo_env_database_name_and_source()
    mongo_env_diag = {
        "connection_uri_env_key": uri_key_used or None,
        "logical_database_name_requested": logical_db_requested or None,
        "logical_database_env_source": (logical_db_src if logical_db_requested else None),
    }
    if db_state.mongo_db is not None:
        mongo_env_diag["active_database_name"] = db_state.mongo_db.name

    template_or_invalid_url = bool(raw_url) and not _mongo_url_usable(raw_url)

    mongo_block: dict[str, Any]
    if template_or_invalid_url:
        mongo_block = {
            "ok": False,
            "configured": False,
            "client_attached": False,
            "url_looks_like_template": True,
            "last_error": db_state.mongo_last_connect_error,
            "detail": "Mongo connection string looks like a placeholder — replace with your Atlas URI (MONGODB_URL / MONGODB_URI; DATABASE_URL only if it starts with mongodb).",
        }
    elif db_state.mongo_db is not None:
        mongo_block = {
            "ok": False,
            "configured": True,
            "client_attached": True,
            "url_looks_like_template": False,
            "last_error": None,
            "detail": None,
        }
        try:
            await db_state.mongo_db.admin.command("ping")
            mongo_block["ok"] = True
        except Exception as exc:  # noqa: BLE001
            mongo_block["detail"] = str(exc)[:400]
    else:
        mongo_block = {
            "ok": False,
            "configured": bool(raw_url),
            "client_attached": False,
            "url_looks_like_template": False,
            "last_error": db_state.mongo_last_connect_error,
            "detail": (
                "MongoDB client did not start — check startup logs and Atlas URI/network"
                if raw_url
                else "Mongo env: no usable mongodb:// or mongodb+srv:// in MONGODB_URL, MONGODB_URI, or DATABASE_URL"
            ),
        }

    weather_block = await _probe_weather_upstream_live()

    return {
        "type": "public_connection_status_v1",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "mongodb": {**mongo_block, **mongo_env_diag},
        "weather": weather_block,
        "operator_pin": {
            "resolution": operator_console_pin_source(),
            "admin_console_pin_env_nonempty": admin_console_pin_env_nonempty(),
        },
    }


@app.get("/api/cases/week/{city}")
async def get_cases_week(city: str):
    if city not in CITIES_CONFIG:
        raise HTTPException(status_code=404, detail=f"City {city} not found")
    data = HealthDataGenerator.week(city)
    ts = datetime.utcnow().isoformat() + "Z"
    envelope = {"type": "cases_week_v1", "generated_at": ts, "data": data}
    verification = blockchain_integration.build_verification(envelope=envelope)
    return {**data, "generated_at": ts, "verification": verification}


@app.get("/api/cases/all-cities")
async def get_all_cities():
    cities = list(CITIES_CONFIG.keys())
    cities_payload = {c: HealthDataGenerator.week(c) for c in cities}
    payload = {
        "region": "Bagmati Province",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "cities": cities_payload,
        "total_cases_week": sum(w["total"] for w in cities_payload.values()),
        "deployment_mode": _public_deployment_mode_label(),
        "status": "Ready for Production",
    }
    envelope = {
        "type": "cases_all_cities_v1",
        "timestamp": payload["timestamp"],
        "region": payload["region"],
        "total_cases_week": payload["total_cases_week"],
        "cities": cities_payload,
        "deployment_mode": payload["deployment_mode"],
    }
    payload["verification"] = blockchain_integration.build_verification(envelope=envelope)
    return payload


@app.get("/api/cities")
async def get_cities():
    return {
        "mode": "regional",
        "cities": [
            {
                "name": name,
                "population": data["population"],
                "hospitals": data["hospitals"],
                "elevation": data["elevation"],
                "province": "Bagmati",
                "status": "ACTIVE",
            }
            for name, data in CITIES_CONFIG.items()
        ],
        "facility_presets_by_city": {
            k: v for k, v in FACILITY_PRESETS_BY_CITY.items() if k in CITIES_CONFIG
        },
        "total_population": sum(c["population"] for c in CITIES_CONFIG.values()),
        "total_hospitals": sum(c["hospitals"] for c in CITIES_CONFIG.values()),
        "facility_suggestions_note": (
            "Illustrative names only for onboarding — not an official directory."
        ),
    }


@app.get("/api/deployment-status")
async def get_deployment_status():
    return {
        "current_mode": _public_deployment_mode_label(),
        "regional_phase": {
            "status": "Active",
            "cities": 8,
            "province": "Bagmati",
            "timeline": "Months 1-6",
            "budget": "$42K operational",
        },
        "phase_2": {
            "status": "Ready for deployment",
            "cities": 30,
            "timeline": "Months 7-12",
            "budget": "$150K operational",
        },
        "national_scale": {
            "status": "Architecture designed",
            "cities": 75,
            "timeline": "Year 2-3",
            "budget": "$500K+ operational",
        },
    }


@app.get("/api/blockchain/status")
async def blockchain_status():
    rpc = blockchain_integration.polygon_rpc_ping()
    pk = (os.getenv("POLYGON_PRIVATE_KEY") or "").strip()
    pk_set = bool(pk and "your_private" not in pk.lower())
    onchain = bool(
        onchain_tx_logger is not None and getattr(onchain_tx_logger, "enable", False)
    )
    return {
        "blockchain_packaged": True,
        "blockchain_ai_zip_integrated": True,
        "docs_path": "early-warning-system/docs/blockchain-ai/",
        "cryptographic_anchoring": "backend/blockchain_integration.py",
        "polygon_onchain_tx_logging": onchain,
        "polygon_rpc_connected": rpc.get("connected"),
        "latest_block_number": rpc.get("latest_block_number"),
        "rpc_url": rpc.get("rpc_url"),
        "network": rpc.get("network"),
        "signing_key_configured": pk_set,
        "rpc_error": rpc.get("error"),
    }


@app.get("/api/blockchain/integration")
async def blockchain_integration_info():
    """How runtime code maps to the blockchain_AI package (see docs/blockchain-ai/)."""
    active = bool(
        onchain_tx_logger is not None and getattr(onchain_tx_logger, "enable", False)
    )
    wallet = ""
    if active and getattr(onchain_tx_logger, "account", None):
        wallet = str(onchain_tx_logger.account.address)
    return {
        "package": "blockchain_AI.zip (reference under docs/blockchain-ai/)",
        "runtime_modules": {
            "payload_hashes_and_signing": "backend/blockchain_integration.py",
            "product_onchain_hooks": "backend/onchain_hooks.py → onchain_anchor_log (MongoDB) + admin GET /api/admin/blockchain/anchors",
            "optional_polygon_transactions": {
                "module": "backend/onchain_logger.py",
                "reference_impl": "docs/blockchain-ai/reference_blockchain_logger.py",
                "active": active,
                "wallet_preview": f"{wallet[:10]}…{wallet[-6:]}" if len(wallet) > 16 else wallet,
            },
        },
        "extended_ai_models_reference_only": "docs/blockchain-ai/reference_ai_models_extended.py",
        "guides": [
            "early-warning-system/docs/blockchain-ai/INTEGRATION_GUIDE.md",
        ],
        "env_polygon_tx": {
            "POLYGON_ONCHAIN_LOG": "true | 1 | yes to load on-chain logger at startup",
            "POLYGON_PRIVATE_KEY": "wallet with POL for gas (testnet or mainnet)",
            "BLOCKCHAIN_ONCHAIN_NETWORK": "amoy (default) | mumbai (deprecated) | mainnet — persistent in .env",
            "POLYGON_AMOY_RPC_URL": "Amoy RPC override",
            "POLYGON_MUMBAI_RPC_URL": "optional Mumbai RPC (deprecated)",
            "POLYGON_RPC_URL": "mainnet RPC",
            "PATCH /api/admin/blockchain/runtime-network": "in-process testnet/main switch until worker restart (mirror .env for production)",
        },
    }


@app.get("/api/statistics")
async def get_statistics():
    return {
        "phase_1_regional": {
            "cities": 8,
            "population": sum(c["population"] for c in CITIES_CONFIG.values()),
            "hospitals": sum(c["hospitals"] for c in CITIES_CONFIG.values()),
            "duration": "6 months",
            "cost": "$42K",
        },
        "system_features": {
            "open_source": True,
            "blockchain_verified": True,
            "ai_powered": True,
            "geographic_scalable": True,
            "cost_per_month": 7,
        },
    }


@app.get("/api/models/predict/week/{city}")
async def predict_week_for_city(city: str):
    """AI trend line from the current synthetic week (see ai_models.py)."""
    if city not in CITIES_CONFIG:
        raise HTTPException(status_code=404, detail=f"City {city} not found")
    week = HealthDataGenerator.week(city)
    days = week.get("days") or []
    trend = ai_models.predict_week_trend(days)
    return {"city": city, "input_days": days, "forecast": trend}


@app.get("/api/models/surge-forecast/{city}")
async def surge_forecast_for_city(city: str):
    """
    **Partner contract:** polynomial regression on the weekly case series → **risk score (0–100)**,
    **surge probability** for days 3–5 ahead, accuracy metadata (declared % + in-sample R²),
    and **monthly retrain** policy fields.

    Input series today is the same **synthetic week** as ``/api/cases/week/{city}`` until DHIS2
    or facility exports feed real counts — see response ``input_meta``.
    """
    if city not in CITIES_CONFIG:
        raise HTTPException(status_code=404, detail=f"City {city} not found")
    week = HealthDataGenerator.week(city)
    days = week.get("days") or []
    surge = ai_models.predict_surge_forecast(days)
    trend = ai_models.predict_week_trend(days)
    ts = datetime.utcnow().isoformat() + "Z"
    out = {
        "city": city,
        "input_meta": {
            "series_length": len(days),
            "source": "synthetic_health_data_generator",
            "generator_note": week.get("note"),
        },
        "input_days_cases": days,
        "surge_forecast": surge,
        "legacy_week_trend": trend,
        "generated_at": ts,
    }
    env = {"type": "surge_forecast_bundle_v1", "generated_at": ts, "city": city, "risk": surge.get("risk_score_0_100")}
    out["verification"] = blockchain_integration.build_verification(envelope=env)
    return out


@app.get("/api/dhis2/system-check")
async def dhis2_system_check():
    """
    Probe DHIS2 /api/system/info when credentials are configured.
    Full program indicators sync can be added as a follow-up job.
    """
    base = (os.getenv("DHIS2_URL") or "").strip().rstrip("/")
    user = (os.getenv("DHIS2_USERNAME") or "").strip()
    pw = (os.getenv("DHIS2_PASSWORD") or "").strip()
    if not base or not user or not pw or "your_" in user.lower():
        return {
            "configured": False,
            "message": "Set DHIS2_URL, DHIS2_USERNAME, DHIS2_PASSWORD in config/.env",
        }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.get(f"{base}/api/system/info", auth=(user, pw))
            r.raise_for_status()
            info = r.json()
        return {
            "configured": True,
            "system_id": info.get("systemId"),
            "version": info.get("version"),
            "context_path": info.get("contextPath"),
            "stored_in_mongodb": "Use /api/health/cases/daily-report for configured facility rows; batch DHIS2 ETL is project-specific",
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("DHIS2 check failed: %s", exc)
        return {"configured": True, "reachable": False, "error": str(exc)}


def _env_flag_true(name: str) -> bool:
    return (os.getenv(name) or "").strip().lower() in ("1", "true", "yes")


def _daily_spike_multiplier() -> float:
    try:
        return float((os.getenv("DAILY_SPIKE_CASE_MULTIPLIER") or "1.5").strip())
    except ValueError:
        return 1.5


async def _maybe_daily_spike_notify(report: DailyReportIn, report_day: str) -> None:
    """Optional broadcast when daily cases exceed a multiple of recent average (gap 4)."""
    if not _env_flag_true("DAILY_REPORT_NOTIFY_ENABLED"):
        return
    if mongo_reports is None:
        return
    city = (report.city or "").strip()
    if city not in CITIES_CONFIG:
        return

    try:
        from notifications_api import broadcast_to_recipients
    except Exception as exc:  # noqa: BLE001
        logger.warning("Daily spike notify import failed: %s", exc)
        return

    mult = _daily_spike_multiplier()
    try:
        min_baseline = int((os.getenv("DAILY_SPIKE_MIN_PRIOR_REPORTS") or "3").strip() or "3")
    except ValueError:
        min_baseline = 3
    min_baseline = max(1, min(30, min_baseline))

    try:
        recent = (
            await mongo_reports.find({"city": city})
            .sort("timestamp", -1)
            .limit(40)
            .to_list(length=40)
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Daily spike query failed: %s", exc)
        return

    prior_cases: list[int] = []
    for r in recent:
        if r.get("date") == report_day:
            continue
        rc = r.get("respiratory_cases")
        if isinstance(rc, int) and rc >= 0:
            prior_cases.append(rc)
    if len(prior_cases) < min_baseline:
        return
    avg = sum(prior_cases) / len(prior_cases)
    if avg <= 0 or report.respiratory_cases < avg * mult:
        return

    db = db_state.mongo_db
    if db is None:
        return

    message = (
        f"⚠️ RESPIRATORY SURGE ALERT — {city}\n\n"
        f"Today's reported cases ({report.respiratory_cases}) are about "
        f"{report.respiratory_cases / max(avg, 0.01):.1f}× the recent daily average ({avg:.1f}).\n\n"
        f"Facility: {report.facility_id}\n"
        "Review surge capacity and staffing."
    )
    query: dict[str, Any] = {
        "$and": [
            eligible_broadcast_contact_clause(),
            {"contact_type": "health_worker"},
            {"$or": [{"city": city}, {"cities": city}]},
        ],
    }
    try:
        recipients = await db.contacts.find(query).to_list(length=5000)
        await broadcast_to_recipients(
            recipients, message, "HIGH", city, hazard_type="respiratory_surge"
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Daily spike broadcast failed: %s", exc)


@app.post("/api/health/cases/daily-report")
async def submit_daily_report(
    report: DailyReportIn, background_tasks: BackgroundTasks
):
    """Persist case report to MongoDB when MONGODB_URL is configured."""
    day = datetime.now().strftime("%Y-%m-%d")
    ts = datetime.utcnow().isoformat() + "Z"
    doc = {
        "city": report.city,
        "facility_id": report.facility_id,
        "respiratory_cases": report.respiratory_cases,
        "severe_cases": report.severe_cases,
        "reported_by": report.reported_by,
        "date": day,
        "timestamp": ts,
    }
    stored = False
    if mongo_reports is not None:
        await mongo_reports.insert_one(doc)
        stored = True

    background_tasks.add_task(_maybe_daily_spike_notify, report, day)

    env = {"type": "daily_report_v1", "generated_at": ts, "data": doc}
    return {
        **doc,
        "status": "success",
        "message": f"Logged {report.respiratory_cases} respiratory cases",
        "mongodb_stored": stored,
        "verification": blockchain_integration.build_verification(envelope=env),
    }


_landing_root = os.path.normpath(os.path.join(_backend_root, "..", "landing"))
_landing_html = os.path.join(_landing_root, "landing.html")
_guides_hub_html = os.path.join(_landing_root, "guides.html")
_admin_dashboard_html = os.path.join(_landing_root, "admin_dashboard.html")
_users_html = os.path.join(_landing_root, "users.html")
_intelladapt_logo_path = Path(_landing_root) / "assets" / "intelladapt-logo.png"
_docs_root = os.path.normpath(os.path.join(_backend_root, "..", "docs"))
_docs_technology_dir = os.path.join(_docs_root, "tech")


def _system_discovery_payload() -> dict:
    return {
        "system": "Early Warning System - Nepal Respiratory Health",
        "version": "3.0.0",
        "status": "🟢 Running",
        "features": ["Open-Source MIT", "Blockchain Verified (Polygon)", "AI-Powered (78% accuracy)"],
        "landing": "/",
        "guides": "/guides",
        "guides_markdown_preview": "/guides/md/{filepath}",
        "documentation_legacy_redirect": "/documentation",
        "dashboard": "/frontend/index.html",
        "docs": "/docs",
        "api_base": "/api",
        "endpoints": {
            "runtime_config": "/api/runtime-config",
            "health": "/api/health",
            "cases": "/api/cases/week/{city}",
            "all_cities": "/api/cases/all-cities",
            "cities": "/api/cities",
            "status": "/api/deployment-status",
            "statistics": "/api/statistics",
            "blockchain": "/api/blockchain/status",
            "blockchain_integration": "/api/blockchain/integration",
            "predict": "/api/models/predict/week/{city}",
            "surge_forecast": "/api/models/surge-forecast/{city}",
            "weather_current": "/api/weather/current",
            "weather_openweather13_fiveday": "/api/weather/open-weather13/fiveday",
            "weather_openweathermap_current": "/api/weather/openweather/current",
            "weather_openweathermap_air_pollution": "/api/weather/openweather/air-pollution",
            "weather_meteostat_monthly": "/api/weather/meteostat/monthly",
            "air_quality_current": "/api/air-quality/current",
            "heat_current": "/api/heat/current",
            "air_quality_legacy_city": "/api/air-quality/{city}",
            "air_quality_snapshots": "/api/air-quality/snapshots",
            "air_quality_snapshots_refresh": "POST /api/air-quality/snapshots/refresh",
            "action_log": "POST /api/action-log",
            "action_logs_my": "/api/action-log/me (Authorization: Bearer <facility token>)",
            "data_export": "/api/data/export",
            "risk_score_legacy": "/api/risk-score/{city}",
            "forecast_respiratory_legacy": "/api/forecast/respiratory/{facility_id}",
            "ai_openrouter": "POST /api/ai/openrouter",
            "dhis2": "/api/dhis2/system-check",
            "daily_report": "POST /api/health/cases/daily-report",
            "registration_portal": "/registration",
            "admin_dashboard": "/admin/dashboard",
            "users_account": "/users",
            "admin_registrants": "GET/POST /api/admin/registrants; PATCH …/enrolment (facilities & cities)",
            "admin_blockchain_overview": "GET /api/admin/blockchain/overview",
            "admin_blockchain_runtime_network": "PATCH /api/admin/blockchain/runtime-network",
            "admin_blockchain_anchors": "GET /api/admin/blockchain/anchors",
            "admin_blockchain_smoke_touch": "POST /api/admin/blockchain/smoke-touch",
            "admin_blockchain_log_outcome": "POST /api/admin/blockchain/log-outcome",
            "contacts_register": "POST /api/contacts/register",
            "contacts_verify": "POST /api/contacts/verify",
            "contacts_verify_with_email": "POST /api/contacts/verify-with-email",
            "dashboard_login": "POST /api/auth/login",
            "dashboard_me": "GET /api/auth/me",
            "dashboard_profile": "GET /api/auth/profile",
            "dashboard_notification_inbox": "GET /api/auth/notification-inbox",
            "registrant_patch_preferences": "PATCH /api/auth/preferences",
            "auth_change_password": "POST /api/auth/change-password",
            "admin_system_status": "GET /api/admin/system-status",
            "alerts_evaluate": "POST /api/alerts/evaluate",
            "alerts_evaluate_heat": "POST /api/alerts/evaluate-heat",
            "alerts_broadcast": "POST /api/alerts/broadcast",
            "alerts_latest": "GET /api/alerts/latest",
            "notifications_send": "POST /api/notifications/send",
            "twilio_test": "POST /api/notifications/twilio/test",
            "whatsapp_sandbox_info": "/api/notifications/whatsapp/sandbox-info",
            "guides_hub": "/guides",
            "guides_markdown": "/guides/md/…",
            "documentation_page": "/guides",
        },
    }


@app.get("/api/system-discovery")
async def system_discovery():
    """Machine-readable index (formerly served at `/`)."""
    return _system_discovery_payload()


@app.get("/")
async def landing_page():
    """Public marketing landing HTML when `landing/landing.html` is present."""
    path = Path(_landing_html)
    if path.is_file():
        try:
            return HTMLResponse(content=path.read_text(encoding="utf-8"))
        except OSError:
            logger.exception("Could not read %s — falling back to JSON", path)
    return JSONResponse(_system_discovery_payload())


@app.get("/guides", response_class=HTMLResponse)
async def guides_hub():
    """Public guides hub: diagrams from docs/tech + markdown index under docs/guides (see /guides/md/…)."""
    path = Path(_guides_hub_html)
    if path.is_file():
        try:
            return HTMLResponse(content=path.read_text(encoding="utf-8"))
        except OSError:
            logger.exception("Could not read %s — 404", path)
    raise HTTPException(status_code=404, detail="guides.html missing")


@app.get("/guides/md/{filepath:path}", response_class=HTMLResponse)
async def guides_markdown_page(filepath: str):
    """Render a *.md file from docs/guides/ as HTML."""
    gp = guide_documents.safe_markdown_under(guide_documents.GUIDES_MARKDOWN_ROOT, filepath)
    if gp is None:
        raise HTTPException(status_code=404, detail="Guide markdown not found")
    _title, page = guide_documents.render_markdown_page(gp)
    return HTMLResponse(page)


@app.get("/documentation")
async def documentation_legacy_redirect():
    """Old path; Guides hub moved to `/guides`."""
    return RedirectResponse(url="/guides", status_code=307)


@app.get("/documentation/media/tech/{path:path}")
async def documentation_technology_media_redirect(path: str):
    """Old media URL under /documentation; tech SVGs live at /guides/media/tech/…."""
    if ".." in path:
        raise HTTPException(status_code=400, detail="invalid path")
    return RedirectResponse(url=f"/guides/media/tech/{path}", status_code=307)


@app.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard_page():
    """Operator HTML console (loads admin JSON APIs — requires NOTIFICATION_API_KEY per request)."""
    path = Path(_admin_dashboard_html)
    if path.is_file():
        try:
            return HTMLResponse(content=path.read_text(encoding="utf-8"))
        except OSError:
            logger.exception("Could not read %s", path)
    raise HTTPException(status_code=404, detail="admin_dashboard.html missing")


@app.get("/users", response_class=HTMLResponse)
async def users_account_page():
    """Registrant HTML: sign-in, profile, facility actions (static shell + /frontend/user-account.js)."""
    path = Path(_users_html)
    if path.is_file():
        try:
            return HTMLResponse(content=path.read_text(encoding="utf-8"))
        except OSError:
            logger.exception("Could not read %s", path)
    raise HTTPException(status_code=404, detail="users.html missing")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon_legacy_path():
    """Browsers probe ``/favicon.ico`` automatically; reuse the PNG logo mounted under landing-assets."""
    return RedirectResponse("/landing-assets/intelladapt-logo.png", status_code=302)


@app.get("/intelladapt-logo.png")
async def intelladapt_logo_root_alias():
    """
    Some browsers or cached pages request the logo at the site root.
    Canonical path remains ``/landing-assets/intelladapt-logo.png``.
    """
    if _intelladapt_logo_path.is_file():
        return FileResponse(_intelladapt_logo_path, media_type="image/png")
    raise HTTPException(status_code=404, detail="intelladapt-logo.png not found under landing/assets")


_landing_assets_dir = os.path.join(_landing_root, "assets")
if os.path.isdir(_landing_assets_dir):
    app.mount(
        "/landing-assets",
        StaticFiles(directory=_landing_assets_dir),
        name="landing_assets",
    )

if os.path.isdir(_docs_technology_dir):
    app.mount(
        "/guides/media/tech",
        StaticFiles(directory=_docs_technology_dir),
        name="guides_technology_media",
    )

_frontend_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.isdir(_frontend_dir):
    app.mount("/frontend", StaticFiles(directory=_frontend_dir), name="frontend")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)