# Computational Groundwater Governance Platform — Technical Document

**Version:** 2.0.0 | **Date:** May 2026

---

## 1. Tech Stack

### Backend
| Layer | Technology | Purpose |
|---|---|---|
| Web Framework | FastAPI (Python) | High-performance async REST API |
| ASGI Server | Uvicorn + Gunicorn | Production server with 4 workers |
| ML Core | Scikit-Learn | Ridge, Isolation Forest, Random Forest, GBR |
| ML Boost | XGBoost | DHSF depletion cause classifier |
| Data Processing | Pandas + NumPy | Time-series ingestion and feature engineering |
| Model Persistence | Joblib | Serialising/loading trained model objects |
| Email Alerts | SendGrid API | Transactional HTML alert emails |
| Config | python-dotenv | Environment variable management |
| Containerisation | Docker | Portable backend deployment |

### Frontend
| Layer | Technology | Purpose |
|---|---|---|
| Framework | React 19 (CRA) | Component-driven UI |
| Styling | Tailwind CSS 3 | Utility-first responsive design |
| Charts | Recharts 3 | Bar, Pie, Radar, Line charts |
| Maps | React-Leaflet + Leaflet | Interactive station map |
| Icons | Lucide-React | Consistent icon set |
| PDF Export | jsPDF + html2canvas | Station report download |
| Routing | React Router DOM v7 | Client-side navigation |
| Auth | Firebase Auth | Email/password authentication |
| Database | Firebase Firestore | User roles and policy-maker registry |

### Infrastructure & Deployment
| Service | Platform |
|---|---|
| Backend Hosting | Render (gunicorn + uvicorn workers) |
| Frontend Hosting | Vercel (auto-detected CRA build) |
| Auth & DB | Firebase (cloud-hosted) |
| CI Config | `CI=false` flag, `.npmrc` legacy-peer-deps |

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────┐
│                  FRONTEND (Vercel)                    │
│  React 19 │ Tailwind │ Recharts │ React-Leaflet       │
│                                                       │
│  AuthContext (Firebase) ──► ProtectedRoute            │
│  useGroundwaterData hooks ──► groundwaterApi.js       │
│                                                       │
│  Pages: Dashboard │ Station Monitor │ Model Insights  │
│         Admin Panel │ Login │ Register                │
└─────────────────────┬────────────────────────────────┘
                      │  REST/JSON
                      │  REACT_APP_API_BASE_URL
                      ▼
┌──────────────────────────────────────────────────────┐
│                  BACKEND (Render)                     │
│  FastAPI │ Uvicorn │ CORS Middleware                  │
│                                                       │
│  Lifespan startup:                                    │
│    Load/train 7 ML models → cache as .joblib         │
│    Pre-warm 5 station forecasters                     │
│    Launch asyncio background email task (5 min)       │
│                                                       │
│  12 REST Endpoints across 7 ML models                 │
└──────────┬────────────────────────┬──────────────────┘
           │                        │
           ▼                        ▼
