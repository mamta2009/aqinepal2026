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
        "aqicn_station_uid": "H14868",
    },
    "Lalitpur": {
        "lat": 27.6760,
        "lon": 85.3200,
        "elevation": 1290,
        "population": 500000,
        "hospitals": 8,
        "aqicn_station_uid": "H10495",
    },
    "Bhaktapur": {"lat": 27.6732, "lon": 85.4305, "elevation": 1401, "population": 300000, "hospitals": 5},
    "Banepa": {"lat": 27.6600, "lon": 85.5100, "elevation": 1220, "population": 80000, "hospitals": 3},
    "Dhulikhel": {"lat": 27.6167, "lon": 85.4333, "elevation": 1550, "population": 50000, "hospitals": 2},
    "Hetauda": {"lat": 27.4196, "lon": 85.1333, "elevation": 610, "population": 150000, "hospitals": 4},
    "Bharatpur": {"lat": 27.7021, "lon": 84.4329, "elevation": 234, "population": 200000, "hospitals": 6},
    "Narayanghad": {"lat": 27.3333, "lon": 84.9167, "elevation": 300, "population": 100000, "hospitals": 3},
}
