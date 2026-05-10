"""Lightweight respiratory load trend estimate (sklearn when available)."""

from __future__ import annotations

from typing import Any

try:
    import numpy as np
    from sklearn.linear_model import LinearRegression
except ImportError:
    np = None  # type: ignore[assignment]
    LinearRegression = None  # type: ignore[assignment,misc]


def predict_week_trend(daily_cases: list[int]) -> dict[str, Any]:
    """
    Given 7 daily case counts, estimate next-day level and a simple risk note.
    Falls back to a moving average if sklearn is missing or data is short.
    """
    if not daily_cases:
        return {"model": "none", "next_day_estimate": 0, "week_total_estimate": 0}

    n = len(daily_cases)
    avg = sum(daily_cases) / n

    if LinearRegression is None or np is None or n < 3:
        nxt = max(0, round(avg))
        return {
            "model": "moving_average",
            "next_day_estimate": nxt,
            "week_total_estimate": max(0, round(avg * 7)),
            "confidence": "low",
        }

    x = np.arange(n, dtype=float).reshape(-1, 1)
    y = np.array(daily_cases, dtype=float)
    reg = LinearRegression().fit(x, y)
    next_x = np.array([[float(n)]])
    nxt = max(0.0, float(reg.predict(next_x)[0]))
    return {
        "model": "linear_regression",
        "next_day_estimate": round(nxt),
        "week_total_estimate": max(0, round(float(reg.predict(np.arange(n, n + 7).reshape(-1, 1)).sum()))),
        "confidence": "medium",
        "r2_score": round(float(reg.score(x, y)), 4),
    }
