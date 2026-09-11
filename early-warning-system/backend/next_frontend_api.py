"""Public JSON contracts used by the Next.js frontend migration."""

from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable

from fastapi import APIRouter, HTTPException, Query

import guide_documents
from cities_config import CITIES_CONFIG

EndpointFetcher = Callable[..., Awaitable[dict[str, Any]]]

# Deliberately static: adding a Markdown file never publishes it accidentally.
PUBLIC_GUIDE_PATHS = (
    "README.md",
    "APPLICATION_OVERVIEW.md",
    "DATA_FETCHING.md",
    "DASHBOARD_FEATURES.md",
    "STUDENT_CLEAN_AIR_ACTIVITY.md",
    "TEACHER_CLEAN_AIR_LESSON.md",
    "PARENT_AIR_QUALITY_CHECKLIST.md",
    "SCHOOL_AIR_QUALITY_ACTION_GUIDE.md",
    "IMPLEMENTATION_SNAPSHOT.md",
    "CURSOR_SETUP_GUIDE.md",
    "PACKAGE_COMPLETE.md",
    "prompts.md",
    "LANDING_PAGE_GUIDE.md",
    "blockchain-ai/README.md",
    "blockchain-ai/INTEGRATION_GUIDE.md",
)

_AUDIENCE_BY_PATH = {
    "README.md": "Project users and contributors",
    "APPLICATION_OVERVIEW.md": "New users and implementers",
    "DATA_FETCHING.md": "Developers and operators",
    "DASHBOARD_FEATURES.md": "Operators and implementers",
    "STUDENT_CLEAN_AIR_ACTIVITY.md": "Students ages 10 and up",
    "TEACHER_CLEAN_AIR_LESSON.md": "Teachers of grades 6–8",
    "PARENT_AIR_QUALITY_CHECKLIST.md": "Parents and caregivers",
    "SCHOOL_AIR_QUALITY_ACTION_GUIDE.md": "Teachers and school administrators",
    "IMPLEMENTATION_SNAPSHOT.md": "Developers and operators",
    "CURSOR_SETUP_GUIDE.md": "Developers",
    "PACKAGE_COMPLETE.md": "Developers and evaluators",
    "prompts.md": "AI-agent developers",
    "LANDING_PAGE_GUIDE.md": "Frontend developers",
    "blockchain-ai/README.md": "Blockchain integrators",
    "blockchain-ai/INTEGRATION_GUIDE.md": "Blockchain integrators",
}

_DEV_CORS_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "capacitor://localhost",
    "ionic://localhost",
)


def cors_allowed_origins() -> list[str]:
    """Resolve explicit browser origins; native HTTP clients do not require CORS."""
    configured = (os.getenv("CORS_ALLOWED_ORIGINS") or "").strip()
    if configured:
        origins = [item.strip().rstrip("/") for item in configured.split(",") if item.strip()]
        return list(dict.fromkeys(origin for origin in origins if origin != "*"))
    environment = (os.getenv("ENVIRONMENT") or "development").strip().lower()
    if environment in {"development", "dev", "local", "test"}:
        return list(_DEV_CORS_ORIGINS)
    return []


def _slug_for_path(filepath: str) -> str:
    without_suffix = filepath[:-3] if filepath.lower().endswith(".md") else filepath
    return re.sub(r"[^a-z0-9]+", "-", without_suffix.lower()).strip("-")


