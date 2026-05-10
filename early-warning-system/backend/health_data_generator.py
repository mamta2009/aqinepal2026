"""Synthetic weekly respiratory loads with WHO-ish seasonality."""

from __future__ import annotations

import random
from datetime import datetime, timedelta


class HealthDataGenerator:
    """Generate realistic respiratory case patterns for dashboards and APIs."""

    BASE_CASES = {
        "Kathmandu": 18,
        "Lalitpur": 12,
        "Bhaktapur": 10,
        "Banepa": 6,
        "Dhulikhel": 4,
        "Hetauda": 8,
        "Bharatpur": 7,
        "Narayanghad": 5,
    }

    SEASONAL = {
        1: 2.0,
        2: 1.9,
        3: 1.2,
        4: 0.8,
        5: 0.7,
        6: 0.6,
        7: 0.8,
        8: 0.9,
        9: 1.1,
        10: 1.4,
        11: 1.8,
        12: 2.0,
    }

    @classmethod
    def week(cls, city: str) -> dict:
        base = cls.BASE_CASES.get(city, 10)
        seasonal = cls.SEASONAL.get(datetime.now().month, 1.0)
        today = datetime.now()

        days = []
        for i in range(7):
            date = today - timedelta(days=6 - i)
            day_factor = 0.7 if date.weekday() >= 5 else 1.0
            variation = random.uniform(0.85, 1.15)

            total = int(base * seasonal * day_factor * variation)
            severe = int(total * random.uniform(0.15, 0.22))
            under5 = int(total * random.uniform(0.40, 0.50))
            recovered = int(total * 0.82)
            referred = int(total * 0.15)

            days.append(
                {
                    "date": date.strftime("%Y-%m-%d"),
                    "cases": total,
                    "severe": severe,
                    "under5": under5,
                    "recovered": recovered,
                    "referred": referred,
                    "deceased": max(0, total - recovered - referred),
                    "oxygen": severe * 2,
                }
            )

        return {
            "city": city,
            "total": sum(d["cases"] for d in days),
            "days": [d["cases"] for d in days],
            "data": days,
            "source": "WHO-pattern realistic data",
            "note": "Realistic synthetic data. Seamlessly transitions to real DHIS2 data.",
        }
