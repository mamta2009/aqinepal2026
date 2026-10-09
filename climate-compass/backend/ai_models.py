"""Respiratory load estimation: legacy linear trend + surge bundle (polynomial regression)."""

from __future__ import annotations

import math
import os
from typing import Any

try:
    import numpy as np
except ImportError:
    np = None  # type: ignore[assignment]

try:
    from sklearn.linear_model import LinearRegression
except ImportError:
    LinearRegression = None  # type: ignore[assignment,misc]

# Partner-facing spec version for API consumers (UNICEF / integration docs).
SURGE_FORECAST_SPEC_VERSION = "1.0"


def _env_int(name: str, default: int, *, min_v: int, max_v: int) -> int:
    try:
        v = int((os.getenv(name) or str(default)).strip())
    except ValueError:
        return default
    return max(min_v, min(max_v, v))


def _env_float(name: str, default: float) -> float:
    try:
        return float((os.getenv(name) or str(default)).strip())
    except ValueError:
        return default


def predict_week_trend(daily_cases: list[int]) -> dict[str, Any]:
    """
    Given 7 daily case counts, estimate next-day level and a simple risk note.
    Falls back to a moving average if sklearn is missing or data is short.

    Prefer :func:`predict_surge_forecast` for the full contract (risk 0–100,
    surge probability 3–5 days, polynomial regression metadata).
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
        "week_total_estimate": max(
            0, round(float(reg.predict(np.arange(n, n + 7).reshape(-1, 1)).sum()))
        ),
        "confidence": "medium",
        "r2_score": round(float(reg.score(x, y)), 4),
    }


def _risk_score_from_trajectory(
    *,
    baseline: float,
    peak_pred: float,
    max_surge_probability: float,
) -> float:
    """Map predicted load + surge tail to a 0–100 illustration score (not clinical)."""
    if baseline <= 0:
        baseline = 1.0
    load_ratio = max(0.0, (peak_pred - baseline) / (baseline * 1.2 + 1.0))
    load_score = min(85.0, 55.0 * load_ratio)
    prob_score = min(90.0, max_surge_probability * 100.0 * 0.35)
    return max(0.0, min(100.0, round(10.0 + load_score + prob_score, 2)))


def _surge_probability(pred: float, baseline: float, scale: float) -> float:
    """
    Heuristic P(sustained elevation) in [0,1] from predicted count vs baseline.
    Calibrate with real facility data when DHIS2 feeds replace synthetic weeks.
    """
    if scale <= 0:
        scale = 1.0
    excess = (pred - baseline) / scale
    p = 1.0 / (1.0 + math.exp(-1.15 * excess))
    return max(0.0, min(1.0, float(p)))


def predict_surge_forecast(
    daily_cases: list[int],
    *,
    horizon_days: tuple[int, ...] = (3, 4, 5),
    polynomial_degree: int | None = None,
) -> dict[str, Any]:
    """
    Polynomial regression on the daily case series; extrapolate 3–5 days ahead.

    Returns risk_score (0–100), surge_probability per horizon day, training metrics,
    and retraining metadata aligned with partner documentation.

    * **declared_accuracy_percent** — default 78 from ``AI_SURGE_DECLARED_ACCURACY_PERCENT``;
      replace with a hold-out metric when real labels exist.
    * **last_retrained_at** — optional ISO timestamp from ``AI_MODEL_LAST_TRAIN_AT`` after
      batch retrain (monthly policy is operational, not enforced in-process here).
    """
    declared_acc = _env_float("AI_SURGE_DECLARED_ACCURACY_PERCENT", 78.0)
    configured_deg = polynomial_degree if polynomial_degree is not None else _env_int(
        "AI_TREND_POLY_DEGREE", 2, min_v=1, max_v=3
    )
    last_train = (os.getenv("AI_MODEL_LAST_TRAIN_AT") or "").strip() or None

    empty = {
        "spec_version": SURGE_FORECAST_SPEC_VERSION,
        "model_family": "polynomial_regression",
        "polynomial_degree": configured_deg,
        "risk_score_0_100": 0.0,
        "surge_probability": {f"day_{d}_ahead": None for d in horizon_days},
        "predicted_cases_by_horizon_day": {f"day_{d}_ahead": None for d in horizon_days},
        "accuracy": {
            "declared_accuracy_percent": declared_acc,
            "r2_in_sample": None,
            "note": "No data — cannot fit polynomial.",
        },
        "retraining": {
            "policy": "monthly",
            "recommended_data": "Health facility case counts (DHIS2 / daily reports)",
            "last_retrained_at": last_train,
        },
        "disclaimer": "Illustrative model on the supplied series — not a validated clinical forecast.",
    }

    if not daily_cases:
        return empty

    y_list = [max(0, int(c)) for c in daily_cases]
    n = len(y_list)
    baseline = float(sum(y_list)) / n if n else 0.0
    var = sum((x - baseline) ** 2 for x in y_list) / max(1, n)
    scale = math.sqrt(var) if var > 0 else max(baseline * 0.15, 1.0)

    if n < 2 or np is None:
        # Moving-average fallback — no polynomial
        nxt = max(0, round(baseline))
        surge_map: dict[str, Any] = {}
        pred_map: dict[str, Any] = {}
        for d in horizon_days:
            pred_v = max(0.0, baseline * (1.0 + 0.02 * (d - 2)))
            surge_map[f"day_{d}_ahead"] = round(_surge_probability(pred_v, baseline, scale), 4)
            pred_map[f"day_{d}_ahead"] = round(pred_v, 2)
        mxp = max(surge_map.values()) if surge_map else 0.0
        risk = _risk_score_from_trajectory(
            baseline=baseline,
            peak_pred=max(pred_map.values()) if pred_map else baseline,
            max_surge_probability=mxp if isinstance(mxp, (int, float)) else 0.0,
        )
        return {
            "spec_version": SURGE_FORECAST_SPEC_VERSION,
            "model_family": "moving_average_fallback",
            "polynomial_degree": 0,
            "risk_score_0_100": risk,
            "surge_probability": surge_map,
            "predicted_cases_by_horizon_day": pred_map,
            "next_day_point_estimate": nxt,
            "accuracy": {
                "declared_accuracy_percent": declared_acc,
                "r2_in_sample": None,
                "note": "numpy unavailable or series too short — polynomial fit skipped.",
            },
            "retraining": {
                "policy": "monthly",
                "recommended_data": "Health facility case counts (DHIS2 / daily reports)",
                "last_retrained_at": last_train,
            },
            "disclaimer": empty["disclaimer"],
        }

    deg = min(configured_deg, n - 1, 3)
    deg = max(1, deg)
    x = np.arange(n, dtype=float)
    y = np.array(y_list, dtype=float)
    coeffs = np.polyfit(x, y, deg=deg)
    y_hat = np.polyval(coeffs, x)
    ss_res = float(np.sum((y - y_hat) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 1e-12 else 0.0
    r2 = max(0.0, min(1.0, r2))

    last_x = float(n - 1)
    surge_map = {}
    pred_map = {}
    preds_for_risk = []
    for d in horizon_days:
        # Day d ahead from end of series: index last_x + d
        xf = last_x + float(d)
        pred_v = float(max(0.0, np.polyval(coeffs, xf)))
        preds_for_risk.append(pred_v)
        pred_map[f"day_{d}_ahead"] = round(pred_v, 2)
        surge_map[f"day_{d}_ahead"] = round(_surge_probability(pred_v, baseline, scale), 4)

    peak_pred = max(preds_for_risk) if preds_for_risk else baseline
    mx_prob = max(surge_map.values()) if surge_map else 0.0
    risk = _risk_score_from_trajectory(
        baseline=baseline,
        peak_pred=peak_pred,
        max_surge_probability=float(mx_prob) if mx_prob is not None else 0.0,
    )

    next_day_x = last_x + 1.0
    next_day_est = int(round(max(0.0, float(np.polyval(coeffs, next_day_x)))))

    return {
        "spec_version": SURGE_FORECAST_SPEC_VERSION,
        "model_family": "polynomial_regression",
        "polynomial_degree": deg,
        "risk_score_0_100": risk,
        "surge_probability": surge_map,
        "predicted_cases_by_horizon_day": pred_map,
        "next_day_point_estimate": next_day_est,
        "accuracy": {
            "declared_accuracy_percent": declared_acc,
            "r2_in_sample": round(r2, 4),
            "note": "r2_in_sample is fit on the input window only; declared_accuracy_percent is "
            "partner-facing until replaced by prospective validation on facility data.",
        },
        "retraining": {
            "policy": "monthly",
            "recommended_data": "Health facility case counts (DHIS2 / daily reports)",
            "last_retrained_at": last_train,
        },
        "disclaimer": empty["disclaimer"],
    }
