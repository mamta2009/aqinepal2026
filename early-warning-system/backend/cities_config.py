"""Configured municipalities for demos and air-quality resolution (single source of truth).

Optional per-city ``aqicn_station_uid`` (WAQI / AQICN station id) improves persisted snapshot sync
when ``AQ_SNAPSHOT_SYNC_ENABLED`` is true; live ``GET /api/air-quality/current`` is unchanged.
"""

from __future__ import annotations

from typing import Any

CITIES_CONFIG: dict[str, dict[str, Any]] = {
    "Kathmandu": {
        "lat": 27.7172,
        "lon": 85.3240,
        "elevation": 1337,
        "population": 1500000,
        "hospitals": 15,
        "province": "Bagmati",
        "aqicn_station_uid": "H14868",
    },
    "Pokhara": {
        "lat": 28.2096,
        "lon": 83.9856,
        "elevation": 822,
        "population": 500000,
        "hospitals": 8,
        "province": "Gandaki",
    },
    "Bharatpur": {
        "lat": 27.7021,
        "lon": 84.4329,
        "elevation": 234,
        "population": 200000,
        "hospitals": 6,
        "province": "Bagmati",
    },
    "Birgunj": {
        "lat": 27.0104,
        "lon": 84.8770,
        "elevation": 86,
        "population": 240000,
        "hospitals": 5,
        "province": "Madhesh",
    },
    "Biratnagar": {
        "lat": 26.4525,
        "lon": 87.2718,
        "elevation": 72,
        "population": 240000,
        "hospitals": 6,
        "province": "Koshi",
    },
    "Janakpur": {
        "lat": 26.7288,
        "lon": 85.9263,
        "elevation": 74,
        "population": 160000,
        "hospitals": 4,
        "province": "Madhesh",
    },
    "Nepalgunj": {
        "lat": 28.05,
        "lon": 81.6167,
        "elevation": 150,
        "population": 140000,
        "hospitals": 4,
        "province": "Lumbini",
    },
    "Dhangadhi": {
        "lat": 28.6852,
        "lon": 80.6216,
        "elevation": 109,
        "population": 150000,
        "hospitals": 4,
        "province": "Sudurpashchim",
    },
}