┌──────────────────┐   ┌─────────────────────────┐
│  saved_models/   │   │  Firebase Firestore       │
│  10 .joblib files│   │  Collection: users        │
│  ~3.7 MB total   │   │  role, status, email      │
└──────────────────┘   └─────────────────────────┘
```

### Key Architectural Decisions

**1. Startup Model Warming (`lifespan` event)**
All 7 models are loaded from `.joblib` cache (or trained fresh) before the first request is served. Per-station forecasters are pre-warmed for all 5 DWLR stations, eliminating cold-start latency entirely.

**2. Graceful Mock Fallback (Frontend)**
Every custom hook wraps its API call in `try/catch`. On failure it falls back to station-specific `STATION_PROFILES` mock data, so the UI always renders — even when the backend is offline.

**3. Background Email Worker**
A long-running `asyncio.create_task` coroutine sends policy-maker alerts every 5 minutes. Recipients are fetched dynamically from Firestore via the REST API (avoiding the heavy `firebase-admin` SDK), with a `.env` fallback.

**4. Dual Data Path**
- **Synthetic path**: `data_generator.py` generates physics-based time-series (monsoon sine wave, 0.008 m/day depletion trend, Gaussian noise, ±5 m anomaly events).
- **Live API hook**: A documented stub in `main.py` (lines 71–86) is ready for a `data.gov.in` CGWB API key — zero other changes needed.

---

## 3. Features Implemented

### Dashboard
- **KPI Cards**: Total stations, average water level (m bgl), active alerts, GSI %.
- **Interactive Map**: Leaflet map with colour-coded markers (green/yellow/red) and clickable popups.
- **Regional Summary Table**: 5 regions with station counts scaled to ~5,260 national stations.
- **Live Alert Feed**: Auto-polls every 30 seconds; surfaces anomaly events as critical/warning/info badges.

### Station Monitor
- Station list with status badges, trend arrows, and water level readings.
- Click-through to 7-model full report via "View Full Report".

### Model Insights Tab
- Dedicated card for each of the 7 ML models per selected station.
- Inline Recharts visualisations: Bar (forecast, recharge), Pie (DHSF factors), Radar (GSI sub-scores), MiniBar (DH-ERP costs).

### Authentication & Role-Based Access
- **Three roles**: `admin`, `policymaker`, `general`.
- Firebase Auth handles login/registration; Firestore stores role and approval status.
- `ProtectedRoute` blocks unauthenticated access.
- Admin panel: approve/reject pending `policymaker` applications via Firestore `updateDoc`.
- Sensitive views (full reports, notifications) restricted to `policymaker`/`admin`.

### Automated Email Alerting
- Branded HTML email: per-station critical/warning badges, KPI row, suggested policy actions, CTA button to the live dashboard.
- `send_now.py`: standalone script for immediate manual dispatch.
- Background task in `main.py`: automatic dispatch every 5 minutes during server uptime.

---

## 4. ML Models — Detailed Breakdown

---

### Model 1 — Groundwater Level Forecasting
**File:** `forecasting.py`

**Algorithm:** Ridge Regression in a `StandardScaler → Ridge(α=1.0)` sklearn Pipeline.

**Feature Engineering:**
- **Lag features**: Last 7 water-level readings (auto-regressive).
- **Fourier features**: sin/cos pairs for harmonics k=1,2,3 over a 365-day period — captures annual monsoon seasonality.
- Combined vector: `[lag_1…lag_7, sin1, cos1, sin2, cos2, sin3, cos3]` = 13 features per sample.

**Inference:** Recursive multi-step — each predicted value is appended to the lag window and used for the next step (up to 365 days).

**Why better than alternatives:**

| Alternative | Problem |
|---|---|
| ARIMA | Manual order selection; no built-in Fourier seasonality |
| Simple moving average | No trend extrapolation; flat forecast |
| LSTM / Prophet | Requires GPU or long training; overkill for 5-station edge deployment |
| **Ridge + Fourier** | Lightweight, interpretable, trains in <1 s, handles cyclic monsoon natively |

---

### Model 2 — Dynamic Hydro-Socioeconomic Fingerprinting (DHSF)
**File:** `dhsf.py`

**Algorithm:** `XGBClassifier` (200 trees, max_depth=5, lr=0.1, eval_metric=mlogloss).

**Classes:** `agricultural | industrial | climate | urban`

**11 Features:** agricultural_area_pct, irrigation_intensity, industrial_units_per_km2, population_density, annual_rainfall_mm, evapotranspiration_mm, soil_permeability, surface_water_index, depletion_rate_m_per_year, seasonal_amplitude_m, recharge_deficit_mm.

**Training:** 2,000 synthetic samples from domain-knowledge multivariate normal distributions (e.g., agricultural class = high ag_area [55–85%] + high irrigation [0.6–0.95] + low industrial units [1–10/km²]).

**Output:** Predicted cause + class probability pie chart (`depletion_factors`) + ranked feature importances.

**Auto-mode:** Derives `depletion_rate_m_per_year` from time-series linear trend and socioeconomic features from seeded region-matched generator.

**Why better than alternatives:**

| Alternative | Problem |
|---|---|
| Logistic Regression | Linear boundary; misses interaction effects between agri + climate |
| Rule-based thresholds | Brittle; cannot generalise across India's diverse agro-climatic zones |
| Random Forest | XGBoost shows superior performance on structured tabular data |
| Neural Network | Requires large labelled dataset; no interpretable feature importances |

---

### Model 3 — Anomaly Detection
**File:** `anomaly_detection.py`

**Algorithm:** `IsolationForest` (150 trees, contamination=0.05) inside a `StandardScaler` pipeline.

**Vectorised Feature Extraction (O(n) via stride tricks):**
Uses `np.lib.stride_tricks.as_strided` for a W=7 sliding window. Per window: mean, std, min, max, range, closed-form linear slope, last-step delta.

**Anomaly Classification (on top of IF score):**
- `rapid_depletion`: 6-step delta < −1.5 m
- `abnormal_fluctuation`: window std > 1.5 m
- `recharge_failure`: monsoon season (Jun–Sep) + no positive delta
- `sensor_fault`: level < 0.5 m or > 200 m

**Severity:** critical (|score| > 2.5), warning (|score| > 1.5).

**Why better than alternatives:**

| Alternative | Problem |
|---|---|
| Fixed threshold (level < X) | Cannot detect structural anomalies (drift, oscillation) |
| Z-score on raw level | Seasonal trends cause high false-positive rate |
| LSTM Autoencoder | Needs labelled anomaly data; complex training |
| **Isolation Forest** | Unsupervised; trains on normal behaviour only; fast O(n log n) |

---

### Model 4 — Monsoon Recharge Prediction
**File:** `recharge_prediction.py`

**Algorithm:** `GradientBoostingRegressor` (150 trees, max_depth=4) wrapped in `MultiOutputRegressor` to simultaneously predict `natural_recharge_mm` and `artificial_recharge_mm`.

**8 Features:** month_sin, month_cos (cyclic encoding), monthly_rainfall_mm, monthly_ET_mm, soil_moisture_pct, surface_water_level_m, land_use_idx, antecedent_rainfall_30d.

**Seasonal distribution:** India monsoon weights `[2,2,3,4,5,14,22,20,14,8,4,2]` applied to annual rainfall to derive monthly inputs.

**Output:** 12-month array `[{month, natural, artificial, total}]` + monsoon vs. non-monsoon summary.

**Why better than alternatives:**

| Alternative | Problem |
|---|---|
| Water-balance equation | Ignores antecedent soil saturation; flat seasonal assumption |
| Linear regression | Cannot model non-linear ET × rainfall interaction |
| LSTM | Needs long sequential training data; complex deployment |
| **GBR + MultiOutput** | Non-linear, sin/cos seasonality, trains in <2 s |

---

### Model 5 — Groundwater Sustainability Index (GSI)
**File:** `gsi_dherp.py`

**Algorithm:** Weighted rule-based scoring (no ML training).

**Formula:**
```
GSI = 0.40×S1 + 0.30×S2 + 0.20×S3 + 0.10×S4

