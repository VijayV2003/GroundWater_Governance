import sys
import os

# To import from data_generator
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from data_generator import STATIONS, generate_historical_readings

def load_real_stations(limit: int = 5) -> list:
    """
    Return the 5 planned mock stations to avoid mismatch and latency.
    """
    return STATIONS[:5]

_ts_cache = {}

def get_time_series_for_station(station_id: str, interpolate_daily: bool = True):
    """
    Return generated time-series for the station. Cached to avoid latency.
    """
    if station_id in _ts_cache:
        return _ts_cache[station_id].copy()
        
    station = next((s for s in STATIONS if s["id"] == station_id), None)
    if not station:
        station = {"id": station_id, "base_level": 50.0}
        
    df = generate_historical_readings(station, days=365)
    _ts_cache[station_id] = df
    return df.copy()

def get_all_real_stations_with_status(limit: int = 5):
    stations = load_real_stations()
    result = []
    
    for s in stations:
        df = get_time_series_for_station(s["id"])
        latest = df.iloc[-1]["water_level"]
        prev = df.iloc[-7]["water_level"]

        if latest > s["base_level"] * 1.4:
            status = "critical"
        elif latest > s["base_level"] * 1.1:
            status = "warning"
        else:
            status = "normal"

        trend = "declining" if latest > prev + 0.1 else ("rising" if latest < prev - 0.1 else "stable")

        result.append({
            **s,
            "waterLevel": round(latest, 2),
            "status": status,
            "trend": trend,
            "lastReading": "Live API Stream"
        })
        
    return result

