# 🌊 Groundwater Intelligence Platform

> **A real-time, AI-powered groundwater governance system for India — built on the Atal Jal DWLR dataset (2015–2022) with 7 live ML models, role-based access control, automated policy report generation, and real-time stakeholder email alerts.**

[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Frontend](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react)](https://reactjs.org/)
[![AI](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?logo=google)](https://deepmind.google/technologies/gemini/)
[![Auth](https://img.shields.io/badge/Auth-Firebase-FFCA28?logo=firebase)](https://firebase.google.com/)
[![Deploy](https://img.shields.io/badge/Deploy-Render%20%2B%20Vercel-black)](https://render.com/)

---

## 📋 Table of Contents

1. [Overview](#-overview)
2. [Live Demo](#-live-demo)
3. [Architecture](#-architecture)
4. [ML Models (7 Models)](#-ml-models--7-models)
5. [Features](#-features)
6. [Tech Stack](#-tech-stack)
7. [Project Structure](#-project-structure)
8. [Getting Started (Local)](#-getting-started-local)
9. [Environment Variables](#-environment-variables)
10. [API Reference](#-api-reference)
11. [Deployment](#-deployment)
12. [Role-Based Access](#-role-based-access)
13. [Data Source](#-data-source)
14. [Contributing](#-contributing)

---

## 🎯 Overview

The **Groundwater Intelligence Platform** is a full-stack decision-support system designed for India's groundwater governance ecosystem. It ingests real DWLR (Digital Water Level Recorder) data from the **Atal Jal programme**, runs 7 machine-learning models in real time, and surfaces actionable insights for District Collectors, policymakers, and water resource managers.

### Core Capabilities

| Capability | Description |
|---|---|
| 📡 **Real-Time Monitoring** | Live water level readings from 5 DWLR stations across India |
| 🤖 **7 ML Models** | Forecasting, anomaly detection, recharge prediction, stress classification, and more |
| 📄 **AI Policy Reports** | Google Gemini generates Word document policy briefs for District Collectors |
| 📧 **Automated Alerts** | SendGrid emails sent every 5 minutes to registered policymakers |
| 🗺️ **Interactive Map** | Leaflet map with trend-coded markers and station selection |
| 🔐 **Role-Based Auth** | Firebase Authentication with General / Policymaker / Admin tiers |
| 📊 **Conservation Simulator** | 5-lever water-balance model with 10-year aquifer projection chart |
| 🏛️ **Policy Impact Analysis** | 4 policy scenarios with full 5-section brief outlines |

---

## 🌐 Live Demo

| Service | URL |
|---|---|
| **Frontend** | https://ground-water-governance.vercel.app  |
| **Backend API** | [https://groundwater-governance.onrender.com](https://groundwater-governance.onrender.com/docs) |
| **API Docs** |[ https://groundwater-governance.onrender.com/docs](https://groundwater-governance.onrender.com/docs) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────────────┐ │
│  │  Dashboard   │  │Station Monitor│  │   Policy Tools        │ │
│  │  (7 KPI cards│  │  (Leaflet Map │  │ ┌─Report Generator   │ │
│  │   + charts)  │  │  + DWLR table)│  │ ├─Conservation Sim   │ │
│  └──────────────┘  └───────────────┘  │ └─Policy Analysis    │ │
│  ┌──────────────┐  ┌───────────────┐  └───────────────────────┘ │
│  │Model Insights│  │  Alerts Tab   │                             │
│  │  (7 ML tabs) │  │(live feed)    │                             │
│  └──────────────┘  └───────────────┘                             │
│            │                │                                     │
│     Firebase Auth     React Hooks + Axios                        │
└─────────────────────────────────────────────────────────────────┘
                              │
              REACT_APP_API_BASE_URL (env)
                              │
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI on Render)                    │
│                                                                  │
│   Startup RAM: ~30 MB  ←  ALL heavy imports lazy-loaded         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              7 ML Model Endpoints                         │   │
│  │  /api/models/forecast   → Model 1 (Ridge Regression)     │   │
│  │  /api/models/dhsf       → Model 2 (RandomForest DHSF)   │   │
│  │  /api/models/anomaly    → Model 3 (IsolationForest)      │   │
│  │  /api/models/recharge   → Model 4 (GBT Recharge)         │   │
│  │  /api/models/gsi        → Model 5 (GSI Score)            │   │
│  │  /api/models/dherp      → Model 6 (DH-ERP Index)         │   │
│  │  /api/models/stress     → Model 7 (XGBoost Stress)       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐    │
│  │  Data Layer  │  │   Gemini API   │  │ SendGrid Email   │    │
│  │  (CSV + ext) │  │ (Report gen.)  │  │ (5-min alerts)   │    │
│  └──────────────┘  └────────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                   FIREBASE (Google Cloud)                        │
│          Authentication  ·  Firestore (policymaker emails)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🤖 ML Models — 7 Models

### Model 1 — Groundwater Level Forecaster
- **Algorithm:** Ridge Regression with lag + Fourier seasonality features
- **Input:** Historical DWLR readings (7-lag window)
- **Output:** 30-day water level forecast (m bgl) with trend classification
- **File:** `backend/forecasting.py`

### Model 2 — DHSF Depletion Cause Classifier
- **Algorithm:** Random Forest Classifier
- **Input:** Depletion rate, seasonal amplitude, rainfall deficit, socioeconomic proxies
- **Output:** Cause class (Agricultural / Industrial / Climate / Mixed) + confidence
- **File:** `backend/dhsf.py`

### Model 3 — Anomaly Detection
- **Algorithm:** Isolation Forest
- **Input:** Historical time series for a station (rolling window)
- **Output:** Anomaly flags, severity scores, alert generation
- **File:** `backend/anomaly_detection.py`

### Model 4 — Monsoon Recharge Predictor
- **Algorithm:** Gradient Boosted Trees (GBT)
- **Input:** Annual rainfall, evapotranspiration, soil moisture, land use index
- **Output:** Monthly recharge estimates (mm) + monsoon summary
- **File:** `backend/recharge_prediction.py`

### Model 5 — Groundwater Sustainability Index (GSI)
- **Algorithm:** Physics-informed scoring function
- **Input:** Current level, baseline, recharge/extraction ratio, trend slope
- **Output:** GSI score (0–100) + sustainability category
- **File:** `backend/gsi_dherp.py`

### Model 6 — DH-ERP Economic Recovery Potential
- **Algorithm:** Hydrological-economic formula (Darcy's Law derived)
- **Input:** Current vs baseline level, aquifer area, specific yield, electricity tariff
- **Output:** Recovery volume (MCM), energy cost (₹ Crore), economic potential score
- **File:** `backend/gsi_dherp.py`

### Model 7 — Aquifer Stress Classifier
- **Algorithm:** XGBoost Classifier (5-class)
- **Input:** 8 hydrogeological features (fluctuation, extraction intensity, trend slope, etc.)
- **Output:** Stress class (Safe / Moderate / Critical / Over-Exploited / Degraded) + confidence + remediation actions
- **File:** `backend/aquifer_stress.py`

---

## ✨ Features

### 🖥️ Dashboard
- 6 live KPI cards: total stations, online %, active alerts, average water level, sustainability index, depletion rate
- Area chart: 12-month water level trend
- Bar chart: monthly recharge prediction
- Pie chart: depletion cause breakdown
- Regional summary table with health scores

### 🗺️ Station Monitor
- Interactive Leaflet satellite map
- **Trend-coded markers**: 🟢 Rising · 🟡 Stable · 🔴 Declining
- **Ring = Status**: critical (dark red ring) · warning (amber ring) · normal (white ring)
- Click marker → Station Details panel with water level bar, trend card, and "View Model Insights" button
- Full DWLR station table with search and region filter

### 📊 Model Insights
- Per-station deep-dive panel for all 7 models
- Scrollable tab layout with live API data
- Forecast chart (actual + predicted traces)
- Anomaly heatmap, recharge bar charts, stress gauge

### 🚨 Alerts
- Live anomaly feed across all stations
- Severity badges: CRITICAL / WARNING / INFO
- Timestamps + recommended actions

### 🏛️ Policy Tools (Policymaker / Admin only)

#### Water Security Report Generator
- Captures the Model Insights panel as a PNG snapshot (html2canvas)
- Calls Google Gemini API (gemini-2.0-flash-lite) with a ~120-token prompt
- Downloads a fully formatted Word document (`.docx`) with 5-section policy brief
- **Crash-proof**: Falls back to a structured template if Gemini fails — user always gets a report

#### Conservation Strategy Simulator
- 5 interactive sliders: Rainfall Change, Extraction Reduction, Rainwater Harvesting, Crop Diversification, Industrial Efficiency
- **Real-time physics model**: Water-balance equation computes results on every slider move (no API call)
- 6 output metrics: GSI score, Depletion Rate, Recharge Rate, Extraction Index, Net Balance, Recovery Years
- Scenario presets: Baseline / Drought / Conservation / Aggressive
- 10-year aquifer level projection chart (Recharts LineChart, baseline vs intervention)

#### Policy Impact Analysis
- 4 policy options: Subsidized Micro-Irrigation · Energy Tariff Hike · Mandatory Rainwater Harvesting · Crop Diversification Mandate
- Per-policy impact card: depletion reduction %, recharge increase %, GSI improvement, risk badge, timeframe, budget
- Full 5-section policy brief outline (Executive Summary → Outcomes) rendered inline

### 🔐 Authentication & Role Control

| Role | Access |
|---|---|
| **General** | Dashboard + Station Monitor only |
| **Policymaker** | All tabs except Admin; reports + policy tools |
| **Admin** | All tabs including Admin Approvals panel |
| **Pending Policymaker** | Locked out with pending approval screen |

---

## 🛠️ Tech Stack

### Backend
| Package | Version | Purpose |
|---|---|---|
| FastAPI | 0.111.0 | REST API framework |
| Uvicorn | 0.29.0 | ASGI server |
| Gunicorn | 21.2.0 | Production process manager |
| Pandas | 2.1.4 | Data ingestion + wrangling |
| NumPy | 1.26.4 | Numerical computation |
| Scikit-learn | 1.4.2 | Ridge, RandomForest, IsolationForest, GBT |
| XGBoost | 2.0.3 | Aquifer stress classifier |
| Joblib | 1.4.0 | Model persistence (`.joblib` files) |
| google-generativeai | 0.5.4 | Gemini API for report generation |
| python-docx | 1.1.0 | Word document creation |
| SendGrid | 6.11.0 | Automated email alerts |
| firebase-admin | 6.3.0 | Firestore policymaker email lookup |
| python-dotenv | 1.0.1 | Environment variable management |

### Frontend
| Package | Purpose |
|---|---|
| React 18 | UI framework |
| Recharts | Interactive data charts |
| React Leaflet | Interactive satellite map |
| Lucide React | Icon library |
| html2canvas | Model Insights panel snapshot for reports |
| Firebase JS SDK | Authentication + Firestore |
| Axios | HTTP client for API calls |

### Infrastructure
| Service | Role |
|---|---|
| **Render** | Backend hosting (Free tier, 512 MB RAM) |
| **Vercel** | Frontend hosting |
| **Firebase Auth** | User authentication |
| **Firebase Firestore** | Policymaker email registry |
| **Google AI Studio** | Gemini API key |
| **SendGrid** | Transactional email |

---

## 📁 Project Structure

```
GroundWatermain/
├── README.md
├── DEPLOYMENT.md
├── TECHNICAL_DOCUMENT.md
│
├── backend/
│   ├── main.py                          # FastAPI app — all 7 model endpoints
│   ├── requirements.txt                 # Pinned Python dependencies
│   ├── .env                             # Local secrets (not committed)
│   ├── Dockerfile                       # Optional Docker build
│   │
│   ├── forecasting.py                   # Model 1 — Ridge Regression forecaster
│   ├── dhsf.py                          # Model 2 — DHSF depletion classifier
│   ├── anomaly_detection.py             # Model 3 — Isolation Forest detector
│   ├── recharge_prediction.py           # Model 4 — GBT recharge predictor
│   ├── gsi_dherp.py                     # Model 5 & 6 — GSI + DH-ERP scoring
│   ├── aquifer_stress.py                # Model 7 — XGBoost stress classifier
│   │
│   ├── data_generator.py                # Synthetic data + socioeconomic proxies
│   ├── firebase_utils.py                # Firestore policymaker email fetcher
│   ├── send_now.py                      # One-shot email sender utility
│   ├── train_pipeline.py                # Offline model training script
│   │
│   ├── data/
│   │   └── real_data_ingestion.py       # CSV loader + live extrapolation engine
│   │
│   ├── saved_models/                    # Persisted .joblib model files
│   │   ├── dhsf_model.joblib
│   │   ├── recharge_predictor.joblib
│   │   ├── stress_classifier.joblib
│   │   ├── global_anomaly_detector.joblib
│   │   └── forecaster_DWLR*.joblib      # Per-station forecasters
│   │
│   └── Atal_Jal_Disclosed_Ground_Water_Level-2015-2022.csv
│
└── frontend/
    ├── public/
    ├── package.json
    ├── .env.production                  # REACT_APP_API_BASE_URL
    │
    └── src/
        ├── App.js
        ├── GroundwaterMonitoringSystem.jsx  # Main app (Dashboard, Map, Policy Tools)
        ├── firebase.js                      # Firebase SDK config
        │
        ├── api/
        │   └── groundwaterApi.js            # Centralized Axios API client
        │
        ├── hooks/
        │   └── useGroundwaterData.js        # React Query hooks for all endpoints
        │
        ├── components/
        │   └── ModelInsights.jsx            # 7-model deep-dive component
        │
        └── context/
            └── AuthContext.jsx              # Firebase auth + role context
```

---

## 🚀 Getting Started (Local)

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Google account (for Firebase + Gemini API key)
- A SendGrid account (free tier is sufficient)

### 1. Clone the repository

```bash
git clone https://github.com/VijayV2003/GroundWater_Governance.git
cd GroundWater_Governance
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate    # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your API keys (see Environment Variables section below)

# Start the backend
uvicorn main:app --reload --port 8000
```

Backend will be available at: `http://localhost:8000`  
Interactive API docs: `http://localhost:8000/docs`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure API URL
echo "REACT_APP_API_BASE_URL=http://localhost:8000" > .env.local

# Start the frontend
npm start
```

Frontend will be available at: `http://localhost:3000`

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

```env
# ── Email Alerts (SendGrid) ───────────────────────────────────────
SENDGRID_API_KEY=SG.your_key_here
SENDGRID_SENDER_EMAIL=your_verified_sender@domain.com

# ── Policymaker Recipients (comma-separated) ──────────────────────
POLICY_MAKERS_EMAILS=collector@district.gov.in,jal.board@gov.in

# ── Toggle automated alerts ───────────────────────────────────────
ENABLE_EMAIL_ALERTS=true

# ── Google Gemini (for AI report generation) ──────────────────────
GEMINI_API_KEY=AIzaSy...your_key_here

# ── CGWB Live API (optional — for real-time government data) ──────
# CGWB_API_KEY=your_data.gov.in_key
```

### Frontend (`frontend/.env.production`)

```env
REACT_APP_API_BASE_URL=https://your-render-service.onrender.com
```

> ⚠️ **Never commit `.env` files.** They are already listed in `.gitignore`.

---

## 📡 API Reference

All endpoints are documented interactively at `/docs` (Swagger UI).

### System
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health + model load status |
| `GET` | `/` | Redirects to `/docs` |

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stations` | All DWLR stations with live status |
| `GET` | `/api/dashboard/summary` | 12 KPI metrics for the dashboard |
| `GET` | `/api/dashboard/regional` | Per-region aggregation |
| `GET` | `/api/alerts` | Live anomaly alert feed |

### ML Model Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/models/forecast` | Model 1: Custom forecast request |
| `GET` | `/api/models/forecast/{station_id}` | Model 1: Default 30-day forecast |
| `POST` | `/api/models/dhsf` | Model 2: Custom DHSF classification |
| `GET` | `/api/models/dhsf/{station_id}` | Model 2: Auto-classify from time series |
| `GET` | `/api/models/anomaly/{station_id}` | Model 3: Anomaly detection |
| `POST` | `/api/models/recharge` | Model 4: Custom recharge prediction |
| `GET` | `/api/models/recharge/{station_id}` | Model 4: Auto-recharge from station |
| `POST` | `/api/models/gsi` | Model 5: GSI score |
| `GET` | `/api/models/gsi/{station_id}` | Model 5: Auto-GSI from station |
| `POST` | `/api/models/dherp` | Model 6: DH-ERP index |
| `GET` | `/api/models/dherp/{station_id}` | Model 6: Auto DH-ERP from station |
| `POST` | `/api/models/stress` | Model 7: Aquifer stress classification |
| `GET` | `/api/models/stress/{station_id}` | Model 7: Auto-stress from station |

### Policy Tools
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/policy/generate-report/{station_id}` | Generate Word policy brief (Gemini + fallback) |

---

## 🚀 Deployment

### Backend → Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000`
5. Add Environment Variables from your `.env` file
6. Deploy

> ⚠️ **Use `-w 1` (1 worker) on Render's free tier.** Multiple workers each load all models, multiplying RAM usage.

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repository
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Create React App
4. Add Environment Variables:
   - `REACT_APP_API_BASE_URL` = your Render backend URL
   - `CI` = `false`
5. Deploy

### Firebase Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password provider)
3. Enable **Firestore Database**
4. Go to **Authentication → Settings → Authorized Domains** and add your Vercel URL
5. Download your service account key and add to Render environment as `FIREBASE_SERVICE_ACCOUNT_JSON`

---

## Memory Optimisation (Render Free Tier)

The backend is engineered to run within Render's **512 MB RAM** limit via **full lazy loading**:

| What loads at startup | RAM |
|---|---|
| FastAPI + Pydantic + stdlib only | ~30 MB |
| **What does NOT load at startup** | |
| numpy / pandas / scikit-learn / xgboost | ~300 MB (deferred) |
| google-generativeai (gRPC + protobuf) | ~80 MB (deferred) |
| python-docx | ~25 MB (deferred) |
| sendgrid / firebase-admin | ~15 MB (deferred) |

Every heavy import lives **inside the function that needs it**, loaded on first request and cached for subsequent calls via singleton pattern with thread-safe double-checked locking.

---

## 👥 Role-Based Access

Roles are stored in Firebase Firestore under each user's document. The frontend reads the role at login and gates tabs accordingly.

| Feature | General | Policymaker | Admin |
|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ |
| Station Monitor | ✅ | ✅ | ✅ |
| Alerts Tab | ❌ | ✅ | ✅ |
| Model Insights | ❌ | ✅ | ✅ |
| Policy Tools | ❌ | ✅ | ✅ |
| Report Download | ❌ | ✅ | ✅ |
| Admin Approvals | ❌ | ❌ | ✅ |
| Email Notifications | ❌ | ✅ (receives) | ✅ |

New policymaker registrations are placed in a **pending** state until approved by an admin.

---

## 📂 Data Source

**Dataset:** Atal Jal Disclosed Ground Water Level — 2015 to 2022  
**Provider:** Ministry of Jal Shakti, Government of India  
**Format:** CSV — ~1.1 MB, ~40,000 readings across DWLR monitoring stations  
**Coverage:** 5 primary stations used: Delhi NCR, Mumbai Suburban, Chennai Central, Bangalore Urban, Kolkata Metro  
**Extrapolation:** The last known reading for each station is extrapolated forward to the current date using a stochastic trend model, enabling real-time-style data until a live CGWB API key is provisioned.

### Live API Hook
A documented stub in `data/real_data_ingestion.py` allows swapping from extrapolated data to live CGWB / data.gov.in feeds by setting the `CGWB_API_KEY` environment variable — zero other code changes required.

---

## 🔧 Running the Training Pipeline (Optional)

To retrain all 7 models from scratch and persist them to `saved_models/`:

```bash
cd backend
python train_pipeline.py
```

> Models are already pre-trained and committed to `saved_models/`. Only run this if you change the training data or model architecture.

---

## 📄 License

This project was developed for the **Atal Jal Groundwater Governance Programme** under academic research. All data is sourced from publicly disclosed government datasets.

---

## 👨‍💻 Author

**Vijay V** — Full-stack developer, ML engineer  
GitHub: [@VijayV2003](https://github.com/VijayV2003)  
Repository: [GroundWater_Governance](https://github.com/VijayV2003/GroundWater_Governance)

---

<div align="center">

**Built with 🌊 for India's water security**

*"What gets measured gets managed."*

</div>
