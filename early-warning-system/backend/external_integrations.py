"""
Server-side calls to OpenRouter (chat), WAQI air quality, WeatherAPI.com (direct or Rapid proxy), and other Rapid endpoints.

Secrets stay in env; never returned to clients.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Any
from urllib.parse import quote

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
WAQI_FEED_BASE = "https://api.waqi.info/feed"
WEATHERAPI_COM_V1 = "https://api.weatherapi.com/v1"
OPENWEATHERMAP_DATA25_DEFAULT = "https://api.openweathermap.org/data/2.5"

logger = logging.getLogger(__name__)

_rapid_air_sem: asyncio.Semaphore | None = None


def _rapid_air_semaphore() -> asyncio.Semaphore:
    """Throttle concurrent RapidAPI weather calls (avoids HTTP 429 bursts). Lazy init picks up .env after load_dotenv."""
    global _rapid_air_sem  # noqa: PLW0603
    if _rapid_air_sem is None:
        try:
            raw = int((os.getenv("RAPIDAPI_CONCURRENCY_LIMIT") or "2").strip())
        except ValueError:
            raw = 2
        raw = max(1, min(32, raw))
        _rapid_air_sem = asyncio.Semaphore(raw)
    return _rapid_air_sem


def waqi_api_token() -> str:
    return (
        os.getenv("WAQI_TOKEN")
        or os.getenv("WAQI_API_TOKEN")
        or os.getenv("WAQI_API_KEY")
        or ""
    ).strip()


def _looks_like_placeholder_waqi_token(token: str) -> bool:
    """Detect common .env placeholders so we skip worthless WAQI calls and clarify errors."""
    s = (token or "").strip().lower()
    if len(s) < 8:
        return True
    if s.startswith(("paste_", "your_", "replace_", "changeme", "todo", "fixme")):
        return True
    collapsed = "".join(ch for ch in s if ch.isalnum())
    return "pasteyourwaqi" in collapsed or "waqitokenhere" in collapsed


def integrations_waqi_configured() -> bool:
    t = waqi_api_token()
    return bool(t) and not _looks_like_placeholder_waqi_token(t)


async def waqi_feed_geo(
    *,
    lat: float,
    lon: float,
    timeout_s: float = 15.0,
) -> dict[str, Any]:
    """World Air Quality Index — geo feed (nearest station indexing). Requires WAQI token."""
    token = waqi_api_token()
    if not token:
        raise ValueError(
            "Set WAQI_TOKEN (or WAQI_API_TOKEN / WAQI_API_KEY) for aqicn WAQI API."
        )
    # Path segment: geo:lat;lon (semicolon-separated; avoids comma ambiguity)
    path = f"geo:{float(lat):.6f};{float(lon):.6f}"
    url = f"{WAQI_FEED_BASE}/{path}/"
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        r = await client.get(url, params={"token": token})
        r.raise_for_status()
        return r.json()


def _waqi_keyword_slug(name: str) -> str | None:
    ascii_name = (
        name.encode("ascii", "ignore").decode("ascii").strip().lower().replace(" ", "")
    )
    slug = re.sub(r"[^a-z0-9-]", "", ascii_name.replace("_", "-"))
    return slug[:80] if slug else None


async def waqi_feed_keyword(
    *,
    keyword: str,
    timeout_s: float = 15.0,
) -> dict[str, Any]:
    """WAQI keyword feed when geo resolves without a usable index (nearest named station)."""
    token = waqi_api_token()
    if not token:
        raise ValueError("WAQI token required for keyword feed.")
    slug = _waqi_keyword_slug(keyword)
    if not slug:
        raise ValueError("City name yielded empty WAQI keyword slug.")
    url = f"{WAQI_FEED_BASE}/{slug}/"
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        r = await client.get(url, params={"token": token})
        r.raise_for_status()
        return r.json()


async def waqi_feed_station(
    *,
    station_uid: str,
    timeout_s: float = 15.0,
) -> dict[str, Any]:
    """
    WAQI / AQICN feed for a **specific station** path segment (e.g. ``H14868`` or ``@h14868``).
    Used when ``cities_config`` lists a known aqicn station id for cross-checking geo/keyword feeds.
    """
    token = waqi_api_token()
    if not token:
        raise ValueError(
            "Set WAQI_TOKEN (or WAQI_API_TOKEN / WAQI_API_KEY) for aqicn station feed."
        )
    uid = (station_uid or "").strip()
    if not uid:
        raise ValueError("station_uid is required")
    if not uid.startswith("@"):
        uid = f"@{uid}"
    # aqicn expects lower-case station keys in the URL path in practice
    uid_norm = "@" + uid[1:].lower()
    url = f"{WAQI_FEED_BASE}/{uid_norm}/"
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        r = await client.get(url, params={"token": token})
        r.raise_for_status()
        return r.json()


def _normalize_waqi_payload(body: Any) -> dict[str, Any] | None:
    if not isinstance(body, dict):
        return None
    if (body.get("status") or "").lower() != "ok":
        return None
    data = body.get("data")
    if not isinstance(data, dict):
        return None

    pm25: float | None = None
    iaqi = data.get("iaqi")
    if isinstance(iaqi, dict):
        pm25_block = iaqi.get("pm25")
        if isinstance(pm25_block, dict) and "v" in pm25_block:
            try:
                pm25 = float(pm25_block["v"])
            except (TypeError, ValueError):
                pm25 = None

    raw_aqi = data.get("aqi")
    aqi_val: int | None = None
    if raw_aqi not in (None, "-", ""):
        try:
            aqi_val = int(float(raw_aqi))
        except (TypeError, ValueError):
            aqi_val = None

    # Use PM2.5-only payloads when aqicn omits composite AQI (-) but still publishes iaqi.
    if aqi_val is None and pm25 is None:
        return None

    dominant = data.get("dominentpol")
    if isinstance(dominant, str):
        dominant = dominant.strip() or None
    else:
        dominant = None

    station_name: str | None = None
    city = data.get("city")
    if isinstance(city, dict):
        name = city.get("name")
        if isinstance(name, str) and name.strip():
            station_name = name.strip()

    time_block = data.get("time")
    observed: str | None = None
    if isinstance(time_block, dict):
        observed = time_block.get("s") or time_block.get("iso")
        if isinstance(observed, str):
            observed = observed.strip() or None
        else:
            observed = None

    return {
        "aqi": aqi_val,
        "aqi_scale": "waqi" if aqi_val is not None else None,
        "pm25_ug_m3": pm25,
        "dominant_pollutant": dominant,
        "station_name": station_name,
        "observed_at": observed,
    }


def waqi_feed_json_to_air_quality(body: Any) -> dict[str, Any] | None:
    """Normalize a raw WAQI ``/feed/`` JSON body to the same shape as other AQ payloads."""
    return _normalize_waqi_payload(body)


def _rapid_json_key_map(d: dict[str, Any]) -> dict[str, Any]:
    """Lowercase + underscore keys for loose matching (us-epa-index → us_epa_index)."""
    out: dict[str, Any] = {}
    for k, v in d.items():
        if not isinstance(k, str):
            continue
        nk = k.strip().lower().replace("-", "_")
        out[nk] = v
    return out


def _float_from_aq(aq_map: dict[str, Any], *names: str) -> float | None:
    for n in names:
        nk = n.strip().lower().replace("-", "_")
        v = aq_map.get(nk)
        if v is None:
            continue
        try:
            return float(v)
        except (TypeError, ValueError):
            continue
    return None


def _us_epa_index_from_aq(aq_map: dict[str, Any]) -> int | None:
    v = _float_from_aq(
        aq_map,
        "us_epa_index",
        "usepaindex",
        "us_epa_aqi",
        "epa_index",
        "aqi",
        "air_quality_index",
    )
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _air_metrics_dict_looks_useful(m: dict[str, Any]) -> bool:
    mp = _rapid_json_key_map(m)
    if _float_from_aq(mp, "pm2_5", "pm25", "pm_2_5") is not None:
        return True
    if _float_from_aq(mp, "pm10", "pm_10") is not None:
        return True
    if _us_epa_index_from_aq(mp) is not None:
        return True
    return False


def _collect_priority_air_quality_dicts(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Ordered candidates: strict WeatherAPI-com first, then common alternates."""
    found: list[dict[str, Any]] = []
    cur = raw.get("current")
    if isinstance(cur, dict):
        aq = cur.get("air_quality")
        if isinstance(aq, dict):
            found.append(aq)
    aq0 = raw.get("air_quality")
    if isinstance(aq0, dict) and aq0 not in found:
        found.append(aq0)
    data = raw.get("data")
    if isinstance(data, dict):
        cur2 = data.get("current")
        if isinstance(cur2, dict):
            aq2 = cur2.get("air_quality")
            if isinstance(aq2, dict) and aq2 not in found:
                found.append(aq2)
        aq3 = data.get("air_quality")
        if isinstance(aq3, dict) and aq3 not in found:
            found.append(aq3)
    return found