def _plain_markdown(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[`*_>#]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _summary_from_markdown(markdown: str) -> str | None:
    paragraphs = re.split(r"\n\s*\n", markdown.lstrip("\ufeff"))
    for paragraph in paragraphs:
        stripped = paragraph.strip()
        if (
            not stripped
            or stripped.startswith("#")
            or stripped.startswith("|")
            or stripped.startswith("- ")
            or stripped.startswith("* ")
            or re.match(r"^\d+\.\s", stripped)
        ):
            continue
        plain = _plain_markdown(stripped)
        if plain and not plain.lower().startswith(("for students", "for teachers", "a quick guide for", "a planning aid for")):
            return plain[:320]
    return None


def _guide_metadata(filepath: str, markdown: str) -> dict[str, Any]:
    fallback = Path(filepath).stem.replace("_", " ")
    return {
        "path": filepath,
        "slug": _slug_for_path(filepath),
        "title": guide_documents.derive_title(markdown, fallback=fallback),
        "summary": _summary_from_markdown(markdown),
        "audience": _AUDIENCE_BY_PATH.get(filepath),
    }


def _read_public_guide(filepath: str) -> tuple[Path, str]:
    normalized = (filepath or "").strip().replace("\\", "/").lstrip("/")
    if normalized not in PUBLIC_GUIDE_PATHS:
        raise HTTPException(status_code=404, detail="Guide not found")
    full_path = guide_documents.safe_markdown_under(
        guide_documents.GUIDES_MARKDOWN_ROOT, normalized
    )
    if full_path is None:
        raise HTTPException(status_code=404, detail="Guide not found")
    return full_path, full_path.read_text(encoding="utf-8")


def list_public_guides() -> list[dict[str, Any]]:
    guides: list[dict[str, Any]] = []
    for filepath in PUBLIC_GUIDE_PATHS:
        try:
            _, markdown = _read_public_guide(filepath)
        except HTTPException:
            continue
        guides.append(_guide_metadata(filepath, markdown))
    return guides


def _overview_concurrency() -> int:
    try:
        value = int((os.getenv("ENVIRONMENT_OVERVIEW_CONCURRENCY") or "2").strip())
    except ValueError:
        value = 2
    return max(1, min(8, value))


def _overview_timeout_seconds() -> float:
    try:
        value = float((os.getenv("ENVIRONMENT_OVERVIEW_TIMEOUT_SECONDS") or "35").strip())
    except ValueError:
        value = 35.0
    return max(5.0, min(60.0, value))


def _error_detail(exc: BaseException) -> str:
    if isinstance(exc, HTTPException):
        detail = exc.detail
    else:
        detail = str(exc)
    return str(detail or exc.__class__.__name__)[:300]


async def build_environment_overview(
    air_fetcher: EndpointFetcher,
    heat_fetcher: EndpointFetcher,
) -> dict[str, Any]:
    """Aggregate existing endpoint contracts without duplicating provider logic."""
    semaphore = asyncio.Semaphore(_overview_concurrency())
    timeout = _overview_timeout_seconds()

    async def call(fetcher: EndpointFetcher, city: str) -> dict[str, Any]:
        async with semaphore:
            return await asyncio.wait_for(
                fetcher(city=city, lat=None, lon=None),
                timeout=timeout,
            )

    async def city_overview(city: str, config: dict[str, Any]) -> dict[str, Any]:
        air_result, heat_result = await asyncio.gather(
            call(air_fetcher, city),
            call(heat_fetcher, city),
            return_exceptions=True,
        )

        if isinstance(air_result, BaseException):
            air = {
                "status": "error",
                "pm25_ug_m3": None,
                "aqi": None,
                "source": None,
                "observed_at": None,
                "provenance": None,
                "error": _error_detail(air_result),
            }
        else:
            payload = air_result.get("air_quality") or {}
            air = {
                "status": "ok",
                "pm25_ug_m3": payload.get("pm25_ug_m3"),
                "aqi": payload.get("aqi"),
                "source": air_result.get("source"),
                "observed_at": payload.get("observed_at"),
                "provenance": air_result.get("provenance"),
                "error": None,
            }

        if isinstance(heat_result, BaseException):
            heat = {
                "status": "error",
                "temp_c": None,
                "effective_temp_c": None,
                "level": None,
                "source": None,
                "observed_at": None,
                "provenance": None,
                "error": _error_detail(heat_result),
            }
        else:
            payload = heat_result.get("heat") or {}
            heat = {
                "status": "ok",
                "temp_c": payload.get("temp_c"),
                "effective_temp_c": payload.get("effective_temp_c"),
                "level": heat_result.get("heat_level"),
                "source": heat_result.get("source"),
                "observed_at": payload.get("observed_at"),
                "provenance": heat_result.get("provenance"),
                "error": None,
            }

        ok_count = int(air["status"] == "ok") + int(heat["status"] == "ok")
        return {
            "city": city,
            "lat": float(config["lat"]),
            "lon": float(config["lon"]),
            "province": config.get("province") or "Bagmati",
            "status": "ok" if ok_count == 2 else ("partial" if ok_count else "error"),
            "air_quality": air,
            "heat": heat,
        }

    configured_cities = list(CITIES_CONFIG.items())
    city_results = await asyncio.gather(
        *(city_overview(city, config) for city, config in configured_cities),
        return_exceptions=True,
    )
    cities: list[dict[str, Any]] = []
    for (city, config), result in zip(configured_cities, city_results):
        if not isinstance(result, BaseException):
            cities.append(result)
            continue
        error = _error_detail(result)
        unavailable = {
            "status": "error",
            "source": None,
            "observed_at": None,
            "provenance": None,
            "error": error,
        }
        cities.append(
            {
                "city": city,
                "lat": float(config["lat"]),
                "lon": float(config["lon"]),
                "province": config.get("province") or "Bagmati",
                "status": "error",
                "air_quality": {
                    **unavailable,
                    "pm25_ug_m3": None,
                    "aqi": None,
                },
                "heat": {
                    **unavailable,
                    "temp_c": None,
                    "effective_temp_c": None,
                    "level": None,
                },
            }
        )
    ok_count = sum(city["status"] == "ok" for city in cities)
    error_count = sum(city["status"] == "error" for city in cities)
    overall = "ok" if ok_count == len(cities) else ("error" if error_count == len(cities) else "partial")
    return {
        "status": overall,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "count": len(cities),
        "cities": cities,
    }


def create_router(
    *,
    air_fetcher: EndpointFetcher,
    heat_fetcher: EndpointFetcher,
) -> APIRouter:
    router = APIRouter(tags=["Next frontend"])

    @router.get("/api/guides")
    async def guides_index() -> dict[str, Any]:
        guides = list_public_guides()
        return {"count": len(guides), "guides": guides}

    @router.get("/api/guides/{filepath:path}")
    async def guide_detail(
        filepath: str,
        include_markdown: bool = Query(
            False, description="Include the original allowlisted Markdown source."
        ),
    ) -> dict[str, Any]:
        _, markdown = _read_public_guide(filepath)
        response = {
            **_guide_metadata(filepath, markdown),
            "html": guide_documents.markdown_to_html_fragment(markdown),
        }
        if include_markdown:
            response["markdown"] = markdown
        return response

    @router.get("/api/environment/overview")
    async def environment_overview() -> dict[str, Any]:
        return await build_environment_overview(air_fetcher, heat_fetcher)

    return router
