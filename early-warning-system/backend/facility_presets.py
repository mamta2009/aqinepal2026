"""Illustrative facility / site name suggestions by municipality key (``CITIES_CONFIG`` names).

Used for registration UX only: helps people type recognizable local names. Lists are **not**
authoritative, complete, or verified — partners can extend or replace over time.
"""

from __future__ import annotations

# Keys must match ``cities_config.CITIES_CONFIG`` exactly.
FACILITY_PRESETS_BY_CITY: dict[str, list[str]] = {
    "Kathmandu": [
        "Tribhuvan University Teaching Hospital (TUTH)",
        "Bir Hospital",
        "Patan Hospital (Lagankhel)",
        "Kanti Children's Hospital",
        "Shukraraj Tropical & Infectious Disease Hospital (Teku)",
        "Municipal public health unit / ward clinic",
    ],
    "Pokhara": [
        "Manipal Teaching Hospital",
        "Western Regional Hospital (Pokhara)",
        "Gandaki Medical College Teaching Hospital",
        "Municipal health post / ward clinic",
    ],
    "Bharatpur": [
        "Bharatpur Hospital",
        "College of Medical Sciences Teaching Hospital",
        "Chitwan Medical College Teaching Hospital",
        "Municipal health post / ward clinic",
    ],
    "Birgunj": [
        "Narayani Sub-Regional Hospital",
        "National Medical College Teaching Hospital",
        "Municipal health post / ward clinic",
    ],
    "Biratnagar": [
        "Koshi Hospital",
        "Nobel Medical College Teaching Hospital",
        "Municipal health post / ward clinic",
    ],
    "Janakpur": [
        "Provincial Hospital Janakpur",
        "Janaki Medical College Teaching Hospital",
        "Municipal health post / ward clinic",
    ],
    "Nepalgunj": [
        "Bheri Hospital",
        "Nepalgunj Medical College Teaching Hospital",
        "Municipal health post / ward clinic",
    ],
    "Dhangadhi": [
        "Seti Provincial Hospital",
        "Municipal health post / ward clinic",
        "Urban PHC / sub-health post",
    ],
}