def _walk_dicts_for_air_metrics(obj: Any, depth: int = 0) -> list[dict[str, Any]]:
    if depth > 14:
        return []
    out: list[dict[str, Any]] = []
    if isinstance(obj, dict):
        if _air_metrics_dict_looks_useful(obj):
            out.append(obj)
        for v in obj.values():
            out.extend(_walk_dicts_for_air_metrics(v, depth + 1))
    elif isinstance(obj, list):
        for it in obj:
            out.extend(_walk_dicts_for_air_metrics(it, depth + 1))
    return out


def _station_name_from_rapid_raw(
    raw: dict[str, Any],
    *,
    station_fallback: str | None,
) -> str | None:
    loc = raw.get("location")
    if isinstance(loc, dict):
        parts = [
            loc.get("name"),
            loc.get("region"),
            loc.get("country"),
        ]
        s = ", ".join(
            str(p).strip() for p in parts if isinstance(p, str) and str(p).strip()
        )
        if s:
            return s
    if isinstance(loc, str) and loc.strip():
        return loc.strip()
    for k in ("city", "name", "location_name", "Location"):
        v = raw.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    data = raw.get("data")
    if isinstance(data, dict):
        for k in ("city", "location", "name"):
            v = data.get(k)
            if isinstance(v, str) and v.strip():
                return v.strip()
    return station_fallback


