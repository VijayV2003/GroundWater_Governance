import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.real_data_ingestion import get_time_series_for_station, load_real_stations
from anomaly_detection import AnomalyDetector
from forecasting import GroundwaterForecaster

# Just to ensure we're targeting the right directory
BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, 'saved_models')

def train_all_models():
    print("Starting ML Pipeline Training with Real Atal Jal Dataset...")
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    stations = load_real_stations(limit=50) # Use a subset for training reference
    if not stations:
        print("No stations found. Check dataset path.")
        return

    # Train a global AnomalyDetector using the first comprehensive station as a baseline
    print("Training Anomaly Detector...")
    ref_station = stations[0]
    ref_df = get_time_series_for_station(ref_station['id'], interpolate_daily=True)
    
    global_detector = AnomalyDetector(contamination=0.05)
    global_detector.fit(ref_df)
    detector_path = os.path.join(MODELS_DIR, 'global_anomaly_detector.joblib')
    global_detector.save(detector_path)
    print(f"Saved anomaly detector to {detector_path}")
    
    # Train Forecasting model
    # We'll just train a general model on the reference dataset as well
    # Or in the API we'll fit dynamically. But let's demonstrate serialization.
    print("Training Reference Forecaster...")
    levels = ref_df["water_level"].values
    ref_forecaster = GroundwaterForecaster(lags=7)
    ref_forecaster.fit(levels)
    forecast_path = os.path.join(MODELS_DIR, 'reference_forecaster.joblib')
    ref_forecaster.save(forecast_path)
    print(f"Saved reference forecaster to {forecast_path}")

    print("Training complete! Models are serialized.")

if __name__ == "__main__":
    train_all_models()
