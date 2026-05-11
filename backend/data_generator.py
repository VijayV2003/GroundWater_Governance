"""
DWLR (Digital Water Level Recorder) Data Generator
Simulates realistic groundwater sensor data for 5,000+ stations across India.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any


STATIONS = [
    {"id": "DWLR001", "name": "Delhi NCR",        "lat": 28.6139, "lng": 77.2090, "region": "North",   "base_level": 45.2, "aquifer_type": "alluvial"},
    {"id": "DWLR002", "name": "Mumbai Suburban",   "lat": 19.0760, "lng": 72.8777, "region": "West",    "base_level": 32.8, "aquifer_type": "basalt"},
    {"id": "DWLR003", "name": "Chennai Central",   "lat": 13.0827, "lng": 80.2707, "region": "South",   "base_level": 28.5, "aquifer_type": "crystalline"},
    {"id": "DWLR004", "name": "Bangalore Urban",   "lat": 12.9716, "lng": 77.5946, "region": "South",   "base_level": 55.3, "aquifer_type": "crystalline"},
    {"id": "DWLR005", "name": "Kolkata Metro",     "lat": 22.5726, "lng": 88.3639, "region": "East",    "base_level": 48.7, "aquifer_type": "alluvial"},
    {"id": "DWLR006", "name": "Hyderabad Deccan",  "lat": 17.3850, "lng": 78.4867, "region": "South",   "base_level": 38.1, "aquifer_type": "crystalline"},
    {"id": "DWLR007", "name": "Ahmedabad Plains",  "lat": 23.0225, "lng": 72.5714, "region": "West",    "base_level": 41.6, "aquifer_type": "alluvial"},
    {"id": "DWLR008", "name": "Jaipur Semi-arid",  "lat": 26.9124, "lng": 75.7873, "region": "North",   "base_level": 62.4, "aquifer_type": "hard_rock"},
    {"id": "DWLR009", "name": "Lucknow Gangetic",  "lat": 26.8467, "lng": 80.9462, "region": "North",   "base_level": 18.3, "aquifer_type": "alluvial"},
    {"id": "DWLR010", "name": "Bhopal Central",    "lat": 23.2599, "lng": 77.4126, "region": "Central", "base_level": 29.7, "aquifer_type": "hard_rock"},
]

DEPLETION_RATES = {
    "agricultural": 0.05,
    "industrial":   0.03,
    "domestic":     0.02,
    "climate":      0.01,
}


def generate_historical_readings(
    station: Dict,
    days: int = 365,
    end_date: datetime = None
) -> pd.DataFrame:
    """
    Generate synthetic time-series water-level readings for a station.
    Incorporates seasonal variation, long-term depletion, and noise.
    """
    if end_date is None:
        end_date = datetime.now()

    timestamps = [end_date - timedelta(days=i) for i in range(days, 0, -1)]
    base = station["base_level"]
    records = []

    for i, ts in enumerate(timestamps):
        # Seasonal pattern (monsoon recharge June–September)
        day_of_year = ts.timetuple().tm_yday
        seasonal = 3.0 * np.sin(2 * np.pi * (day_of_year - 80) / 365)

        # Long-term declining trend
        trend = 0.008 * i

        # Random noise
        noise = np.random.normal(0, 0.3)

        # Occasional anomaly events (rapid depletion or recharge)
        anomaly = 0.0
        if np.random.random() < 0.005:
            anomaly = np.random.choice([-5.0, 3.0])

        level = base - trend + seasonal + noise + anomaly

        records.append({
            "station_id": station["id"],
            "timestamp":  ts,
            "water_level": round(max(level, 1.0), 2),
            "temperature": round(25 + 10 * np.sin(2 * np.pi * day_of_year / 365) + np.random.normal(0, 1), 1),
            "rainfall_mm": max(0, round(np.random.exponential(5) if 150 < day_of_year < 280 else np.random.exponential(1), 1)),
        })

    return pd.DataFrame(records)


def generate_socioeconomic_features(station: Dict) -> Dict[str, float]:
    """Generate hydro-socioeconomic input features for DHSF model."""
    np.random.seed(hash(station["id"]) % (2**31))
    return {
        "agricultural_area_pct": round(np.random.uniform(20, 70), 1),
        "irrigation_intensity":  round(np.random.uniform(0.3, 0.9), 2),
        "industrial_units_per_km2": round(np.random.uniform(1, 50), 1),
        "population_density":    round(np.random.uniform(200, 5000), 0),
        "annual_rainfall_mm":    round(np.random.uniform(400, 1800), 0),
        "evapotranspiration_mm": round(np.random.uniform(600, 1400), 0),
        "soil_permeability":     round(np.random.uniform(0.1, 0.9), 2),
        "surface_water_index":   round(np.random.uniform(0.2, 0.8), 2),
    }


def get_all_stations() -> List[Dict]:
    """Return all stations with current computed status."""
    result = []
    for s in STATIONS:
        df = generate_historical_readings(s, days=30)
        latest = df.iloc[-1]["water_level"]
        prev    = df.iloc[-7]["water_level"]

        if latest < s["base_level"] * 0.60:
            status = "critical"
        elif latest < s["base_level"] * 0.80:
            status = "warning"
        else:
            status = "normal"

        trend = "declining" if latest < prev - 0.5 else ("rising" if latest > prev + 0.5 else "stable")

        result.append({
            **s,
            "waterLevel":  round(latest, 2),
            "status":      status,
            "trend":       trend,
            "lastReading": "2 min ago",
        })
    return result


def get_regional_summary(stations: List[Dict] = None) -> List[Dict]:
    """Aggregate station counts by region and health status."""
    from collections import defaultdict
    agg = defaultdict(lambda: {"stations": 0, "critical": 0, "warning": 0, "normal": 0})

    source_stations = stations if stations is not None else get_all_stations()

    for s in source_stations:
        r = s.get("region", "North")
        agg[r]["stations"] += 1
        agg[r][s.get("status", "normal")] += 1

    # Define the intended regional "scale" for the UI
    # We use smaller numbers if using real data to keep it grounded, 
    # or keep large numbers if we want to show "National Scale".
    region_extras = {"North": 892, "South": 1240, "East": 756, "West": 1456, "Central": 916}
    
    rows = []
    for region, extra_total in region_extras.items():
        base = agg[region]
        
        # If we have real stations in this region, use their status distribution
        if base["stations"] > 0:
            c_pct = base["critical"] / base["stations"]
            w_pct = base["warning"] / base["stations"]
            
            # Scale up to the "extra_total"
            critical = int(extra_total * c_pct)
            warning  = int(extra_total * w_pct)
            # Ensure at least some variety if the source has alerts
            if base["critical"] > 0 and critical == 0: critical = 1
            if base["warning"] > 0 and warning == 0: warning = 1
        else:
            # Fallback for regions with no real stations (like Central)
            critical = 0
            warning  = 0

        normal = extra_total - critical - warning
        
        rows.append({
            "region":   region,
            "stations": extra_total,
            "critical": critical,
            "warning":  warning,
            "normal":   max(0, normal),
        })
    return rows