def _observed_at_from_rapid_raw(raw: dict[str, Any]) -> str | None:
    cur = raw.get("current")
    if isinstance(cur, dict):
        lu = cur.get("last_updated")
        if isinstance(lu, str) and lu.strip():
            return lu.strip()
    for k in ("last_updated", "updated", "observed_at", "localtime", "date"):
        v = raw.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def _normalize_rapid_weather_air_quality(
    raw: dict[str, Any],
    *,
    station_fallback: str | None = None,
) -> dict[str, Any] | None:
    """
    Normalizes RapidAPI weather payloads: WeatherAPI-com ``current.air_quality`` first,
    then ``air_quality`` / nested blobs (e.g. some city-path APIs).
    """
    if not isinstance(raw, dict):
        return None

    aq: dict[str, Any] | None = None
    for cand in _collect_priority_air_quality_dicts(raw):
        if _air_metrics_dict_looks_useful(cand):
            aq = cand
            break

    if aq is None:
        for cand in _walk_dicts_for_air_metrics(raw):
            if _air_metrics_dict_looks_useful(cand):
                aq = cand
                break

    if aq is None or not isinstance(aq, dict):
        return None

    mp = _rapid_json_key_map(aq)

    pm25 = _float_from_aq(mp, "pm2_5", "pm25", "pm_2_5")
    pm10 = _float_from_aq(mp, "pm10", "pm_10")
    co = _float_from_aq(mp, "co", "carbon_monoxide")
    no2 = _float_from_aq(mp, "no2", "nitrogen_dioxide")
    o3 = _float_from_aq(mp, "o3", "ozone")
    so2 = _float_from_aq(mp, "so2", "sulphur_dioxide", "sulfur_dioxide")
    us_epa_i = _us_epa_index_from_aq(mp)

    station_name = _station_name_from_rapid_raw(raw, station_fallback=station_fallback)
    last_updated = _observed_at_from_rapid_raw(raw)

    # Do not confuse US EPA bucket index with WAQI city AQI; expose separately.
    return {
        "aqi": None,
        "aqi_scale": None,
        "us_epa_index": us_epa_i,
        "pm25_ug_m3": pm25,
        "pm10_ug_m3": pm10,
        "co_micro_g_m3": co,
        "no2_micro_g_m3": no2,
        "o3_micro_g_m3": o3,
        "so2_micro_g_m3": so2,
        "dominant_pollutant": None,
        "station_name": station_name,
        "observed_at": last_updated,
    }


INTEGRATION_SOURCE_PROVENANCE: dict[str, dict[str, Any]] = {
    "weatherapi_com": {
        "provider_name": "WeatherAPI.com (direct API)",
        "confidence_score": 0.9,
        "confidence_tier": "high",
        "deployment_role": "primary_designated_upstream",
        "confidence_basis": "heuristic_designated_primary_paid_provider",
        "a2a_usable_as_primary_measurement": True,
        "a2a_recommended_use": (
            "Use as headline weather/AQ when this source_key is returned; prefer over WAQI/Rapid fallbacks."
        ),
    },
    "waqi": {
        "provider_name": "WAQI / AQICN (world air quality index)",
        "confidence_score": 0.72,
        "confidence_tier": "medium",
        "deployment_role": "secondary_station_network",
        "confidence_basis": "heuristic_open_index_geo_or_keyword_station_unknown_distance",
        "a2a_usable_as_primary_measurement": True,
        "a2a_recommended_use": (
            "Usable AQ signal; correlate with geography — station spacing and uptime vary (e.g. Bagmati region)."
        ),
    },
    "rapidapi_weather_air_quality": {
        "provider_name": "RapidAPI weather proxy (WeatherAPI-compatible JSON path)",
        "confidence_score": 0.58,
        "confidence_tier": "medium_low",
        "deployment_role": "resolver_fallback_air_quality",
        "confidence_basis": "heuristic_third_chain_fallback_http_marketplace",
        "a2a_usable_as_primary_measurement": True,
        "a2a_recommended_use": (
            "Use when WeatherAPI/WAQI failed only; disclose fallback; watch HTTP 429/403 from RapidAPI quotas."
        ),
    },
    "rapidapi_weather": {
        "provider_name": "RapidAPI weather proxy (current conditions)",
        "confidence_score": 0.65,
        "confidence_tier": "medium",
        "deployment_role": "alternate_current_weather",
        "confidence_basis": "heuristic_when_weatherapi_com_direct_key_unset",
        "a2a_usable_as_primary_measurement": False,
        "a2a_recommended_use": (
            "Supporting current weather path when WeatherAPI.com direct API key not configured; subscribe on RapidAPI."
        ),
    },
    "rapidapi_open_weather13": {
        "provider_name": "Open Weather 13 (RapidAPI five-day aggregate)",
        "confidence_score": 0.67,
        "confidence_tier": "medium",
        "deployment_role": "forecast_supplement",
        "confidence_basis": "heuristic_aggregate_forecast_upstream",
        "a2a_usable_as_primary_measurement": False,
        "a2a_recommended_use": "Multi-day trajectory context — not instantaneous roadside AQ observations.",
    },
    "rapidapi_meteostat_monthly": {
        "provider_name": "Meteostat via RapidAPI (monthly normals / series)",
        "confidence_score": 0.71,
        "confidence_tier": "medium",
        "deployment_role": "climate_time_series_archive",
        "confidence_basis": "heuristic_station_interpolation_archive",
        "a2a_usable_as_primary_measurement": False,
        "a2a_recommended_use": "Baseline climate variability — granularity is monthly at a lat/lon/altitude point.",
    },
    "openweathermap_current": {
        "provider_name": "OpenWeatherMap Current Weather API 2.5",
        "confidence_score": 0.7,
        "confidence_tier": "medium",
        "deployment_role": "supporting_cross_provider_weather",
        "confidence_basis": "heuristic_redundant_measurement_not_authoritative_when_weatherapi_primary_set",
        "a2a_usable_as_primary_measurement": False,
        "a2a_recommended_use": (
            "Good for disagreement checks vs WeatherAPI.com; do not silently replace headline product rules."
        ),
    },
    "openweathermap_air_pollution": {
        "provider_name": "OpenWeatherMap Air Pollution API 2.5",
        "confidence_score": 0.48,
        "confidence_tier": "low",
        "deployment_role": "cross_check_only_air",
        "confidence_basis": "heuristic_secondary_pollution_snapshot_not_resolver_chained_yet",
        "a2a_usable_as_primary_measurement": False,
        "a2a_recommended_use": (
            "Shadow PM/component read — contrast with WeatherAPI-first /api/air-quality/current when alerting."
        ),
    },
}


