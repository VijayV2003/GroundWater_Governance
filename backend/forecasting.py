"""
Model 1 – Groundwater Level Forecasting
========================================
Time-series model that predicts short-term (24 h) and long-term (30-day)
groundwater levels from historical DWLR readings.

Architecture: Ridge regression on lag + Fourier features (sklearn stand-in
for a production LSTM/Prophet pipeline — swap `_build_model` for a real
LSTM or Prophet object in production).
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from typing import List, Dict, Tuple
import joblib
import os


def _fourier_features(t: np.ndarray, period: float, n_terms: int = 3) -> np.ndarray:
    """Return sin/cos Fourier basis columns for seasonality."""
    cols = []
    for k in range(1, n_terms + 1):
        cols.append(np.sin(2 * np.pi * k * t / period))
        cols.append(np.cos(2 * np.pi * k * t / period))
    return np.column_stack(cols)


def _build_features(series: np.ndarray, lags: int = 7) -> Tuple[np.ndarray, np.ndarray]:
    """
    Build (X, y) from a 1-D water-level time series.
    Features: lag values + day-of-series Fourier terms.
    """
    n = len(series)
    if n <= lags:
        raise ValueError(f"Series too short: need >{lags} points, got {n}")

    t = np.arange(n).astype(float)
    fourier = _fourier_features(t, period=365, n_terms=3)

    rows_X, rows_y = [], []
    for i in range(lags, n):
        lag_vec = series[i - lags: i]
        f_vec   = fourier[i]
        rows_X.append(np.concatenate([lag_vec, f_vec]))
        rows_y.append(series[i])

    return np.array(rows_X), np.array(rows_y)


class GroundwaterForecaster:
    """
    Fits on historical readings, predicts future water levels.

    Usage
    -----
    >>> forecaster = GroundwaterForecaster()
    >>> forecaster.fit(historical_levels)
    >>> preds = forecaster.predict(steps=30)
    """

    def __init__(self, lags: int = 7, alpha: float = 1.0):
        self.lags   = lags
        self.alpha  = alpha
        self._pipe  = Pipeline([
            ("scaler", StandardScaler()),
            ("model",  Ridge(alpha=alpha)),
        ])
        self._last_window: np.ndarray = None
        self._fourier_offset: int     = 0
        self._is_fitted: bool         = False

    # ------------------------------------------------------------------
    def fit(self, levels: np.ndarray) -> "GroundwaterForecaster":
        """Train on a 1-D array of water-level observations (metres)."""
        X, y = _build_features(levels, lags=self.lags)
        self._pipe.fit(X, y)
        self._last_window   = levels[-self.lags:].copy()
        self._fourier_offset = len(levels)
        self._is_fitted     = True
        return self

    # ------------------------------------------------------------------
    def predict(self, steps: int = 24) -> List[float]:
        """Predict `steps` future values using recursive multi-step forecast."""
        if not self._is_fitted:
            raise RuntimeError("Call .fit() first.")

        window = self._last_window.copy()
        preds  = []

        for s in range(steps):
            t       = self._fourier_offset + s
            fourier = _fourier_features(np.array([t], dtype=float), period=365, n_terms=3)[0]
            x       = np.concatenate([window, fourier]).reshape(1, -1)
            y_hat   = float(self._pipe.predict(x)[0])
            preds.append(round(y_hat, 3))
            window  = np.roll(window, -1)
            window[-1] = y_hat

        return preds

    # ------------------------------------------------------------------
    def save(self, filepath: str):
        """Serialize the trained forecaster to disk."""
        if not self._is_fitted:
            raise RuntimeError("Cannot save an unfitted model.")
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        joblib.dump(self, filepath)

    @classmethod
    def load(cls, filepath: str) -> "GroundwaterForecaster":
        """Load a trained forecaster from disk."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Model file {filepath} not found.")
        return joblib.load(filepath)

    # ------------------------------------------------------------------
    def forecast_api_response(
        self,
        station_id: str,
        historical: pd.DataFrame,
        horizon_hours: int = 24,
    ) -> Dict:
        """
        High-level helper used by the FastAPI endpoint.

        Parameters
        ----------
        station_id    : DWLR station identifier
        historical    : DataFrame with columns [timestamp, water_level]
        horizon_hours : forecast horizon (default 24 h → one point per hour)

        Returns a dict matching the frontend `waterLevelData` shape:
        [{ time, level, predicted }, ...]
        """
        levels  = historical["water_level"].values
        self.fit(levels)

        # Historical portion (last 24 points → "actual" trace)
        recent  = historical.tail(horizon_hours)
        actuals = [
            {
                "time":      row["timestamp"].strftime("%b %d") if hasattr(row["timestamp"], "strftime") else str(row["timestamp"])[:10],
                "level":     round(float(row["water_level"]), 2),
                "predicted": None,
            }
            for _, row in recent.iterrows()
        ]

        # Predicted portion — one point every 15 minutes
        future_levels = self.predict(steps=horizon_hours)
        from datetime import datetime, timedelta
        base_time = historical["timestamp"].iloc[-1]
        predictions = [
            {
                "time":      (base_time + timedelta(minutes=15 * (i + 1))).strftime("%H:%M"),
                "level":     None,
                "predicted": v,
            }
            for i, v in enumerate(future_levels)
        ]

        return {
            "station_id":   station_id,
            "generated_at": datetime.utcnow().isoformat(),
            "horizon_hours": horizon_hours,
            "data":         actuals + predictions,
            "trend":        "declining" if future_levels[-1] < levels[-1] else "rising" if future_levels[-1] > levels[-1] + 0.5 else "stable",
            "min_predicted": round(min(future_levels), 2),
            "max_predicted": round(max(future_levels), 2),
        }