S1 (Level deficit)    = clip((current/baseline − 0.3) / 0.7 × 100, 0, 100)
S2 (Recharge balance) = clip(recharge_rate / extraction_rate × 60, 0, 100)
S3 (Trend)            = clip(50 + trend_slope × −30, 0, 100)
S4 (Climate support)  = clip(climatic_recharge_support × 100, 0, 100)
```

**Risk Bands:** Sustainable (75–100 🟢), Moderate (50–75 🟡), High Risk (25–50 🔴), Critical (0–25 🟤).

**Why better:** A single composite index is more actionable for policy makers than raw meter readings. The 40/30/20/10 weighting mirrors internationally recognised GWSI frameworks, prioritising the most directly observable (level deficit) and most policy-actionable (recharge balance) dimensions.

---

### Model 6 — Dynamic Hydro-Energetic Restoration Potential (DH-ERP)
**File:** `gsi_dherp.py`

**Algorithm:** Physics-based calculation (no ML).

**Physics:**
```
Volume deficit (m³) = Area(m²) × specific_yield × (baseline − current_depth)
Mean lift height (m) = (current_depth + baseline_depth) / 2
Energy (kWh)         = (ρ × g × H_mean × Volume) / (pump_efficiency × 3.6×10⁶)
Cost (INR)           = Energy × ₹6.50/kWh  [India 2024 avg]
Cost (Crore INR)     = Cost_INR / 10⁷
Restoration time     = Volume_deficit / annual_recharge_capacity
DHERP index (0–100)  = clip(depth_deficit / baseline × 100, 0, 100)
```

**Constants:** pump efficiency 72%, water density 1000 kg/m³, gravity 9.81 m/s², specific yield 0.15.

**Why it matters:** Translates an abstract "5 m depth deficit" into a concrete ₹240 Crore / 60-month restoration programme — directly usable in government budget proposals.

---

### Model 7 — Aquifer Stress Classification
**File:** `aquifer_stress.py`

**Algorithm:** `RandomForestClassifier` (200 trees, max_depth=8, class_weight="balanced") in a `StandardScaler` pipeline.

**Classes (CGWB 2022 norms):** `Safe | Semi-Critical | Critical | Over-Exploited`

**8 Features:** fluctuation_amplitude_m, extraction_intensity, soil_infiltration_rate, pre_monsoon_depth_m, post_monsoon_depth_m, long_term_trend_m_yr, stage_of_extraction_pct, number_of_wells_per_km2.

**Training:** 3,000 synthetic samples (750/class) calibrated to CGWB norms (e.g., Over-Exploited: stage >100%, trend −0.5 to −1.2 m/yr, well density 50–120/km²).

**Output:** Stress class + colour + probability distribution + ranked policy action recommendations per class.

**Why better than alternatives:**

| Alternative | Problem |
|---|---|
| Single-metric (extraction %) | CGWB data shows 30%+ misclassification rate with single metric |
| SVM | Slower inference; less interpretable feature importances |
| Logistic Regression | Cannot capture non-linear interactions (high wells + good infiltration ≠ critical) |
| **Random Forest** | Ensemble voting; robust to outliers; `balanced` weights handle class imbalance |

---

## 5. Database Usage

### Firebase Firestore (`groundwater-46059`)
**Collection:** `users`

| Field | Type | Purpose |
|---|---|---|
| `email` | string | User email address |
| `role` | string | `admin` / `policymaker` / `general` |
| `status` | string | `pending` / `approved` / `rejected` |

- **Frontend** (`AuthContext.js`): `getDoc` on login to load role + status into React context.
- **Admin panel** (`AdminDashboard.jsx`): Compound `where` query for pending policymakers; `updateDoc` to approve/reject.
- **Backend** (`firebase_utils.py`): Firestore REST API fetches approved policymaker emails for alert dispatch (no firebase-admin SDK needed). Falls back to `POLICY_MAKERS_EMAILS` env var.

### Model Cache (`backend/saved_models/`)
Acts as a binary model database, persisted to disk.

| File | Size | Contents |
|---|---|---|
| `global_anomaly_detector.joblib` | 2.3 MB | Fitted IsolationForest pipeline |
| `dhsf_model.joblib` | 721 KB | Fitted XGBClassifier |
| `recharge_predictor.joblib` | 721 KB | Fitted GBR MultiOutput pipeline |
| `stress_classifier.joblib` | 338 KB | Fitted RandomForest pipeline |
| `forecaster_DWLR00{1-5}.joblib` | ~1.7 KB ea. | Per-station Ridge forecasters |
| `reference_forecaster.joblib` | 1.6 KB | From train_pipeline.py |

### CSV Dataset
`Atal_Jal_Disclosed_Ground_Water_Level-2015-2022.csv` (1.1 MB) — Government of India DWLR data. Currently used as schema reference; synthetic generator follows its data model.

---

## 6. API Endpoints Reference

| Method | Path | Model | Description |
|---|---|---|---|
| GET | `/health` | — | Server status, models loaded, station count |
| GET | `/api/stations` | — | All 5 DWLR stations with live status |
| GET | `/api/dashboard/summary` | — | KPI cards (GSI, alerts, avg level) |
| GET | `/api/dashboard/regional` | — | Regional aggregation table |
| GET | `/api/alerts` | Model 3 | Live anomaly alert feed |
| GET/POST | `/api/models/forecast/{id}` | Model 1 | 24-h / custom forecast |
| GET/POST | `/api/models/dhsf/{id}` | Model 2 | Depletion cause classification |
| GET | `/api/models/anomaly/{id}` | Model 3 | Anomaly detection results |
| GET/POST | `/api/models/recharge/{id}` | Model 4 | Monthly recharge prediction |
| GET/POST | `/api/models/gsi/{id}` | Model 5 | GSI sustainability score |
| GET/POST | `/api/models/dherp/{id}` | Model 6 | Restoration energy/cost/time |
| GET/POST | `/api/models/stress/{id}` | Model 7 | Aquifer stress classification |
| GET | `/api/station/{id}/full-report` | All 7 | Composite report — all models |

---

## 7. Limitations

### Data Limitations
1. **Synthetic time-series**: `data_generator.py` produces physics-based but not real DWLR readings.
2. **Socioeconomic proxy**: DHSF features (population density, agricultural area) are generated by a seeded random function — not real census or IMD data.
3. **5 stations only**: Hard-limited to avoid latency. National scale (~5,260 stations) is simulated in the regional summary via proportional scaling.
4. **No live CGWB API**: The `data.gov.in` stream stub is present in `main.py` (lines 71–86) but inactive pending a government API key.

### Technical Limitations
5. **Single-process model training**: Models train inside the FastAPI process. At scale (1,000+ stations) this would block without a task queue.
6. **In-memory time-series cache**: `_ts_cache` is a Python dict — lost on restart, not shared across Gunicorn workers.
7. **CORS open**: `allow_origins=["*"]` must be tightened before production hardening.
8. **Unconditional email every 5 min**: Dispatches regardless of whether conditions changed — risk of spamming policy makers.
9. **Recursive forecast error accumulation**: Multi-step predictions accumulate error; uncertainty is high beyond ~14 days.
10. **GSI fixed weights**: The 40/30/20/10 split is expert-defined, not learned from data.

---

## 8. Future Scope

### Data & Integration
| Priority | Feature |
|---|---|
| 🔴 High | Activate CGWB / `data.gov.in` API key — swap stub in `real_data_ingestion.py` |
| 🔴 High | Ingest real Atal Jal CSV rows per station (currently only schema-matched synthetic) |
| 🟡 Medium | GRACE/GRACE-FO satellite TWS anomaly overlay for macro-scale validation |
| 🟡 Medium | IMD rainfall API for real-time Model 4 recharge inputs |
| 🟢 Low | Direct IoT/MQTT sensor ingestion |

### ML & Analytics
| Priority | Feature |
|---|---|
| 🔴 High | Retrain DHSF/Stress on real labelled CGWB 2022 assessment data |
| 🔴 High | Replace Ridge forecaster with Prophet (uncertainty intervals) |
| 🟡 Medium | LSTM Autoencoder for richer temporal anomaly patterns |
| 🟡 Medium | Conformal prediction intervals on all regression models |
| 🟢 Low | Federated learning across state DWLR networks |

### Platform & Scalability
| Priority | Feature |
|---|---|
| 🔴 High | Redis for shared `_ts_cache` across Gunicorn workers |
| 🔴 High | Celery + Redis task queue for background model inference at scale |
| 🟡 Medium | WebSocket push for real-time updates (replace 30-second polling) |
| 🟡 Medium | Flutter / React Native mobile app for field officers |
| 🟡 Medium | Conditional email alerts — dispatch only when status changes |
| 🟢 Low | Gemini LLM integration — auto-generate printable PDF policy briefs from Model 7 recommendations |
| 🟢 Low | Multi-tenant dashboards with state-level admin roles |

---

## 9. Project File Map

```
GroundWatermain/
├── backend/
│   ├── main.py                    # FastAPI app, 12 endpoints, lifespan startup
│   ├── forecasting.py             # Model 1 — Ridge + Fourier forecaster
│   ├── dhsf.py                    # Model 2 — XGBoost depletion classifier
│   ├── anomaly_detection.py       # Model 3 — Isolation Forest detector
│   ├── recharge_prediction.py     # Model 4 — GBR recharge predictor
│   ├── gsi_dherp.py               # Model 5 (GSI) + Model 6 (DH-ERP)
│   ├── aquifer_stress.py          # Model 7 — Random Forest stress classifier
│   ├── data_generator.py          # Synthetic DWLR time-series generator
│   ├── firebase_utils.py          # Firestore REST fetch for policymaker emails
│   ├── train_pipeline.py          # Offline pre-training script
│   ├── send_now.py                # Manual email dispatch script
│   ├── data/real_data_ingestion.py # Station loader + in-memory cache
│   ├── saved_models/              # 10 .joblib model files (~3.7 MB)
│   ├── requirements.txt           # fastapi, uvicorn, sklearn, xgboost, sendgrid…
│   └── Dockerfile                 # Container definition
│
├── frontend/
│   ├── src/
│   │   ├── GroundwaterMonitoringSystem.jsx  # Main dashboard (~58 KB)
│   │   ├── api/groundwaterApi.js            # All fetch calls + mock data
│   │   ├── hooks/useGroundwaterData.js      # 10 custom hooks with mock fallback
│   │   ├── context/AuthContext.js           # Firebase auth + role state
│   │   ├── firebase.js                      # Firebase SDK initialisation
│   │   └── components/
│   │       ├── ModelInsights.jsx            # 7-model panel grid
│   │       ├── AdminDashboard.jsx           # Policymaker approval UI
│   │       ├── Login.jsx / Register.jsx     # Auth screens
│   │       ├── ProtectedRoute.jsx           # Route guard
│   │       └── ApiStatusBanner.jsx          # Backend connectivity banner
│   └── package.json               # React 19, recharts, leaflet, firebase, jspdf
│
├── DEPLOYMENT.md                  # Render + Vercel + Firebase guide
└── TECHNICAL_DOCUMENT.md          # This document
```
