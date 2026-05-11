"""
Model 7 – Aquifer Stress Classification
========================================
Multi-class classifier that assigns each aquifer zone to a stress category
based on water-table fluctuation cycles, extraction intensity, and soil
infiltration rates.

Classes: Safe | Semi-Critical | Critical | Over-Exploited
(mirrors India's CGWB aquifer assessment nomenclature)

Architecture: Random Forest (sklearn)
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from typing import Dict, List, Tuple


STRESS_CLASSES = ["Safe", "Semi-Critical", "Critical", "Over-Exploited"]
STRESS_COLORS  = ["#10b981", "#f59e0b", "#ef4444", "#7f1d1d"]

FEATURE_COLS = [
    "fluctuation_amplitude_m",    # peak-to-trough water table swing
    "extraction_intensity",       # extraction / sustainable yield ratio
    "soil_infiltration_rate",     # mm/hr
    "pre_monsoon_depth_m",        # depth to water before monsoon
    "post_monsoon_depth_m",       # depth to water after monsoon
    "long_term_trend_m_yr",       # linear trend slope (negative = declining)
    "stage_of_extraction_pct",    # % of annual replenishable resource extracted
    "number_of_wells_per_km2",    # well density
]


def _synthetic_training_data(n: int = 3000, seed: int = 99) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate labelled training data.
    Class definitions follow CGWB 2022 assessment norms.
    """
    rng = np.random.default_rng(seed)
    n_each = n // 4
    X_parts, y_parts = [], []

    # ── Safe (stage < 70 %, trend stable) ──────────────────────────────
    n_s = n_each
    X_parts.append(np.column_stack([
        rng.uniform(0.5, 2.5, n_s),   # fluctuation amp
        rng.uniform(0.2, 0.6, n_s),   # extraction intensity
        rng.uniform(15, 50,  n_s),    # infiltration mm/hr
        rng.uniform(5,  12,  n_s),    # pre-monsoon depth
        rng.uniform(3,   8,  n_s),    # post-monsoon depth
        rng.uniform(-0.1, 0.1, n_s),  # trend (near zero)
        rng.uniform(20,  65, n_s),    # stage %
        rng.uniform(2,  15,  n_s),    # well density
    ]))
    y_parts.append(np.zeros(n_s, dtype=int))

    # ── Semi-Critical (stage 70–90 %) ──────────────────────────────────
    X_parts.append(np.column_stack([
        rng.uniform(2, 5,    n_s),
        rng.uniform(0.6, 0.85, n_s),
        rng.uniform(8, 20,   n_s),
        rng.uniform(10, 20,  n_s),
        rng.uniform(7, 14,   n_s),
        rng.uniform(-0.3, -0.05, n_s),
        rng.uniform(65, 90,  n_s),
        rng.uniform(10, 30,  n_s),
    ]))
    y_parts.append(np.ones(n_s, dtype=int))

    # ── Critical (stage 90–100 %) ───────────────────────────────────────
    X_parts.append(np.column_stack([
        rng.uniform(4, 8,    n_s),
        rng.uniform(0.85, 1.0, n_s),
        rng.uniform(3, 10,   n_s),
        rng.uniform(18, 35,  n_s),
        rng.uniform(14, 28,  n_s),
        rng.uniform(-0.6, -0.2, n_s),
        rng.uniform(90, 100, n_s),
        rng.uniform(25, 60,  n_s),
    ]))
    y_parts.append(np.full(n_s, 2, dtype=int))

    # ── Over-Exploited (stage > 100 %) ─────────────────────────────────
    X_parts.append(np.column_stack([
        rng.uniform(7, 15,   n_s),
        rng.uniform(1.0, 2.0, n_s),
        rng.uniform(1,  5,   n_s),
        rng.uniform(30, 60,  n_s),
        rng.uniform(25, 55,  n_s),
        rng.uniform(-1.2, -0.5, n_s),
        rng.uniform(100, 180, n_s),
        rng.uniform(50, 120, n_s),
    ]))
    y_parts.append(np.full(n_s, 3, dtype=int))

    X = np.vstack(X_parts)
    y = np.concatenate(y_parts)
    idx = rng.permutation(len(X))
    return X[idx], y[idx]


class AquiferStressClassifier:
    """
    Classifies an aquifer zone into one of four stress categories.
    """

    def __init__(self):
        self._pipe = Pipeline([
            ("scaler", StandardScaler()),
            ("rf",     RandomForestClassifier(
                n_estimators=200, max_depth=8,
                class_weight="balanced", random_state=42,
            )),
        ])
        self._is_fitted = False

    # ------------------------------------------------------------------
    def train(self) -> "AquiferStressClassifier":
        X, y = _synthetic_training_data()
        self._pipe.fit(X, y)
        self._is_fitted = True
        return self

    # ------------------------------------------------------------------
    def predict(self, features: Dict) -> Dict:
        """
        Classify a single zone.

        Parameters
        ----------
        features : dict with keys in FEATURE_COLS

        Returns
        -------
        {
            stress_class, stress_color, probabilities,
            recommended_actions, feature_importances
        }
        """
        if not self._is_fitted:
            self.train()

        row = np.array([[features.get(c, 0.0) for c in FEATURE_COLS]])
        proba   = self._pipe.predict_proba(row)[0]
        cls_idx = int(np.argmax(proba))

        importances = dict(zip(
            FEATURE_COLS,
            self._pipe.named_steps["rf"].feature_importances_.tolist()
        ))

        return {
            "stress_class":       STRESS_CLASSES[cls_idx],
            "stress_color":       STRESS_COLORS[cls_idx],
            "probabilities":      {c: round(float(p), 4) for c, p in zip(STRESS_CLASSES, proba)},
            "confidence":         round(float(proba[cls_idx]), 4),
            "recommended_actions": _get_actions(cls_idx),
            "feature_importances": {k: round(v, 4) for k, v in sorted(importances.items(), key=lambda x: -x[1])},
            "stage_of_extraction_pct": round(features.get("stage_of_extraction_pct", 0), 1),
        }

    # ------------------------------------------------------------------
    def batch_predict(self, features_list: List[Dict]) -> List[Dict]:
        return [self.predict(f) for f in features_list]

    # ------------------------------------------------------------------
    def regional_stress_map(self, stations_with_features: List[Dict]) -> Dict:
        """Aggregate stress predictions across stations for dashboard map."""
        results  = self.batch_predict([s["features"] for s in stations_with_features])
        counts   = {c: 0 for c in STRESS_CLASSES}
        for r in results:
            counts[r["stress_class"]] += 1
        total = len(results)
        return {
            "total_stations": total,
            "distribution": {c: {"count": v, "pct": round(v / total * 100, 1)} for c, v in counts.items()},
            "dominant_class": max(counts, key=counts.get),
        }


def _get_actions(cls_idx: int) -> List[str]:
    actions = {
        0: [
            "Maintain current extraction levels",
            "Continue seasonal monitoring",
            "Document recharge zones for protection",
        ],
        1: [
            "Restrict new bore-well permissions",
            "Implement micro-irrigation in agricultural areas",
            "Deploy artificial recharge structures",
        ],
        2: [
            "Immediate moratorium on new extraction",
            "Regulated water allocation per sector",
            "Emergency artificial recharge programme",
            "Community awareness & demand management",
        ],
        3: [
            "EMERGENCY: Ban all non-essential extraction",
            "Import water from surplus regions",
            "Mandatory crop diversification to low-water crops",
            "Large-scale check-dam and percolation-pond construction",
            "Fast-track legislative water conservation orders",
        ],
    }
    return actions.get(cls_idx, [])
