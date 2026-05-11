"""
Model 2 – Dynamic Hydro-Socioeconomic Fingerprinting (DHSF / HSDM)
====================================================================
Multi-variate classifier that identifies *why* groundwater is depleting
in a given zone: agriculture, industry, climate stress, or urban growth.

Architecture: Gradient-Boosted Trees (XGBoost) trained on synthetic
feature distributions that mirror the patent's DHSF specification.
A real deployment would train on labelled DWLR + census + agriculture
census + IMD climate data.
"""

import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from typing import Dict, List, Tuple


# ── Label definitions ──────────────────────────────────────────────────────
DEPLETION_CAUSES = ["agricultural", "industrial", "climate", "urban"]

# Feature column order (must match generate_features())
FEATURE_COLS = [
    "agricultural_area_pct",
    "irrigation_intensity",
    "industrial_units_per_km2",
    "population_density",
    "annual_rainfall_mm",
    "evapotranspiration_mm",
    "soil_permeability",
    "surface_water_index",
    "depletion_rate_m_per_year",
    "seasonal_amplitude_m",
    "recharge_deficit_mm",
]


def _synthetic_training_data(n_samples: int = 2000, seed: int = 42) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate labelled synthetic training data.

    Each class is drawn from a distinct multivariate normal distribution
    that encodes domain knowledge about the driver profile:

    - agricultural : high ag_area, high irrigation, moderate population
    - industrial   : high industrial_units, high population, low ag_area
    - climate      : low rainfall, high ET, low surface_water_index
    - urban        : very high population, moderate industrial, low ag_area
    """
    rng  = np.random.default_rng(seed)
    n    = n_samples // 4
    rows = []
    labels = []

    # ── agricultural ───────────────────────────────────────────────────
    for _ in range(n):
        rows.append([
            rng.uniform(55, 85),   # ag_area_pct  HIGH
            rng.uniform(0.6, 0.95),# irrigation   HIGH
            rng.uniform(1, 10),    # industrial   LOW
            rng.uniform(100, 800), # pop_density  LOW-MED
            rng.uniform(500, 1200),# rainfall
            rng.uniform(700, 1300),# ET
            rng.uniform(0.3, 0.8), # soil_perm
            rng.uniform(0.3, 0.7), # sw_index
            rng.uniform(0.3, 0.8), # depletion_rate
            rng.uniform(2, 5),     # seasonal_amp
            rng.uniform(50, 200),  # recharge_deficit
        ])
        labels.append(0)  # agricultural

    # ── industrial ─────────────────────────────────────────────────────
    for _ in range(n):
        rows.append([
            rng.uniform(10, 30),   # ag_area LOW
            rng.uniform(0.1, 0.4), # irrigation LOW
            rng.uniform(30, 80),   # industrial HIGH
            rng.uniform(800, 4000),# pop HIGH
            rng.uniform(400, 1000),# rainfall
            rng.uniform(600, 1200),# ET
            rng.uniform(0.1, 0.5), # soil_perm
            rng.uniform(0.1, 0.4), # sw_index LOW (surface water abstracted)
            rng.uniform(0.4, 1.0), # depletion HIGH
            rng.uniform(1, 3),     # seasonal_amp LOW (continuous extraction)
            rng.uniform(100, 300), # recharge_deficit HIGH
        ])
        labels.append(1)  # industrial

    # ── climate ────────────────────────────────────────────────────────
    for _ in range(n):
        rows.append([
            rng.uniform(20, 60),   # ag_area MED
            rng.uniform(0.3, 0.7), # irrigation MED
            rng.uniform(2, 20),    # industrial LOW-MED
            rng.uniform(100, 500), # pop LOW
            rng.uniform(200, 600), # rainfall LOW
            rng.uniform(900, 1500),# ET HIGH
            rng.uniform(0.1, 0.4), # soil_perm LOW (hard rock)
            rng.uniform(0.1, 0.3), # sw_index LOW
            rng.uniform(0.2, 0.6), # depletion
            rng.uniform(3, 7),     # seasonal_amp HIGH (strong monsoon signal)
            rng.uniform(150, 400), # recharge_deficit HIGH
        ])
        labels.append(2)  # climate

    # ── urban ──────────────────────────────────────────────────────────
    for _ in range(n):
        rows.append([
            rng.uniform(5, 25),    # ag_area LOW (urbanised)
            rng.uniform(0.1, 0.3), # irrigation LOW
            rng.uniform(15, 50),   # industrial MED
            rng.uniform(2000, 6000),# pop VERY HIGH
            rng.uniform(400, 900), # rainfall
            rng.uniform(700, 1200),# ET
            rng.uniform(0.1, 0.4), # soil_perm LOW (impervious surface)
            rng.uniform(0.1, 0.3), # sw_index LOW (paved)
            rng.uniform(0.5, 1.2), # depletion HIGH
            rng.uniform(1, 2.5),   # seasonal_amp VERY LOW
            rng.uniform(200, 500), # recharge_deficit VERY HIGH
        ])
        labels.append(3)  # urban

    X = np.array(rows, dtype=np.float32)
    y = np.array(labels, dtype=np.int32)

    # Shuffle
    idx = rng.permutation(len(X))
    return X[idx], y[idx]


class DHSFModel:
    """
    Dynamic Hydro-Socioeconomic Fingerprinting classifier.

    Predicts the dominant depletion driver for a given aquifer zone.
    """

    def __init__(self):
        self._clf = XGBClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            use_label_encoder=False,
            eval_metric="mlogloss",
            random_state=42,
        )
        self._is_fitted = False

    # ------------------------------------------------------------------
    def train(self) -> "DHSFModel":
        """Train on synthetic data (call once at startup)."""
        X, y = _synthetic_training_data()
        X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
        self._clf.fit(X_tr, y_tr)
        self._is_fitted = True
        return self

    # ------------------------------------------------------------------
    def predict(self, features: Dict) -> Dict:
        """
        Classify a single zone given a feature dictionary.

        Parameters
        ----------
        features : dict with keys matching FEATURE_COLS

        Returns
        -------
        dict with:
          - predicted_cause  : str
          - probabilities    : dict[cause → float]
          - confidence       : float (max probability)
          - feature_importance : dict[feature → float]
        """
        if not self._is_fitted:
            self.train()

        row = np.array([[features.get(c, 0.0) for c in FEATURE_COLS]], dtype=np.float32)
        proba = self._clf.predict_proba(row)[0]
        pred_idx = int(np.argmax(proba))

        # .tolist() converts numpy types to Python natives (important for pydantic v2 serialization)
        importances = dict(zip(FEATURE_COLS, self._clf.feature_importances_.tolist()))

        # Depletion factor breakdown (% attribution) for the frontend PieChart
        # Cast to Python float to avoid numpy.float32 pydantic serialization errors
        depletion_factors = [
            {"factor": "Agricultural Use", "value": round(float(proba[0]) * 100, 1), "color": "#3b82f6"},
            {"factor": "Industrial Use",   "value": round(float(proba[1]) * 100, 1), "color": "#8b5cf6"},
            {"factor": "Climate Impact",   "value": round(float(proba[2]) * 100, 1), "color": "#f59e0b"},
            {"factor": "Urban Growth",     "value": round(float(proba[3]) * 100, 1), "color": "#10b981"},
        ]

        return {
            "predicted_cause":    DEPLETION_CAUSES[pred_idx],
            "probabilities":      {c: round(float(p), 4) for c, p in zip(DEPLETION_CAUSES, proba)},
            "confidence":         round(float(proba[pred_idx]), 4),
            "depletion_factors":  depletion_factors,
            "feature_importance": {k: round(float(v), 4) for k, v in sorted(importances.items(), key=lambda x: -x[1])},
        }

    # ------------------------------------------------------------------
    def batch_predict(self, stations_features: List[Dict]) -> List[Dict]:
        """Classify multiple zones at once."""
        return [self.predict(f) for f in stations_features]
