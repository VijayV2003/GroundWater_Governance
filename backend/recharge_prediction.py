"""
Model 4 – Monsoon Recharge Prediction
=======================================
Regression model that estimates natural and artificial groundwater
recharge volumes per zone per season from rainfall, ET, soil moisture,
and surface-water-level inputs.

Architecture: Gradient Boosted Regressor (sklearn) — production would
use a seasonal decomposition + ML pipeline (e.g., Prophet + XGBoost).
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.multioutput import MultiOutputRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from typing import Dict, List


MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Seasonal rainfall distribution pattern (India monsoon, relative weights)
RAINFALL_SEASONAL = np.array([2, 2, 3, 4, 5, 14, 22, 20, 14, 8, 4, 2], dtype=float)
RAINFALL_SEASONAL /= RAINFALL_SEASONAL.sum()


def _synthetic_recharge_data(n: int = 2000, seed: int = 7) -> tuple:
    """
    Generate synthetic training data for recharge regression.

    Inputs (X):
      month_sin, month_cos, rainfall_mm, evapotranspiration_mm,
      soil_moisture_pct, surface_water_level_m, land_use_idx,
      antecedent_rainfall_30d

    Outputs (y): [natural_recharge_mm, artificial_recharge_mm]
    """
    rng = np.random.default_rng(seed)
    months = rng.integers(0, 12, n)

    # Rainfall follows seasonal pattern
    base_rainfall = rng.uniform(600, 1800, n)
    seasonal_factor = RAINFALL_SEASONAL[months]
    rainfall = base_rainfall * seasonal_factor * 12 + rng.normal(0, 10, n)
    rainfall = np.clip(rainfall, 0, None)

    ET          = rng.uniform(50, 150, n)
    soil_moist  = rng.uniform(20, 80, n)
    sw_level    = rng.uniform(1, 10, n)
    land_use    = rng.uniform(0.3, 0.9, n)
    antecedent  = rng.uniform(0, 200, n)

    month_sin = np.sin(2 * np.pi * months / 12)
    month_cos = np.cos(2 * np.pi * months / 12)

    X = np.column_stack([month_sin, month_cos, rainfall, ET,
                         soil_moist, sw_level, land_use, antecedent])

    # Physical relationship: natural recharge ~ f(rainfall, ET, soil)
    natural = (
        0.25 * rainfall
        - 0.15 * ET
        + 0.5  * soil_moist
        + 0.3  * antecedent
        + rng.normal(0, 5, n)
    )
    natural = np.clip(natural, 0, None)

    # Artificial recharge (check dams, injection wells) ~ land_use + infrastructure
    artificial = (
        0.12 * rainfall
        + 20  * land_use
        + 5   * sw_level
        + rng.normal(0, 3, n)
    )
    artificial = np.clip(artificial, 0, None)

    y = np.column_stack([natural, artificial])
    return X, y


class RechargePredictor:
    """
    Predicts monthly natural + artificial recharge volumes.
    """

    def __init__(self):
        base_reg = GradientBoostingRegressor(
            n_estimators=150, max_depth=4, learning_rate=0.1, random_state=42
        )
        self._pipe = Pipeline([
            ("scaler", StandardScaler()),
            ("reg",    MultiOutputRegressor(base_reg)),
        ])
        self._is_fitted = False

    # ------------------------------------------------------------------
    def train(self) -> "RechargePredictor":
        X, y = _synthetic_recharge_data()
        self._pipe.fit(X, y)
        self._is_fitted = True
        return self

    # ------------------------------------------------------------------
    def predict_annual(
        self,
        annual_rainfall_mm: float,
        evapotranspiration_mm: float,
        soil_moisture_pct: float = 50.0,
        surface_water_level_m: float = 5.0,
        land_use_idx: float = 0.6,
    ) -> List[Dict]:
        """
        Predict monthly recharge for a full year.

        Returns a list of 12 dicts matching the frontend `rechargeData` shape:
        [{ month, natural, artificial }, ...]
        """
        if not self._is_fitted:
            self.train()

        rows = []
        prev_rainfall = annual_rainfall_mm / 12  # rough antecedent
        for m in range(12):
            rainfall_m = annual_rainfall_mm * RAINFALL_SEASONAL[m] * 12
            month_sin  = np.sin(2 * np.pi * m / 12)
            month_cos  = np.cos(2 * np.pi * m / 12)

            x = np.array([[
                month_sin, month_cos,
                rainfall_m,
                evapotranspiration_mm / 12,
                soil_moisture_pct,
                surface_water_level_m,
                land_use_idx,
                prev_rainfall,
            ]])

            y_hat = self._pipe.predict(x)[0]
            natural    = max(0.0, round(float(y_hat[0]), 1))
            artificial = max(0.0, round(float(y_hat[1]), 1))

            rows.append({
                "month":      MONTHS[m],
                "natural":    natural,
                "artificial": artificial,
                "total":      round(natural + artificial, 1),
            })
            prev_rainfall = rainfall_m

        return rows

    # ------------------------------------------------------------------
    def monsoon_summary(self, annual_predictions: List[Dict]) -> Dict:
        """Aggregate monsoon (Jun–Sep) vs non-monsoon recharge stats."""
        monsoon_idx = [5, 6, 7, 8]  # 0-indexed Jun–Sep
        monsoon = [r for i, r in enumerate(annual_predictions) if i in monsoon_idx]
        non_monsoon = [r for i, r in enumerate(annual_predictions) if i not in monsoon_idx]

        def _sum(lst, key): return round(sum(d[key] for d in lst), 1)

        return {
            "monsoon_natural_mm":        _sum(monsoon, "natural"),
            "monsoon_artificial_mm":     _sum(monsoon, "artificial"),
            "non_monsoon_natural_mm":    _sum(non_monsoon, "natural"),
            "non_monsoon_artificial_mm": _sum(non_monsoon, "artificial"),
            "annual_total_natural_mm":   _sum(annual_predictions, "natural"),
            "annual_total_artificial_mm": _sum(annual_predictions, "artificial"),
            "recharge_deficit_risk":     "high" if _sum(annual_predictions, "natural") < 200 else "moderate" if _sum(annual_predictions, "natural") < 400 else "low",
        }
