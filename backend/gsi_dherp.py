"""
Model 5 – Groundwater Sustainability Index (GSI) Scoring Engine
================================================================
Rule-based + ML hybrid that computes a 0–100 sustainability score
(and colour-coded risk band) for each aquifer zone.

Model 6 – Dynamic Hydro-Energetic Restoration Potential (DH-ERP)
================================================================
Computes the energy cost and time required to restore an aquifer
to its baseline level, supporting policy and financial planning.
"""

import numpy as np
from dataclasses import dataclass
from typing import Dict, Tuple


# ══════════════════════════════════════════════════════════════════════
# Model 5 – GSI Scoring Engine
# ══════════════════════════════════════════════════════════════════════

GSI_BANDS = [
    (75, 100, "Sustainable",  "#10b981"),
    (50,  75, "Moderate",     "#f59e0b"),
    (25,  50, "High Risk",    "#ef4444"),
    (0,   25, "Critical",     "#7f1d1d"),
]


@dataclass
class GSIInput:
    """Inputs required to compute the GSI score for a zone."""
    current_level_m: float          # current water-table depth (m bgl)
    baseline_level_m: float         # historical baseline (m bgl)
    recharge_rate_mm_yr: float      # annual recharge (mm/yr)
    extraction_rate_mm_yr: float    # annual extraction (mm/yr)
    trend_slope_m_yr: float         # linear trend (negative = declining)
    climatic_recharge_support: float  # 0–1 (1 = very favourable climate)
    aquifer_storage_coeff: float    # dimensionless (0.001–0.3)


def compute_gsi(inp: GSIInput) -> Dict:
    """
    Compute the Groundwater Sustainability Index (0–100).

    Sub-scores (each 0–100, then weighted):
      S1 – Level deficit score   (40 % weight)
      S2 – Recharge balance      (30 % weight)
      S3 – Trend score           (20 % weight)
      S4 – Climate support       (10 % weight)
    """
    # S1: level deficit  (0 = at / below 30 % of baseline, 100 = at baseline)
    level_ratio = inp.current_level_m / max(inp.baseline_level_m, 1.0)
    s1 = float(np.clip((level_ratio - 0.3) / 0.7 * 100, 0, 100))

    # S2: recharge vs extraction balance
    balance_ratio = inp.recharge_rate_mm_yr / max(inp.extraction_rate_mm_yr, 1.0)
    s2 = float(np.clip(balance_ratio * 60, 0, 100))

    # S3: trend (slope = 0 → 50 pts; positive → up to 100; negative → 0)
    s3 = float(np.clip(50 + inp.trend_slope_m_yr * -30, 0, 100))

    # S4: climate support (direct 0–100)
    s4 = float(np.clip(inp.climatic_recharge_support * 100, 0, 100))

    gsi = 0.40 * s1 + 0.30 * s2 + 0.20 * s3 + 0.10 * s4

    # Determine risk band
    band_label, band_color = "Unknown", "#6b7280"
    for lo, hi, label, color in GSI_BANDS:
        if lo <= gsi <= hi:
            band_label = label
            band_color = color
            break

    return {
        "gsi_score":         round(gsi, 1),
        "band":              band_label,
        "band_color":        band_color,
        "sub_scores": {
            "level_deficit":  round(s1, 1),
            "recharge_balance": round(s2, 1),
            "trend":          round(s3, 1),
            "climate_support": round(s4, 1),
        },
        "interpretation": _gsi_interpretation(gsi, band_label),
    }


def _gsi_interpretation(score: float, band: str) -> str:
    if band == "Sustainable":
        return "Aquifer is in a healthy state. Continue current monitoring."
    elif band == "Moderate":
        return "Aquifer under moderate stress. Consider demand management."
    elif band == "High Risk":
        return "Significant depletion detected. Immediate intervention recommended."
    else:
        return "CRITICAL: Aquifer near depletion. Emergency action required."


# ══════════════════════════════════════════════════════════════════════
# Model 6 – DH-ERP Index (Hydro-Energetic Restoration Potential)
# ══════════════════════════════════════════════════════════════════════

# Energy cost constants (India avg tariffs, 2024)
ELECTRICITY_TARIFF_INR_PER_KWH = 6.50       # INR
PUMP_EFFICIENCY                  = 0.72       # 72 %
WATER_DENSITY_KG_M3              = 1000.0
GRAVITY_M_S2                     = 9.81


def compute_dherp(
    current_level_m: float,
    baseline_level_m: float,
    aquifer_area_km2: float,
    specific_yield: float = 0.15,
    electricity_tariff_inr_kwh: float = ELECTRICITY_TARIFF_INR_PER_KWH,
) -> Dict:
    """
    Estimate energy and cost required to restore the aquifer to baseline.

    Physics
    -------
    Volume deficit (m³) = area × specific_yield × (baseline - current)
    Energy (kWh)        = (ρ × g × H × V) / (pump_efficiency × 3.6e6)
    Cost (INR)          = energy × tariff

    where H is the average lift height (mean of current and baseline depths).
    """
    depth_deficit_m = max(0.0, baseline_level_m - current_level_m)
    area_m2          = aquifer_area_km2 * 1e6

    # Volume of water to be recharged (m³)
    volume_m3 = area_m2 * specific_yield * depth_deficit_m

    # Average pumping head (m) — assume surface injection, lift = mean depth
    mean_depth_m = (current_level_m + baseline_level_m) / 2.0

    # Energy in kWh
    energy_kwh = (WATER_DENSITY_KG_M3 * GRAVITY_M_S2 * mean_depth_m * volume_m3) / (
        PUMP_EFFICIENCY * 3.6e6
    )

    # Cost in INR (then convert to crores: 1 Cr = 1e7 INR)
    cost_inr    = energy_kwh * electricity_tariff_inr_kwh
    cost_cr     = cost_inr / 1e7

    # Estimated time to restore (assuming 10 % of annual recharge capacity
    # is available for active recharge programmes per year)
    annual_recharge_capacity_m3 = area_m2 * 0.05 * 0.1  # 5 cm/yr × 10 % managed
    if annual_recharge_capacity_m3 > 0:
        years_to_restore = volume_m3 / annual_recharge_capacity_m3
    else:
        years_to_restore = float("inf")

    # DHERP index (0–100): higher = harder to restore
    dherp_index = float(np.clip(depth_deficit_m / max(baseline_level_m, 1) * 100, 0, 100))

    return {
        "dherp_index":             round(dherp_index, 1),
        "depth_deficit_m":         round(depth_deficit_m, 2),
        "volume_deficit_m3":       round(volume_m3, 0),
        "energy_required_gwh":     round(energy_kwh / 1e6, 2),
        "estimated_cost_crore_inr": round(cost_cr, 1),
        "time_to_restore_months":  round(years_to_restore * 12, 0),
        "restoration_feasibility": _restoration_feasibility(dherp_index),
    }


def _restoration_feasibility(dherp_index: float) -> str:
    if dherp_index < 20:
        return "High – restoration achievable within 1–2 years with moderate investment"
    elif dherp_index < 50:
        return "Moderate – 3–7 year programme required with significant investment"
    elif dherp_index < 75:
        return "Low – long-term (10+ year) restoration needed; policy change essential"
    else:
        return "Very Low – severe depletion; emergency intervention + decades of recovery"