def integration_provenance_for_source(source_key: str) -> dict[str, Any]:
    """
    Stable provenance + confidence hints on JSON payloads (SPA, integrations, agent-to-agent tools).

    ``confidence.score`` (0–1) and ``confidence.tier`` reflect **routing stance / provider tier**, not
    formal measurement uncertainty intervals.
    """
    raw = INTEGRATION_SOURCE_PROVENANCE.get(source_key or "")
    if not raw:
        return {
            "source_key": source_key or "",
            "provider_name": "unlisted_integration",
            "confidence": {
                "score": 0.42,
                "tier": "low",
                "basis": "unknown_source_key",
            },
            "deployment_role": "unspecified",
            "a2a": {
                "usable_as_primary_measurement": False,
                "recommended_use": (
                    "Map this ``source_key`` in INTEGRATION_SOURCE_PROVENANCE if it represents a governed first-party source."
                ),
            },
        }
    return {
        "source_key": source_key,
        "provider_name": raw["provider_name"],
        "confidence": {
            "score": raw["confidence_score"],
            "tier": raw["confidence_tier"],
            "basis": raw["confidence_basis"],
        },
        "deployment_role": raw["deployment_role"],
        "a2a": {
            "usable_as_primary_measurement": raw["a2a_usable_as_primary_measurement"],
            "recommended_use": raw["a2a_recommended_use"],
        },
    }


class AirQualityError(Exception):
    """All configured air-quality sources (WeatherAPI / WAQI / Rapid) failed."""


class HeatCurrentError(Exception):
    """No configured weather upstream returned usable current temperature."""

def _numeric_simple(obj: dict[str, Any], key: str) -> float | None:
    """Parse a numeric field from ``obj[key]`` (int/float/str)."""
    if not isinstance(obj, dict):
        return None
    cur = obj.get(key)
    if isinstance(cur, (int, float)) and cur == cur:
        return float(cur)
    if isinstance(cur, str):
        try:
            v = float(cur.strip())
        except ValueError:
            return None
        return v if v == v else None
    return None


