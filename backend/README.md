# Groundwater Intelligence Platform – ML Backend

Python backend powering the React frontend (`GroundwaterMonitoringSystem.js`).
Implements all 7 ML models described in the patent as a **FastAPI REST API**.

---

## Architecture

```
groundwater_models/
├── main.py                    # FastAPI app — all REST endpoints
├── requirements.txt
├── data/
│   └── data_generator.py      # Synthetic DWLR station data (5 000+ stations)
└── models/
    ├── forecasting.py          # Model 1 – Groundwater Level Forecasting
    ├── dhsf.py                 # Model 2 – Dynamic Hydro-Socioeconomic Fingerprinting
    ├── anomaly_detection.py    # Model 3 – Anomaly Detection
    ├── recharge_prediction.py  # Model 4 – Monsoon Recharge Prediction
    ├── gsi_dherp.py            # Model 5 – GSI Scoring + Model 6 – DH-ERP Index
    └── aquifer_stress.py       # Model 7 – Aquifer Stress Classification
```

---

## The 7 Models

| # | Name | Algorithm | Output |
|---|------|-----------|--------|
| 1 | Groundwater Level Forecasting | Ridge Regression + Fourier seasonality | 24 h / 30-day level predictions |
| 2 | DHSF Depletion Cause Classifier | XGBoost multi-class | agricultural / industrial / climate / urban |
| 3 | Anomaly Detection | Isolation Forest | rapid depletion / fluctuation / recharge failure |
| 4 | Monsoon Recharge Prediction | Gradient Boosted Regressor | monthly natural + artificial recharge (mm) |
| 5 | GSI Scoring Engine | Rule-based + weighted sub-scores | 0–100 sustainability index |
| 6 | DH-ERP Index | Physics-based computation | Energy (GWh) + Cost (₹ Cr) + Months to restore |
| 7 | Aquifer Stress Classification | Random Forest | Safe / Semi-Critical / Critical / Over-Exploited |

---

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start the API server
cd groundwater_models
uvicorn main:app --reload --port 8000

# 3. Open interactive docs
open http://localhost:8000/docs
```

---

## API Endpoints

### Dashboard (feeds the React frontend directly)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stations` | All DWLR stations with current status |
| GET | `/api/dashboard/summary` | KPI cards (active alerts, avg level, GSI %) |
| GET | `/api/dashboard/regional` | Regional aggregation table |
| GET | `/api/alerts` | Real-time anomaly alert list |

### Model Endpoints

| Method | Path | Model |
|--------|------|-------|
| POST | `/api/models/forecast` | Model 1 – Forecasting |
| GET  | `/api/models/forecast/{station_id}` | Model 1 (auto) |
| POST | `/api/models/dhsf` | Model 2 – DHSF |
| GET  | `/api/models/dhsf/{station_id}` | Model 2 (auto) |
| GET  | `/api/models/anomaly/{station_id}` | Model 3 |
| POST | `/api/models/recharge` | Model 4 |
| GET  | `/api/models/recharge/{station_id}` | Model 4 (auto) |
| POST | `/api/models/gsi` | Model 5 |
| GET  | `/api/models/gsi/{station_id}` | Model 5 (auto) |
| POST | `/api/models/dherp` | Model 6 |
| GET  | `/api/models/dherp/{station_id}` | Model 6 (auto) |
| POST | `/api/models/stress` | Model 7 |
| GET  | `/api/models/stress/{station_id}` | Model 7 (auto) |
| GET  | `/api/station/{station_id}/full-report` | All 7 models combined |

---

## Connecting to the React Frontend

In `GroundwaterMonitoringSystem.js`, replace the hard-coded mock data with API calls:

```js
// Replace static dwlrStations array:
const [dwlrStations, setDwlrStations] = useState([]);
useEffect(() => {
  fetch("http://localhost:8000/api/stations")
    .then(r => r.json())
    .then(setDwlrStations);
}, []);

// Replace static waterLevelData:
const [waterLevelData, setWaterLevelData] = useState([]);
useEffect(() => {
  if (!selectedStation) return;
  fetch(`http://localhost:8000/api/models/forecast/${selectedStation.id}`)
    .then(r => r.json())
    .then(d => setWaterLevelData(d.data));
}, [selectedStation]);

// Replace static rechargeData:
useEffect(() => {
  fetch("http://localhost:8000/api/models/recharge/DWLR001")
    .then(r => r.json())
    .then(d => setRechargeData(d.recharge_data));
}, []);

// Replace static sustainabilityIndex:
useEffect(() => {
  fetch("http://localhost:8000/api/dashboard/summary")
    .then(r => r.json())
    .then(d => setSustainabilityIndex(d.sustainability_index));
}, []);

// Replace static alerts:
useEffect(() => {
  fetch("http://localhost:8000/api/alerts")
    .then(r => r.json())
    .then(setAlerts);
}, []);
```

---

## Production Upgrade Path

| Component | Current (MVP) | Production Upgrade |
|-----------|---------------|-------------------|
| Model 1 Forecasting | Ridge + Fourier | Prophet or LSTM (TensorFlow/PyTorch) |
| Model 2 DHSF | XGBoost on synthetic data | Train on real CGWB + census + IMD data |
| Model 3 Anomaly | Isolation Forest | LSTM Autoencoder |
| Model 4 Recharge | GBR on synthetic data | Hydrological model (MODFLOW) ensemble |
| Model 5 GSI | Weighted rules | Bayesian calibrated scoring |
| Data ingestion | Synthetic generator | Kafka + real DWLR API (data.gov.in) |
| Database | In-memory | InfluxDB (time-series) + PostGIS |
| Serving | uvicorn single process | Kubernetes + Ray Serve |

---

## Station IDs Available

`DWLR001` Delhi NCR · `DWLR002` Mumbai · `DWLR003` Chennai · `DWLR004` Bangalore  
`DWLR005` Kolkata · `DWLR006` Hyderabad · `DWLR007` Ahmedabad · `DWLR008` Jaipur  
`DWLR009` Lucknow · `DWLR010` Bhopal
