from __future__ import annotations

import asyncio
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import guide_documents  # noqa: E402
import next_frontend_api  # noqa: E402


class GuideApiHelpersTest(unittest.TestCase):
    def test_index_only_contains_allowlisted_safe_paths(self) -> None:
        guides = next_frontend_api.list_public_guides()
        self.assertTrue(guides)
        self.assertTrue(all(item["path"] in next_frontend_api.PUBLIC_GUIDE_PATHS for item in guides))
        self.assertTrue(all(".." not in item["path"] for item in guides))

    def test_markdown_html_removes_active_content(self) -> None:
        rendered = guide_documents.markdown_to_html_fragment(
            "# Safe\n\n<script>alert(1)</script>[bad](javascript:alert(1))"
        )
        self.assertNotIn("<script", rendered)
        self.assertNotIn("alert(1)", rendered)
        self.assertNotIn("javascript:", rendered)

    def test_unlisted_and_traversal_paths_are_not_public(self) -> None:
        for path in ("../README.md", "not-allowlisted.md"):
            with self.assertRaises(Exception) as context:
                next_frontend_api._read_public_guide(path)
            self.assertEqual(getattr(context.exception, "status_code", None), 404)

    def test_cors_is_explicit_and_production_safe(self) -> None:
        with patch.dict(
            os.environ,
            {"ENVIRONMENT": "production", "CORS_ALLOWED_ORIGINS": "*"},
            clear=False,
        ):
            self.assertEqual(next_frontend_api.cors_allowed_origins(), [])
        with patch.dict(
            os.environ,
            {
                "ENVIRONMENT": "production",
                "CORS_ALLOWED_ORIGINS": "https://app.example, https://admin.example/",
            },
            clear=False,
        ):
            self.assertEqual(
                next_frontend_api.cors_allowed_origins(),
                ["https://app.example", "https://admin.example"],
            )


class EnvironmentOverviewTest(unittest.IsolatedAsyncioTestCase):
    async def test_failures_are_per_city_and_concurrency_is_bounded(self) -> None:
        active = 0
        peak = 0
        lock = asyncio.Lock()

        async def enter() -> None:
            nonlocal active, peak
            async with lock:
                active += 1
                peak = max(peak, active)

        async def leave() -> None:
            nonlocal active
            async with lock:
                active -= 1

        async def air_fetcher(*, city: str, lat: None, lon: None):
            await enter()
            try:
                await asyncio.sleep(0.001)
                if city == "Banepa":
                    raise RuntimeError("provider unavailable")
                return {
                    "source": "test_air",
                    "provenance": {"provider_name": "test"},
                    "air_quality": {
                        "pm25_ug_m3": 12.5,
                        "aqi": 42,
                        "observed_at": "2026-08-04T00:00:00Z",
                    },
                }
            finally:
                await leave()

        async def heat_fetcher(*, city: str, lat: None, lon: None):
            await enter()
            try:
                await asyncio.sleep(0.001)
                return {
                    "source": "test_heat",
                    "provenance": {"provider_name": "test"},
                    "heat_level": "LOW",
                    "heat": {"temp_c": 24.0, "effective_temp_c": 25.0},
                }
            finally:
                await leave()

        with patch.dict(os.environ, {"ENVIRONMENT_OVERVIEW_CONCURRENCY": "2"}):
            result = await next_frontend_api.build_environment_overview(
                air_fetcher, heat_fetcher
            )

        self.assertEqual(result["count"], len(next_frontend_api.CITIES_CONFIG))
        self.assertLessEqual(peak, 2)
        banepa = next(city for city in result["cities"] if city["city"] == "Banepa")
        self.assertEqual(banepa["status"], "partial")
        self.assertEqual(banepa["air_quality"]["status"], "error")
        self.assertEqual(banepa["heat"]["status"], "ok")


if __name__ == "__main__":
    unittest.main()