def _normalize_heat_blob_from_weatherapi_style(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Parse WeatherAPI-compatible ``current.json`` bodies (direct or Rapid host)."""
    cur = raw.get("current") if isinstance(raw.get("current"), dict) else None
    if not isinstance(cur, dict):
        return None

    tc = _numeric_simple(cur, "temp_c") or _numeric_simple(cur, "temp")
    if tc is None:
        return None
    fl = _numeric_simple(cur, "feelslike_c") or _numeric_simple(cur, "feelslike")
    humid = cur.get("humidity")
    h_int: int | None = None
    if isinstance(humid, (int, float)) and humid == humid:
        h_int = int(round(float(humid)))

    wx_text = ""
    cond = cur.get("condition")
    if isinstance(cond, dict) and isinstance(cond.get("text"), str):
        wx_text = cond["text"].strip()

    eff = max(tc, fl if fl is not None else tc)

    return {
        "temp_c": round(tc, 1),
        "feelslike_c": round(fl, 1) if fl is not None else None,
        "effective_temp_c": round(eff, 1),
        "humidity_pct": h_int,
        "wind_kph": _numeric_simple(cur, "wind_kph"),
        "condition_text": wx_text or None,
        "advisory_basis": (
            "current_conditions_snapshot—not daily_max; UNICEF cites ~35°C sustained heat;"
            " tighten thresholds via env with local partners."
        ),
    }


def _normalize_heat_blob_from_openweather(raw: dict[str, Any]) -> dict[str, Any] | None:
    main = raw.get("main") if isinstance(raw.get("main"), dict) else None
    if not isinstance(main, dict):
        return None
    tc = _numeric_simple(main, "temp")
    if tc is None:
        return None
    fl = _numeric_simple(main, "feels_like")

    humid = main.get("humidity")
    h_int: int | None = None
    if isinstance(humid, (int, float)) and humid == humid:
        h_int = int(round(float(humid)))

    wx_text = ""
    w0 = raw.get("weather")
    if isinstance(w0, list) and w0:
        wt = w0[0]
        if isinstance(wt, dict) and isinstance(wt.get("description"), str):
            wx_text = wt["description"].strip()

    eff = max(tc, fl if fl is not None else tc)

    return {
        "temp_c": round(tc, 1),
        "feelslike_c": round(fl, 1) if fl is not None else None,
        "effective_temp_c": round(eff, 1),
        "humidity_pct": h_int,
        "wind_kph": None,
        "condition_text": wx_text or None,
        "advisory_basis": (
            "openweathermap_current—not daily_max; align operational thresholds locally."
        ),
    }


async def heat_current_preferred(
    *,
    lat: float,
    lon: float,
    location_label: str | None = None,
    timeout_s: float = 25.0,
) -> tuple[str, dict[str, Any]]:
    """
    Current heat-relevant readings (prefer WeatherAPI.com direct → Rapid WeatherAPI‑style JSON → OpenWeather).

    Returns ``(source, heat_blob)`` with ``effective_temp_c = max(temp_c, feelslike_c)``.
    """
    errors: list[str] = []

    if weatherapi_com_api_key():
        try:
            raw = await weatherapi_com_current(lat=lat, lon=lon, timeout_s=timeout_s)
            blob = _normalize_heat_blob_from_weatherapi_style(raw)
            if blob:
                return "weatherapi_com", blob
            errors.append("weatherapi_com:no_current_temperature")
        except ValueError as exc:
            errors.append(f"weatherapi_com:{exc}")
        except httpx.HTTPStatusError as exc:
            errors.append(f"weatherapi_http_{exc.response.status_code}")
        except httpx.RequestError as exc:
            errors.append(f"weatherapi_network:{exc!s}"[:200])

    key, host, path = rapidapi_weather_credentials()
    if key and host:
        try:
            raw = await rapidapi_weather_current(
                lat=lat, lon=lon, location_label=location_label, timeout_s=timeout_s
            )
            blob = _normalize_heat_blob_from_weatherapi_style(raw)
            if blob:
                return "rapidapi_weather", blob
            errors.append("rapidapi:no_current_temperature")
        except ValueError as exc:
            errors.append(f"rapidapi:{exc}")
        except httpx.HTTPStatusError as exc:
            errors.append(f"rapidapi_http_{exc.response.status_code}")
        except httpx.RequestError as exc:
            errors.append(f"rapidapi_network:{exc!s}"[:200])
    else:
        errors.append("rapid:not_configured")

    owk = openweathermap_api_key()
    if owk:
        try:
            raw = await openweathermap_current_weather(
                lat=lat, lon=lon, timeout_s=timeout_s
            )
            blob = _normalize_heat_blob_from_openweather(raw)
            if blob:
                return "openweathermap_current", blob
            errors.append("openweathermap:no_main_temp")
        except ValueError as exc:
            errors.append(f"openweathermap:{exc}")
        except httpx.HTTPStatusError as exc:
            errors.append(f"openweather_http_{exc.response.status_code}")
        except httpx.RequestError as exc:
            errors.append(f"openweather_network:{exc!s}"[:200])
    else:
        errors.append("openweathermap:not_configured")

    raise HeatCurrentError("; ".join(errors) if errors else "unavailable")


async def air_quality_current_waqi_then_rapid(
    *,
    lat: float,
    lon: float,
    waqi_city_fallback: str | None = None,
    waqi_timeout_s: float = 15.0,
    rapid_timeout_s: float = 25.0,
) -> tuple[str, dict[str, Any]]:
    """
    Resolve current air readings (paid WeatherAPI preferred when configured):

    1. **WeatherAPI.com direct** — when ``WEATHERAPI_COM_API_KEY`` is set (``api.weatherapi.com/v1/current.json``).
    2. **WAQI** — geo feed, then optional keyword fallback.
    3. **RapidAPI** — ``rapidapi_weather_current`` (proxy / other products).

    Returns ``(source, payload)`` where source is ``weatherapi_com``, ``waqi``, or ``rapidapi_weather_air_quality``.
    """
    errors: list[str] = []

    wai = weatherapi_com_api_key()
    if wai:
        try:
            raw = await weatherapi_com_current(
                lat=lat,
                lon=lon,
                timeout_s=rapid_timeout_s,
            )
            norm = _normalize_rapid_weather_air_quality(
                raw, station_fallback=waqi_city_fallback
            )
            if norm is not None:
                return "weatherapi_com", norm
            errors.append("weatherapi_com:no_air_quality_block")
        except ValueError as exc:
            errors.append(f"weatherapi_com:{exc}")
        except httpx.HTTPStatusError as exc:
            snippet = ""
            try:
                snippet = (exc.response.text or "")[:300]
            except Exception:  # noqa: BLE001
                snippet = ""
            errors.append(f"weatherapi_com_http_{exc.response.status_code}:{snippet}")
            logger.warning(
                "WeatherAPI.com HTTP %s lat=%s lon=%s",
                exc.response.status_code,
                lat,
                lon,
            )
        except httpx.RequestError as exc:
            errors.append(f"weatherapi_com_network:{exc!s}"[:200])
            logger.warning("WeatherAPI.com request failed: %s", exc)

    wtok = waqi_api_token()
    placeholder = bool(wtok) and _looks_like_placeholder_waqi_token(wtok)
    waqi_live = bool(wtok) and not placeholder

    if waqi_live:
        try:
            body = await waqi_feed_geo(lat=lat, lon=lon, timeout_s=waqi_timeout_s)
            norm = _normalize_waqi_payload(body)
            if norm is not None:
                return "waqi", norm
            if waqi_city_fallback:
                try:
                    kbody = await waqi_feed_keyword(
                        keyword=waqi_city_fallback, timeout_s=waqi_timeout_s
                    )
                    knorm = _normalize_waqi_payload(kbody)
                    if knorm is not None:
                        return "waqi", knorm
                    err_kw = kbody.get("data")
                    errors.append(f"waqi_keyword_unusable:{err_kw!s}"[:220])
                except ValueError as kexc:
                    errors.append(f"waqi_keyword:{kexc}")
                except httpx.HTTPStatusError as kexc:
                    errors.append(f"waqi_keyword_http_{kexc.response.status_code}")
                except httpx.RequestError as kexc:
                    errors.append(f"waqi_keyword_network:{kexc!s}"[:200])

            err = body.get("data")
            errors.append(f"waqi_geo_unusable:{err!s}"[:240])
        except ValueError as exc:
            errors.append(f"waqi:{exc}")
        except httpx.HTTPStatusError as exc:
            snippet = ""
            try:
                snippet = (exc.response.text or "")[:300]
            except Exception:  # noqa: BLE001
                snippet = ""
            errors.append(f"waqi_http_{exc.response.status_code}:{snippet}")
            logger.warning("WAQI HTTP %s lat=%s lon=%s", exc.response.status_code, lat, lon)
        except httpx.RequestError as exc:
            errors.append(f"waqi_network:{exc!s}"[:200])
            logger.warning("WAQI request failed: %s", exc)
    elif placeholder:
        errors.append(
            "waqi:WAQI_TOKEN_still_placeholder_replace_with_real_token_from_https://aqicn.org/api/"
        )
    else:
        errors.append("waqi:not_configured")

    api_key, host, path = rapidapi_weather_credentials()
    if api_key and host:
        try:
            raw = await rapidapi_weather_current(
                lat=lat,
                lon=lon,
                location_label=waqi_city_fallback,
                timeout_s=rapid_timeout_s,
            )
            norm = _normalize_rapid_weather_air_quality(
                raw, station_fallback=waqi_city_fallback
            )
            if norm is not None:
                return "rapidapi_weather_air_quality", norm
            errors.append("rapid:no_air_quality_block")
        except ValueError as exc:
            errors.append(f"rapid:{exc}")
        except httpx.HTTPStatusError as exc:
            errors.append(f"rapid_http_{exc.response.status_code}")
            logger.warning(
                "RapidAPI weather (air quality fallback) HTTP %s",
                exc.response.status_code,
            )
        except httpx.RequestError as exc:
            errors.append(f"rapid_network:{exc!s}"[:200])
            logger.warning("RapidAPI weather fallback failed: %s", exc)
    else:
        errors.append("rapid:not_configured")

    raise AirQualityError("; ".join(errors) if errors else "unavailable")


def openrouter_api_key() -> str:
    key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if not key:
        return ""
    upper = key.upper()
    # Common .env placeholders must not count as configured
    if (
        upper.startswith("PASTE")
        or "YOUR_OPENROUTER" in upper
        or "YOUR_API_KEY" in upper
        or upper in {"CHANGEME", "XXX", "NONE", "NULL", "TODO", "REPLACE_ME"}
    ):
        return ""
    return key


def weatherapi_com_api_key() -> str:
    """API key from https://www.weatherapi.com/ (not the RapidAPI proxy key unless it is one and the same)."""
    return (
        (os.getenv("WEATHERAPI_COM_API_KEY") or "").strip()
        or (os.getenv("WEATHERAPI_API_KEY") or "").strip()
    )


def integrations_weatherapi_com_configured() -> bool:
    return bool(weatherapi_com_api_key())


def openweathermap_api_key() -> str:
    """https://openweathermap.org/api — Current Weather + Air Pollution 2.5."""
    return (
        (os.getenv("OPENWEATHER_API_KEY") or "").strip()
        or (os.getenv("OPENWEATHERMAP_API_KEY") or "").strip()
    )


def openweathermap_data25_base_url() -> str:
    raw = (os.getenv("OPENWEATHERMAP_API_BASE_URL") or "").strip().rstrip("/")
    return raw or OPENWEATHERMAP_DATA25_DEFAULT


def integrations_openweathermap_configured() -> bool:
    return bool(openweathermap_api_key())


def rapidapi_weather_credentials() -> tuple[str, str, str]:
    """Returns (api_key, host, path_prefix). Path is RapidAPI-relative path."""
    key = (
        os.getenv("RAPIDAPI_WEATHER_API_KEY")
        or os.getenv("RapidAPI_Weather_API_Key")
        or ""
    ).strip()
    host = (os.getenv("RAPIDAPI_WEATHER_HOST") or "").strip()
    path = (os.getenv("RAPIDAPI_WEATHER_PATH") or "/current.json").strip()
    if not path.startswith("/"):
        path = "/" + path
    return key, host, path


def rapidapi_open_weather13_credentials() -> tuple[str, str, str]:
    """
    Open Weather 13 on RapidAPI — ``GET /fivedaysforcast`` (upstream spelling).

    Key: ``RAPIDAPI_OPENWEATHER13_API_KEY``, or falls back to ``RAPIDAPI_WEATHER_API_KEY``.
    """
    dedicated = (os.getenv("RAPIDAPI_OPENWEATHER13_API_KEY") or "").strip()
    shared_k, _, _ = rapidapi_weather_credentials()
    key = dedicated or shared_k
    host = (os.getenv("RAPIDAPI_OPENWEATHER13_HOST") or "").strip() or "open-weather13.p.rapidapi.com"
    path = (os.getenv("RAPIDAPI_OPENWEATHER13_PATH") or "/fivedaysforcast").strip()
    if not path.startswith("/"):
        path = "/" + path
    return key, host, path


def integrations_open_weather13_configured() -> bool:
    k, _, h = rapidapi_open_weather13_credentials()
    return bool(k and h)


def integrations_public_status() -> dict[str, Any]:
    k_weather, host, path = rapidapi_weather_credentials()
    m_host = (os.getenv("RAPIDAPI_METEOSTAT_HOST") or host).strip()
    m_path = (os.getenv("RAPIDAPI_METEOSTAT_PATH") or "/point/monthly").strip()
    try:
        lim = int((os.getenv("RAPIDAPI_CONCURRENCY_LIMIT") or "2").strip())
    except ValueError:
        lim = 2
    lim = max(1, min(32, lim))
    try:
        aq_cache = float((os.getenv("AIR_QUALITY_COORD_CACHE_SECONDS") or "120").strip())
    except ValueError:
        aq_cache = 120.0
    aq_cache = max(0.0, min(900.0, aq_cache))
    mode = (
        os.getenv("RAPIDAPI_WEATHER_QUERY_MODE") or "q"
    ).strip().lower()
    if mode not in {"q", "latlon", "city"}:
        mode = "q"
    try:
        from twilio_notify import twilio_configured as _twilio_configured

        twilio_ready = bool(_twilio_configured())
    except Exception:
        twilio_ready = False
    return {
        "openrouter_configured": bool(openrouter_api_key()),
        "rapidapi_weather_configured": bool(k_weather and host),
        "rapidapi_weather_host_set": bool(host),
        "rapidapi_meteostat_configured": bool(k_weather and m_host),
        "waqi_configured": integrations_waqi_configured(),
        "rapidapi_weather_query_mode": mode,
        "rapidapi_air_current_concurrency": lim,
        "air_quality_coord_cache_seconds": aq_cache,
        "rapidapi_openweather13_configured": integrations_open_weather13_configured(),
        "weatherapi_com_direct_configured": integrations_weatherapi_com_configured(),
        "openweathermap_configured": integrations_openweathermap_configured(),
        "twilio_configured": twilio_ready,
    }


async def openrouter_chat(
    *,
    user_message: str,
    system_message: str | None = None,
    model: str | None = None,
    timeout_s: float = 60.0,
) -> dict[str, Any]:
    key = openrouter_api_key()
    if not key:
        raise ValueError("OPENROUTER_API_KEY is not set")

    mdl = (
        model
        or (os.getenv("OPENROUTER_MODEL") or "").strip()
        or "openai/gpt-4o-mini"
    )
    referer = (os.getenv("OPENROUTER_HTTP_REFERER") or "").strip() or None
    title = (os.getenv("OPENROUTER_APP_TITLE") or "Climate Compass").strip()

    messages: list[dict[str, str]] = []
    if system_message:
        messages.append({"role": "system", "content": system_message})
    messages.append({"role": "user", "content": user_message})

    headers: dict[str, str] = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if referer:
        headers["HTTP-Referer"] = referer
        headers["X-Title"] = title

    payload = {"model": mdl, "messages": messages}

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        r = await client.post(OPENROUTER_URL, headers=headers, json=payload)
        r.raise_for_status()
        return r.json()


async def rapidapi_weather_current(
    *,
    lat: float,
    lon: float,
    location_label: str | None = None,
    timeout_s: float = 25.0,
) -> dict[str, Any]:
    """
    Forward current-weather lookup to RapidAPI.

    Modes via ``RAPIDAPI_WEATHER_QUERY_MODE``:

    - ``q`` (default): WeatherAPI-com style ``q=lat,lon`` plus ``aqi=yes`` when enabled.
    - ``latlon``: ``lat`` / ``lon`` query parameters instead of ``q``.
    - ``city``: ``GET https://{host}{path}/{encodedCity}`` (e.g. host
      ``weather-api-by-any-city.p.rapidapi.com``, ``RAPIDAPI_WEATHER_PATH=/weather``
      ⇒ ``/weather/London``). Requires ``location_label``.
    """
    api_key, host, path = rapidapi_weather_credentials()
    if not api_key or not host:
        raise ValueError(
            "Set RAPIDAPI_WEATHER_API_KEY and RAPIDAPI_WEATHER_HOST "
            "(e.g. weatherapi-com.p.rapidapi.com). Optional env alias: RapidAPI_Weather_API_Key."
        )

    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": host,
    }

    mode = (os.getenv("RAPIDAPI_WEATHER_QUERY_MODE") or "q").strip().lower()
    if mode not in {"q", "latlon", "city"}:
        mode = "q"

    if mode == "city":
        label = (location_label or "").strip()
        if not label:
            raise ValueError(
                "city-path RapidAPI weather requires location_label "
                '(use `/api/air-quality/current?city=YourCity` or `/api/weather/current?city=...`). '
                "Alternatively set RAPIDAPI_WEATHER_QUERY_MODE=q for lat/lon products."
            )
        path_trim = path.rstrip("/")
        seg = quote(label, safe="")
        url = f"https://{host.rstrip('/')}{path_trim}/{seg}"
        params: dict[str, Any] = {}
    else:
        if mode == "latlon":
            params = {"lat": lat, "lon": lon}
        else:
            params = {"q": f"{lat},{lon}"}

        aqi_flag = os.getenv("RAPIDAPI_WEATHER_AQI", "").strip().lower()
        if aqi_flag not in {"0", "false", "no", "off"}:
            params["aqi"] = "yes"

        url = f"https://{host}{path}"

    sem = _rapid_air_semaphore()
    async with sem:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            r = await client.get(
                url, headers=headers, params=params if params else None
            )
            r.raise_for_status()
            return r.json()


