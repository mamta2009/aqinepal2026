"""Unit tests for WAQI station picking and payload normalization."""

from __future__ import annotations

import unittest

import external_integrations as ei


class WaqiNormalizeTests(unittest.TestCase):
    def test_feed_payload_does_not_treat_iaqi_as_ug_m3(self) -> None:
        body = {
            "status": "ok",
            "data": {
                "aqi": 63,
                "dominentpol": "pm25",
                "iaqi": {"pm25": {"v": 63}},
                "city": {"name": "Pulchowk, Kathmandu, Nepal"},
                "time": {"s": "2026-09-11 10:00:00"},
            },
        }
        norm = ei._normalize_waqi_payload(body)
        assert norm is not None
        self.assertEqual(norm["aqi"], 63)
        self.assertIsNone(norm["pm25_ug_m3"])
        self.assertEqual(norm["station_name"], "Pulchowk, Kathmandu, Nepal")

    def test_pick_median_nearby_stations(self) -> None:
        rows = [
            {"aqi": 17, "lat": 27.732825, "lon": 85.342826, "station_name": "Shankapark"},
            {"aqi": 63, "lat": 27.682581, "lon": 85.318841, "station_name": "Pulchowk"},
            {"aqi": 58, "lat": 27.681719, "lon": 85.289313, "station_name": "TU"},
            {"aqi": 60, "lat": 27.65311, "lon": 85.302252, "station_name": "Bhaisipati"},
        ]
        picked = ei._pick_waqi_area_reading(
            rows, lat=27.7172, lon=85.3240, radius_km=30.0
        )
        assert picked is not None
        # Sorted AQIs: 17, 58, 60, 63 → median index len//2 = 60
        self.assertEqual(picked["aqi"], 60)
        self.assertEqual(picked["station_count"], 4)
        self.assertIsNone(picked["pm25_ug_m3"])

    def test_map_rows_skip_dash_aqi(self) -> None:
        body = {
            "status": "ok",
            "data": [
                {
                    "lat": 27.7,
                    "lon": 85.3,
                    "uid": 1,
                    "aqi": "-",
                    "station": {"name": "Offline"},
                },
                {
                    "lat": 27.68,
                    "lon": 85.32,
                    "uid": 2,
                    "aqi": "55",
                    "station": {"name": "Live", "time": "2026-09-11T10:00:00+05:45"},
                },
            ],
        }
        rows = ei._station_rows_from_waqi_map(body)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["aqi"], 55)


if __name__ == "__main__":
    unittest.main()
