"""
Model 3 – Anomaly Detection
============================
Unsupervised anomaly detector for real-time DWLR signal streams.
Flags: rapid depletion, abnormal fluctuation, recharge failure.

Architecture: Isolation Forest (sklearn) — production systems may swap
this for an Autoencoder or LSTM-AE for richer temporal anomalies.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from typing import Dict, List, Optional
import joblib
import os


# Anomaly severity thresholds (Z-score of reconstruction error)
SEVERITY_THRESHOLDS = {"critical": 2.5, "warning": 1.5}

ANOMALY_TYPES = {
    "rapid_depletion":    "Water level dropped > 2 m in < 24 h",
    "abnormal_fluctuation": "Unusual oscillation pattern detected",
    "recharge_failure":   "Expected monsoon recharge not observed",
    "sensor_fault":       "Reading outside physically plausible range",
}


def _extract_features(df: pd.DataFrame) -> np.ndarray:
    """
    Compute statistical window features from a rolling time-series.

    Features per window:
      mean, std, min, max, range, slope (linear trend), delta_last_hour

    Vectorized implementation — no Python for-loops, no per-window polyfit.
    Uses stride tricks for O(n) memory and fast numpy operations.
    """
    levels = df["water_level"].values.astype(np.float64)
    n = len(levels)
    W = 7  # window size
    if n < W:
        raise ValueError(f"Need at least {W} readings for feature extraction.")

    # Build (n-W+1, W) sliding-window matrix via stride tricks
    shape   = (n - W + 1, W)
    strides = (levels.strides[0], levels.strides[0])
    windows = np.lib.stride_tricks.as_strided(levels, shape=shape, strides=strides)

    # Statistical features — all vectorized
    mean_v  = windows.mean(axis=1)
    std_v   = windows.std(axis=1)
    min_v   = windows.min(axis=1)
    max_v   = windows.max(axis=1)
    range_v = max_v - min_v

    # Closed-form slope: β = (Σ(t·x) - n·mean(t)·mean(x)) / (Σt² - n·mean(t)²)
    t = np.arange(W, dtype=np.float64)
    t_mean  = t.mean()
    t_sq_ss = ((t - t_mean) ** 2).sum()          # scalar denominator
    x_dev   = windows - mean_v[:, None]           # (m, W)
    slope_v = (x_dev * (t - t_mean)).sum(axis=1) / t_sq_ss

    # Last-step delta
    delta_v = levels[W:] - levels[W - 1: -1]

    return np.column_stack([mean_v, std_v, min_v, max_v, range_v, slope_v, delta_v])


class AnomalyDetector:
    """
    Fits an Isolation Forest on normal station behaviour, then
    scores new readings for anomalousness.
    """

    def __init__(self, contamination: float = 0.05, random_state: int = 42):
        self._pipe = Pipeline([
            ("scaler", StandardScaler()),
            ("iforest", IsolationForest(
                contamination=contamination,
                n_estimators=150,
                random_state=random_state,
            )),
        ])
        self._is_fitted = False

    # ------------------------------------------------------------------
    def fit(self, df: pd.DataFrame) -> "AnomalyDetector":
        """
        Train on historical DWLR readings (assumed normal / no anomalies).
        df must have column `water_level`.
        """
        X = _extract_features(df)
        self._pipe.fit(X)
        self._is_fitted = True
        return self

    # ------------------------------------------------------------------
    def score(self, df: pd.DataFrame) -> np.ndarray:
        """
        Return anomaly scores for each window in df.
        Negative = more anomalous (Isolation Forest convention).
        """
        if not self._is_fitted:
            raise RuntimeError("Call .fit() first.")
        X = _extract_features(df)
        return self._pipe.named_steps["iforest"].score_samples(
            self._pipe.named_steps["scaler"].transform(X)
        )

    # ------------------------------------------------------------------
    def save(self, filepath: str):
        """Serialize the trained anomaly detector to disk."""
        if not self._is_fitted:
            raise RuntimeError("Cannot save an unfitted model.")
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        joblib.dump(self, filepath)

    @classmethod
    def load(cls, filepath: str) -> "AnomalyDetector":
        """Load a trained anomaly detector from disk."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Model file {filepath} not found.")
        return joblib.load(filepath)

    # ------------------------------------------------------------------
    def detect(self, df: pd.DataFrame, station_id: str) -> Dict:
        """
        High-level API: detect anomalies and classify them.

        Returns
        -------
        {
            station_id,
            status: "normal" | "warning" | "critical",
            anomalies: [ { timestamp, type, severity, description, score } ],
            latest_level,
            latest_delta,
        }
        """
        if not self._is_fitted:
            self.fit(df)

        scores   = self.score(df)
        levels   = df["water_level"].values
        times    = df["timestamp"].values

        anomalies = []
        for i, (sc, ts) in enumerate(zip(scores, times[6:])):
            window   = levels[i: i + 7]
            delta_1h = levels[i + 6] - levels[i + 5]
            delta_6h = levels[i + 6] - levels[i]

            # Determine anomaly type from window statistics
            atype = None
            if delta_6h < -1.5:
                atype = "rapid_depletion"
            elif np.std(window) > 1.5:
                atype = "abnormal_fluctuation"
            elif delta_6h > 1.0 and self._expected_recharge(ts) and delta_6h < 0.1:
                atype = "recharge_failure"
            elif levels[i + 6] < 0.5 or levels[i + 6] > 200:
                atype = "sensor_fault"

            # Score-based severity
            abs_sc = abs(sc)
            if abs_sc > SEVERITY_THRESHOLDS["critical"]:
                severity = "critical"
            elif abs_sc > SEVERITY_THRESHOLDS["warning"]:
                severity = "warning"
            else:
                severity = "normal"

            if severity != "normal" and atype:
                anomalies.append({
                    "timestamp":   str(ts),
                    "type":        atype,
                    "severity":    severity,
                    "description": ANOMALY_TYPES.get(atype, "Unknown anomaly"),
                    "score":       round(float(sc), 4),
                    "level":       round(float(levels[i + 6]), 2),
                })

        # Overall station status
        if any(a["severity"] == "critical" for a in anomalies):
            status = "critical"
        elif any(a["severity"] == "warning" for a in anomalies):
            status = "warning"
        else:
            status = "normal"

        return {
            "station_id":    station_id,
            "status":        status,
            "anomalies":     anomalies[-10:],   # return last 10 events
            "anomaly_count": len(anomalies),
            "latest_level":  round(float(levels[-1]), 2),
            "latest_delta":  round(float(levels[-1] - levels[-2]), 3),
        }

    # ------------------------------------------------------------------
    @staticmethod
    def _expected_recharge(timestamp) -> bool:
        """True if timestamp falls in monsoon season (Jun–Sep in India)."""
        try:
            month = pd.Timestamp(timestamp).month
            return 6 <= month <= 9
        except Exception:
            return False

    # ------------------------------------------------------------------
    def generate_alerts(self, station_results: List[Dict]) -> List[Dict]:
        """
        Convert per-station anomaly results into frontend alert objects.
        """
        alerts = []
        for res in station_results:
            for anom in res.get("anomalies", []):
                alert_type = "critical" if anom["severity"] == "critical" else "warning"
                alerts.append({
                    "id":      hash(f"{res['station_id']}{anom['timestamp']}") % 10**9,
                    "type":    alert_type,
                    "message": f"{res['station_id']}: {anom['description']} (level={anom['level']} m)",
                    "time":    anom["timestamp"],
                    "station": res["station_id"],
                })
        return sorted(alerts, key=lambda x: x["time"], reverse=True)[:20]