async def weatherapi_com_current(
    *,
    lat: float,
    lon: float,
    timeout_s: float = 25.0,
) -> dict[str, Any]:
    """
    WeatherAPI.com **direct** HTTP API — ``/v1/current.json`` with ``aqi=yes`` for ``current.air_quality``.
    Requires ``WEATHERAPI_COM_API_KEY`` (from the WeatherAPI dashboard, not RapidAPI headers).
    """
    key = weatherapi_com_api_key()
    if not key:
        raise ValueError(
            "Set WEATHERAPI_COM_API_KEY from https://www.weatherapi.com/ "
            "for direct current.json + air_quality."
        )
    url = f"{WEATHERAPI_COM_V1}/current.json"
    params: dict[str, Any] = {
        "key": key,
        "q": f"{lat},{lon}",
        "aqi": "yes",
    }

    sem = _rapid_air_semaphore()
    async with sem:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            return r.json()


async def openweathermap_current_weather(
    *,
    lat: float,
    lon: float,
    units: str = "metric",
    lang: str = "en",
    timeout_s: float = 25.0,
) -> dict[str, Any]:
    """
    OpenWeatherMap **direct** Current Weather API 2.5 — ``GET /weather`` (temperature, humidity, wind, …).
    ``OPENWEATHER_API_KEY`` (``appid`` query param).
    Supplementary to ``/api/weather/current`` when WeatherAPI.com is authoritative.
    """
    key = openweathermap_api_key()
    if not key:
        raise ValueError(
            "Set OPENWEATHER_API_KEY from https://openweathermap.org/api for OpenWeatherMap current weather."
        )
    base = openweathermap_data25_base_url()
    url = f"{base}/weather"
    units_q = (units or "metric").strip().lower()[:16] or "metric"
    lang_q = (lang or "en").strip().lower()[:16] or "en"
    params: dict[str, Any] = {
        "lat": lat,
        "lon": lon,
        "appid": key,
        "units": units_q,
        "lang": lang_q,
    }
    sem = _rapid_air_semaphore()
    async with sem:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            return r.json()


