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
    "Lalitpur": [
        "Patan Academy of Health Sciences (PAHS)",
        "Kist Medical College Hospital",
        "Alka Hospital",
        "Lalitpur Metropolitan Hospital / district hospital",
        "Ward health post / municipal clinic (Lalitpur)",
        "Urban PHC / sub-health post",
    ],
    "Bhaktapur": [
        "Bhaktapur Cancer Hospital",
        "Madhyapur Hospital",
        "Bhaktapur municipal health post / ward clinic",
    ],
    "Banepa": [
        "Dhulikhel Hospital (referral — nearby)",
        "Banepa municipal health post",
        "Primary health centre (PHC)",
    ],
    "Dhulikhel": [
        "Dhulikhel Hospital",
        "Kathmandu University Hospital (Dhulikhel)",
        "Municipal health office / ward clinic",
    ],
    "Hetauda": [
        "Hetauda Hospital",
        "Chure Hills Hospital",
        "Municipal health post / ward clinic",
    ],
    "Bharatpur": [
        "Bharatpur Hospital",
        "College of Medical Sciences Teaching Hospital",
        "Chitwan Medical College Teaching Hospital",
        "Municipal health post / ward clinic",
    ],
    "Narayanghad": [
        "Bharatpur Hospital (Narayangarh area)",
        "Chitwan Medical College Teaching Hospital",
        "Municipal health post / ward clinic",
    ],
}