async def openweathermap_air_pollution(
    *,
    lat: float,
    lon: float,
    timeout_s: float = 25.0,
) -> dict[str, Any]:
    """
    OpenWeatherMap Air Pollution 2.5 — ``GET /air_pollution`` (hourly concentration components).
    For **cross-check only** ``/api/weather/current`` PM2.5 uses WeatherAPI.com first when configured.
    """
    key = openweathermap_api_key()
    if not key:
        raise ValueError(
            "Set OPENWEATHER_API_KEY from https://openweathermap.org/api for Air Pollution 2.5."
        )
    base = openweathermap_data25_base_url()
    url = f"{base}/air_pollution"
    params: dict[str, Any] = {"lat": lat, "lon": lon, "appid": key}
    sem = _rapid_air_semaphore()
    async with sem:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            return r.json()


async def rapidapi_open_weather13_fiveday(
    *,
    latitude: float,
    longitude: float,
    lang: str = "EN",
    timeout_s: float = 35.0,
) -> dict[str, Any]:
    """
    RapidAPI **Open Weather 13** — upstream path ``/fivedaysforcast`` with query params
    ``latitude``, ``longitude``, ``lang``.
    """
    api_key, host, path = rapidapi_open_weather13_credentials()
    if not api_key:
        raise ValueError(
            "Set RAPIDAPI_OPENWEATHER13_API_KEY or RAPIDAPI_WEATHER_API_KEY for Open Weather 13."
        )
    url = f"https://{host.rstrip('/')}{path}"
    lang_q = ((lang or "EN").strip() or "EN").upper()[:16]
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "lang": lang_q,
    }
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": host,
        "Content-Type": "application/json",
    }

    sem = _rapid_air_semaphore()
    async with sem:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            r = await client.get(url, headers=headers, params=params)
            r.raise_for_status()
            return r.json()


def rapidapi_key_and_meteostat_host() -> tuple[str, str]:
    """RapidAPI key + Meteostat host (dedicated METEOSTAT_HOST or shared WEATHER_HOST)."""
    key, weather_host, _ = rapidapi_weather_credentials()
    host = (
        os.getenv("RAPIDAPI_METEOSTAT_HOST") or weather_host or ""
    ).strip()
    return key, host


def meteostat_monthly_path() -> str:
    path = (os.getenv("RAPIDAPI_METEOSTAT_PATH") or "/point/monthly").strip()
    if not path.startswith("/"):
        path = "/" + path
    return path


async def rapidapi_meteostat_point_monthly(
    *,
    lat: float,
    lon: float,
    alt: int,
    start: str,
    end: str,
    timeout_s: float = 45.0,
) -> dict[str, Any]:
    """
    RapidAPI Meteostat — GET /point/monthly (historical monthly series at a lat/lon point).

    curl equivalent:
      curl -sG 'https://meteostat.p.rapidapi.com/point/monthly' \\
        --data-urlencode 'lat=..' --data-urlencode 'lon=..' ... \\
        -H 'x-rapidapi-host: meteostat.p.rapidapi.com' \\
        -H 'x-rapidapi-key: $KEY'
    """
    api_key, host = rapidapi_key_and_meteostat_host()
    path = meteostat_monthly_path()

    if not api_key or not host:
        raise ValueError(
            "Set RapidAPI key (RAPIDAPI_WEATHER_API_KEY or RapidAPI_Weather_API_Key) "
            "and METEOSTAT host: RAPIDAPI_METEOSTAT_HOST=meteostat.p.rapidapi.com "
            "(or RAPIDAPI_WEATHER_HOST if you only use Meteostat)."
        )

    url = f"https://{host}{path}"
    params: dict[str, Any] = {
        "lat": lat,
        "lon": lon,
        "alt": alt,
        "start": start,
        "end": end,
    }
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": host,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        r = await client.get(url, headers=headers, params=params)
        r.raise_for_status()
        return r.json()
