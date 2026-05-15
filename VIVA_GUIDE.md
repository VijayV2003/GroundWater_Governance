# Groundwater Intelligence Platform — Capstone Viva Guide

> **How to use this:** Read each section as if the examiner just asked that question.  
> Bold text = what you say out loud. Formula lines = write on board if asked.

---

## PART 1 — THE OPENING PITCH (First 2 minutes)

**"Sir/Ma'am, our project is the Computational Groundwater Governance Platform.**

**India has a critical groundwater crisis — 60% of irrigation and 85% of drinking water comes from groundwater, yet levels are declining at 0.3–1 metre every year in many states. The Central Ground Water Board monitors this through 5,260+ DWLR stations (Digital Water Level Recorders) across India, but the data is raw — no automated analysis, no predictions, no alerts to decision-makers.**

**We built a full-stack AI platform that:**
1. **Takes that raw DWLR sensor data**
2. **Runs it through 7 specialised ML models simultaneously**
3. **Displays a live governance dashboard for officials**
4. **Automatically emails policy-makers when a station goes critical**

**The tech stack is FastAPI (Python backend) + React (frontend) + Firebase (auth/database) + 7 ML models from scikit-learn and XGBoost."**

---

## PART 2 — SYSTEM ARCHITECTURE (If asked "explain your architecture")

**"The system has 3 tiers:"**

```
React Frontend (Vercel CDN)
        ↓  REST API calls
FastAPI Backend (Render cloud)
        ↓  reads/writes
Firebase Firestore + joblib model cache
```

**"When the backend server starts, it does 3 things before accepting any request:"**
1. Loads all 7 ML models from `.joblib` files into RAM (so every prediction takes <5ms)
2. Pre-trains per-station forecasters for all 5 DWLR stations
3. Starts a background task that emails policymakers every 5 minutes

**"The frontend uses custom React hooks. Every hook wraps an API call and falls back to realistic mock data if the backend is unreachable — so the dashboard always renders."**

---

## PART 3 — DASHBOARD KPI CALCULATIONS (Most Important for Viva)

This is what the examiner will drill into. Here is **every number on the dashboard** and exactly how it is computed.

---

### KPI 1: Average Water Level (metres)

**Endpoint:** `GET /api/dashboard/summary`  
**Code location:** `main.py` → `dashboard_summary()`

**Calculation:**
```python
stations = get_all_real_stations_with_status(limit=100)
levels   = [s["waterLevel"] for s in stations]
avg_water_level = round(numpy.mean(levels), 1)
```

**What to say:** *"We fetch the latest water level reading for each active station, then compute the arithmetic mean. The reading itself is the last value in the station's generated time-series — a 365-day array of daily depth values in metres below ground level."*

---

### KPI 2: Groundwater Sustainability Index (GSI %) — The Key Metric

**Endpoint:** `GET /api/dashboard/summary`  
**Code location:** `main.py` lines ~496–497

**Calculation (Dashboard version — simplified):**
```python
baselines = [s["base_level"] for s in stations]   # historical reference depth per station
levels    = [s["waterLevel"] for s in stations]    # current depth per station
ratios    = [baseline / current  for baseline, current in zip(baselines, levels)]
gsi       = int(numpy.clip(numpy.mean(ratios) * 80, 0, 100))
```

**Formula:**
```
GSI (dashboard) = clip(mean(baseline_i / current_i) × 80,  0, 100)
```

**What to say:** *"We take each station's baseline depth (the healthy historical reference, e.g., 45 m) divided by current depth. If the water table has dropped — meaning current depth is now 50 m instead of 45 m — the ratio is 45/50 = 0.9, which is less than 1, meaning degradation. We average these ratios and multiply by 80 to scale to a 0–100 index. The 80 is a calibration constant so that a perfectly healthy aquifer (ratio = 1.0) scores 80, not 100 — leaving headroom for improvement signals."*

> **Note:** The full 7-sub-score GSI (Model 5) is more rigorous. The dashboard uses this quick version for real-time KPI cards.

---

### KPI 3: Active Alerts Count

**Calculation:**
```python
active_alerts = sum(1 for s in statuses if s in ("warning", "critical"))
critical_count = sum(1 for s in statuses if s == "critical")
warning_count  = sum(1 for s in statuses if s == "warning")
```

**Station status is determined by:**
```python
# In real_data_ingestion.py
if latest_level > base_level * 1.4:    # depth more than 40% below baseline
    status = "critical"
elif latest_level > base_level * 1.1:  # depth more than 10% below baseline
    status = "warning"
else:
    status = "normal"
```

**What to say:** *"A station is marked critical when its current water table depth exceeds 140% of its baseline depth — meaning it has dropped more than 40% below the historical safe level. Warning is triggered at 110%. These thresholds are based on CGWB's Semi-Critical and Critical classification norms."*

---

### KPI 4: Online Percentage

```python
online_pct = round(100 * sum(1 for s in statuses if s != "offline") / len(statuses), 1)
```

---

### KPI 5: Regional Summary (the table)

**Endpoint:** `GET /api/dashboard/regional`  
**Code:** `data_generator.py` → `get_regional_summary()`

**Calculation:**
```python
# We have 5 real stations. We scale their status distribution to national totals.
region_totals = {"North": 892, "South": 1240, "East": 756, "West": 1456, "Central": 916}

for region, total in region_totals.items():
    c_pct = critical_count_in_region / station_count_in_region
    w_pct = warning_count_in_region  / station_count_in_region
    critical = int(total * c_pct)
    warning  = int(total * w_pct)
    normal   = total - critical - warning
```

**What to say:** *"We have 5 real DWLR stations. To simulate the national scale of 5,260 stations, we compute the fraction of critical/warning stations in each region from our real data, then proportionally scale up to the reported national totals per region from the CGWB 2022 publication."*

---

### KPI 6: Trend (per station — declining / stable / rising)

```python
# In real_data_ingestion.py
latest = last reading in time-series
prev   = reading from 7 days ago

if latest > prev + 0.1:    # depth is increasing = water table dropping
    trend = "declining"
elif latest < prev - 0.1:  # depth is decreasing = water table rising
    trend = "rising"
else:
    trend = "stable"
```

**What to say:** *"Note the direction: in groundwater, depth is measured as metres below ground level. A higher number means the water table is deeper — which is worse. So an increasing depth value = declining trend."*

---

## PART 4 — THE 7 ML MODELS (One by one)

---

### MODEL 1: Groundwater Level Forecasting

**Algorithm:** Ridge Regression with Fourier features  
**File:** `forecasting.py`

**What it does:** Predicts water level for the next 24 hours to 365 days.

**How it works — explain in 3 steps:**

**Step 1 — Build features from history:**
```
Feature vector = [y(t-1), y(t-2), ..., y(t-7),    ← last 7 readings (lag features)
                  sin(2πt/365), cos(2πt/365),       ← annual seasonality
                  sin(4πt/365), cos(4πt/365),       ← semi-annual
                  sin(6πt/365), cos(6πt/365)]       ← tri-annual
```
Total: 13 features per sample.

**Step 2 — Ridge Regression minimises:**
```
Loss = Σ(actual - predicted)²  +  α × Σ(weights²)
```
The second term (L2 regularisation) prevents the 7 correlated lag features from inflating each other's coefficients.

**Step 3 — Recursive prediction:**
Each predicted value becomes the next lag input. Predict step t+1, feed it in, predict t+2, and so on.

**Why not LSTM?** *"LSTMs need thousands of training samples and GPU compute. Our Ridge model trains in under 1 second on a CPU and achieves comparable accuracy for the 365-day cycles we need."*

**Why Fourier?** *"India's groundwater has a strong annual pattern — levels drop Nov–May, recover Jun–Oct with monsoon. Fourier sin/cos terms encode this cyclic pattern mathematically without needing dates as raw inputs."*

---

### MODEL 2: DHSF — Depletion Cause Classification

**Algorithm:** XGBoost (200 gradient-boosted trees)  
**File:** `dhsf.py`

**What it does:** Classifies WHY the groundwater is depleting:
- `agricultural` — irrigation overuse
- `industrial` — industrial extraction
- `climate` — rainfall deficit
- `urban` — urban demand

**11 input features:** agricultural_area_pct, irrigation_intensity, industrial_units_per_km², population_density, annual_rainfall_mm, evapotranspiration_mm, soil_permeability, surface_water_index, depletion_rate_m/year, seasonal_amplitude_m, recharge_deficit_mm.

**How XGBoost works:**
```
Start: initial prediction F₀(x)
For m = 1 to 200:
    compute pseudo-residuals  r_i = -(d Loss / d F(x_i))
    fit new tree h_m to residuals
    update: F_m(x) = F_{m-1}(x) + 0.1 × h_m(x)
```
Each tree corrects the errors of the previous ensemble. Learning rate 0.1 ensures small steps = better generalisation.

**Output:** Probabilities for all 4 classes via Softmax. These become the pie chart in Model Insights.

**Why XGBoost over Random Forest?** *"XGBoost uses sequential boosting — each tree focuses on correcting previous errors. Random Forest uses parallel independent trees. For tabular socioeconomic data, XGBoost consistently outperforms Random Forest in literature benchmarks (Chen & Guestrin, KDD 2016)."*

---

### MODEL 3: Anomaly Detection

**Algorithm:** Isolation Forest (150 trees)  
**File:** `anomaly_detection.py`

**What it does:** Flags unusual readings — rapid depletion, abnormal fluctuation, recharge failure, sensor fault.

**Core idea of Isolation Forest:**
*"Anomalous points are rare and different. In a random partition tree, it takes FEWER splits to isolate an anomaly than a normal point. We build 150 random trees and measure average isolation depth."*

**Score formula:**
```
s(x) = 2^(−E[h(x)] / c(n))

E[h(x)] = average path length across 150 trees
c(n) = expected path length for dataset of size n (normalisation)

s → 1.0: anomalous (isolated quickly)
s → 0.5: normal
```

**Feature extraction (vectorised):**  
For each 7-point sliding window: `[mean, std, min, max, range, slope, last_delta]`

Uses `numpy.lib.stride_tricks` — no Python loops, O(n) complexity.

**Classification on top:**
| Anomaly Type | Rule |
|---|---|
| rapid_depletion | 6-step delta < −1.5 m |
| abnormal_fluctuation | window std > 1.5 m |
| recharge_failure | Jun–Sep season + no positive delta |
| sensor_fault | level < 0.5 m or > 200 m |

**Why not a simple threshold?** *"A fixed threshold like 'alert if level > 50m' cannot detect sensor drift, unusual oscillations, or recharge failures. Isolation Forest learns normal behaviour patterns holistically and flags deviations — it's unsupervised, so no labelled anomaly data is needed."*

---

### MODEL 4: Monsoon Recharge Prediction

**Algorithm:** Gradient Boosting Regressor + MultiOutputRegressor  
**File:** `recharge_prediction.py`

**What it does:** Predicts monthly natural recharge (mm) and artificial recharge (mm) for a full year.

**8 input features:** month_sin, month_cos, monthly_rainfall, ET/12, soil_moisture, surface_water_level, land_use_index, antecedent_rainfall_30d.

**Key design choices:**

1. **Cyclic month encoding:**
```
month_sin = sin(2π × month / 12)
month_cos = cos(2π × month / 12)
```
*"Raw month integers (1–12) would tell the model January and December are maximally different. Sin/cos places them adjacent on a circle — which is physically correct."*

2. **India monsoon weights:**
```
[2,2,3,4,5,14,22,20,14,8,4,2]  (Jan–Dec, sum=100)
```
*"Jul–Aug–Sep account for 56% of annual rainfall in India. These weights come from IMD climatological averages (Parthasarathy et al., 1994)."*

3. **Antecedent rainfall:** Yesterday's soil saturation affects today's recharge. Raw water balance equations ignore this; our ML model learns it.

**Output:** 12-month array `{month, natural, artificial, total}` → shown as stacked bar chart.

---

### MODEL 5: Groundwater Sustainability Index (GSI)

**Algorithm:** Weighted rule-based scoring (no ML training)  
**File:** `gsi_dherp.py`

**What it does:** Produces a 0–100 score and risk band (Sustainable / Moderate / High Risk / Critical).

**Full formula:**
```
GSI = 0.40×S1  +  0.30×S2  +  0.20×S3  +  0.10×S4
```

| Sub-score | Formula | What It Measures | Weight |
|---|---|---|---|
| S1 (Level Deficit) | `clip((current/baseline − 0.3) / 0.7 × 100, 0, 100)` | How close to baseline depth | 40% |
| S2 (Recharge Balance) | `clip(recharge_rate / extraction_rate × 60, 0, 100)` | Recharge vs extraction ratio | 30% |
| S3 (Trend) | `clip(50 + trend_slope × −30, 0, 100)` | Long-term direction | 20% |
| S4 (Climate Support) | `clip(climatic_support × 100, 0, 100)` | Rainfall favourability | 10% |

**Why rule-based, not ML?** *"Sustainability indices need to be auditable by non-technical policymakers. A black-box Random Forest saying 'score=43' cannot be explained in a parliamentary committee. Every weight here is explicitly justified and can be changed by policy — this mirrors GWSI frameworks from the World Bank and CGWB."*

**Why 40/30/20/10 weights?**
- S1 is the most directly observable in the field (manual depth gauge)
- S2 is the most policy-actionable (check dams, percolation ponds)
- S3 is a lagging indicator (5-year planning)
- S4 is uncontrollable (climate)

---

### MODEL 6: DH-ERP (Hydro-Energetic Restoration Potential)

**Algorithm:** Pure physics — no ML  
**File:** `gsi_dherp.py`

**What it does:** Answers "How much will it cost and how long will it take to restore this aquifer?"

**Step-by-step derivation:**

**Step 1 — Volume deficit:**
```
Volume (m³) = Area(m²) × specific_yield × (baseline_depth − current_depth)
```
*specific_yield = 0.15 (15% of aquifer volume is drainable pore space — CGWB standard for alluvial aquifers)*

**Step 2 — Mean lift height:**
```
H_mean = (current_depth + baseline_depth) / 2
```

**Step 3 — Energy to pump water back in:**
```
Energy (kWh) = (ρ × g × H_mean × Volume) / (η × 3.6×10⁶)

ρ = 1000 kg/m³ (water density)
g = 9.81 m/s²
η = 0.72 (72% pump efficiency — BIS IS 8034:2002)
3.6×10⁶ = Joules per kWh
```

**Step 4 — Cost:**
```
Cost (₹) = Energy × ₹6.50/kWh   (CERC 2024 industrial tariff)
Cost (Crore ₹) = Cost / 10,000,000
```

**Step 5 — Restoration time:**
```
Time (years) = Volume / annual_recharge_capacity
```

**DHERP Index:**
```
DHERP = clip(depth_deficit / baseline × 100,  0, 100)
```

**Why physics, not ML?** *"This is a deterministic engineering calculation. The inputs are physical constants — there is no uncertainty to learn statistically. Using ML here would introduce unnecessary approximation into an equation that can be solved exactly. The value of this model is translating 'water level dropped 5 metres' into '₹240 Crore over 60 months' — something a Finance Ministry official can act on."*

---

### MODEL 7: Aquifer Stress Classification

**Algorithm:** Random Forest (200 trees, class_weight='balanced')  
**File:** `aquifer_stress.py`

**What it does:** Classifies the aquifer into CGWB 2022 official stress categories:
- **Safe** (extraction stage < 70%)
- **Semi-Critical** (70–90%)
- **Critical** (90–100%)
- **Over-Exploited** (> 100%)

**8 features:** fluctuation_amplitude_m, extraction_intensity, soil_infiltration_rate, pre_monsoon_depth_m, post_monsoon_depth_m, long_term_trend_m/yr, stage_of_extraction_pct, number_of_wells_per_km².

**How Random Forest works:**
```
Build 200 trees independently.
Each tree:
  - Bootstrap sample from training data (~63% unique samples per tree)
  - At each node: consider only √8 ≈ 3 random features (not all 8)
  - Split on feature that maximises Gini gain:
      Gini(node) = 1 − Σ(p_k²)
  - Grow to max_depth=8

Final prediction = majority vote of all 200 trees
Probability = fraction of trees voting for each class
```

**`class_weight='balanced'`:** *"In real data, Safe zones vastly outnumber Over-Exploited zones. Without balancing, the model would predict Safe for everything and still get 70% accuracy. Balanced weights force the model to pay attention to rare but critical Over-Exploited cases."*

**Output:** Stress class + recommended policy actions (hardcoded per class, based on CGWB 2022 norms).

---

## PART 5 — HOW THE EMAIL ALERT SYSTEM WORKS

**"The backend runs a background asyncio task that loops every 5 minutes:"**

```python
while True:
    await asyncio.sleep(300)
    
    # 1. Fetch policymaker emails from Firebase Firestore
    emails = fetch_policy_maker_emails()
    
    # 2. Get live station data
    stations = get_all_real_stations_with_status()
    critical = [s for s in stations if s["status"] == "critical"]
    warning  = [s for s in stations if s["status"] == "warning"]
    
    # 3. Compute dashboard GSI
    gsi = int(clip(mean(baselines/levels) * 80, 0, 100))
    
    # 4. Build HTML email with station badges + KPI row
    # 5. Send via SendGrid API
```

**Firebase email fetch:** Uses Firestore REST API (not firebase-admin SDK) to get all users with `role == "policymaker"` and `status == "approved"`. Falls back to `.env` `POLICY_MAKERS_EMAILS` variable if Firebase is unreachable.

---

## PART 6 — ROLE-BASED ACCESS CONTROL

**Three roles stored in Firestore:**

| Role | Registration | Access |
|---|---|---|
| `general` | Self-register, auto-approved | Basic dashboard only |
| `policymaker` | Self-register, claims role | Full reports, Model Insights, DH-ERP cost, email alerts |
| `admin` | Manually seeded | Everything + Admin panel to approve/reject policymaker requests |

**How it works technically:**
1. User logs in via Firebase Auth
2. `AuthContext.js` does `getDoc(db, 'users', uid)` to fetch role + status
3. React context exposes `userRole` to all components
4. Sensitive components check `userRole === 'policymaker' || userRole === 'admin'`

---

## PART 7 — DATA FLOW (End to End)

```
1. Server starts → lifespan() loads 7 models into RAM

2. User opens dashboard → React fetches:
   GET /api/stations         → 5 stations with status
   GET /api/dashboard/summary → KPI cards (GSI, alerts, avg level)
   GET /api/dashboard/regional → regional table

3. User clicks a station → ModelInsights tab calls 7 APIs in parallel:
   GET /api/models/forecast/DWLR001   → Ridge prediction
   GET /api/models/dhsf/DWLR001       → XGBoost cause
   GET /api/models/anomaly/DWLR001    → Isolation Forest
   GET /api/models/recharge/DWLR001   → GBR prediction
   GET /api/models/gsi/DWLR001        → GSI score
   GET /api/models/dherp/DWLR001      → Physics cost
   GET /api/models/stress/DWLR001     → Random Forest class

4. Every 5 minutes → background email dispatched to policymakers

5. Frontend polls /api/alerts every 30 seconds → anomaly feed updates
```

---

## PART 8 — ANTICIPATED VIVA QUESTIONS & ANSWERS

---

**Q: Why did you choose FastAPI over Flask or Django?**

*"FastAPI provides native async/await support — critical for our background email coroutine and Firestore REST calls to run concurrently with ML inference without blocking. It also auto-generates Pydantic input validation for all 12 endpoints, and produces interactive /docs documentation automatically. Flask is synchronous by default and requires extensions for both features."*

---

**Q: Your training data is synthetic. How is this valid?**

*"The synthetic data is generated from physics equations that mirror real groundwater behaviour — monsoon seasonality using empirical IMD rainfall weights, long-term depletion trends from CGWB field reports, and Gaussian noise matching real sensor measurement errors. For DHSF and Aquifer Stress, the class distributions are calibrated to CGWB 2022 published norms for each category. A government API key for data.gov.in is already wired into the codebase — it's a one-line switch."*

---

**Q: What is overfitting, and how did you prevent it?**

*"Overfitting is when a model memorises training data and fails on new data. We prevent it three ways:*
1. *Ridge Regression has L2 regularisation (α=1.0) that shrinks coefficients*
2. *Random Forest uses 200 diverse trees each trained on a bootstrap sample — averaging reduces variance*
3. *XGBoost uses a learning rate of 0.1 — small steps prevent any single tree from dominating"*

---

**Q: Why Isolation Forest for anomaly detection and not a threshold system?**

*"A fixed threshold like 'alert if depth > 50m' cannot detect sensor drift (level oscillating unusually at a normal depth), recharge failures (monsoon season but no recovery), or abnormal rate-of-change events. Isolation Forest learns the multivariate pattern of normal behaviour across 7 statistical features per window and flags deviations holistically. It's also unsupervised — we don't need labelled 'this reading was an anomaly' examples, which don't exist in our dataset."*

---

**Q: What is the GSI and why 40/30/20/10 weights?**

*"The Groundwater Sustainability Index is a composite 0–100 score combining four dimensions: level deficit (40%), recharge balance (30%), long-term trend (20%), and climate support (10%). The weights reflect governance priorities: the level deficit is weighted highest because it's what field officers can directly observe and report. Recharge balance is second because check dams and percolation ponds — CGWB's primary intervention — directly improve this score. Trend is a lagging indicator useful for 5-year policy targets. Climate support is uncontrollable so carries the least weight."*

---

**Q: How does the email alert system work?**

*"An asyncio background coroutine runs inside the FastAPI process and sleeps for 300 seconds between iterations. On each iteration it fetches policymaker emails from Firebase Firestore using the REST API — not the firebase-admin SDK, to avoid a 35MB dependency. It then queries all station statuses, computes the dashboard GSI, builds an HTML email with per-station critical/warning badges, and dispatches via SendGrid's API."*

---

**Q: What are the limitations of your project?**

*"Three key limitations:*
1. *Synthetic data — the CGWB API stub exists but is not activated. With a government API key the switch is one line of code.*
2. *Recursive forecast error — Model 1's predictions accumulate error beyond 14 days. Prophet with confidence intervals would fix this.*
3. *No shared cache between Gunicorn workers — the in-memory time-series cache is per-process. Redis would solve this for production scale."*

---

**Q: How does role-based access work?**

*"Firebase Auth generates a JWT token on login. The React AuthContext fetches the user's Firestore document using their Firebase UID and reads the role and status fields. All sensitive components check this context — policymaker views (DH-ERP cost, full reports, email notification history) are hidden from the general role entirely at the component level, not just visually."*

---

**Q: Can this scale to all 5,260 CGWB stations?**

*"The current architecture would need three upgrades for full scale: Redis for shared time-series caching across Gunicorn workers, Celery for distributed background model inference jobs, and WebSocket push notifications to replace the 30-second polling on the alerts feed. The ML models themselves scale horizontally — each is a lightweight sklearn/XGBoost object that can run independently per station."*

---

**Q: What is specific yield and why 0.15?**

*"Specific yield is the fraction of aquifer volume that actually drains when the water table drops. Not all pore space releases water — some is retained by capillary forces. 0.15 means 15% of the aquifer volume between baseline and current depth is drainable water. This is the CGWB standard value for alluvial aquifers like those in the Indo-Gangetic Plain, taken from the CGWB Aquifer Mapping and Management Plan (2017)."*

---

## PART 9 — NUMBERS TO MEMORISE FOR VIVA

| Fact | Value |
|---|---|
| DWLR stations in India (CGWB) | 5,260+ |
| Stations in our platform | 5 (DWLR001–005) |
| ML models | 7 |
| API endpoints | 12 |
| Alert email interval | 5 minutes (300 seconds) |
| Frontend alert poll interval | 30 seconds |
| Anomaly detector size | 2.3 MB (.joblib) |
| Isolation Forest trees | 150 |
| XGBoost trees (DHSF) | 200 |
| Random Forest trees (Stress) | 200 |
| Ridge lag window | 7 days |
| Fourier harmonics | 3 (k=1,2,3) |
| Total feature vector (Model 1) | 13 features |
| DHSF features | 11 |
| Stress features | 8 |
| GSI weights | 40/30/20/10 |
| Pump efficiency constant | 72% (BIS IS 8034:2002) |
| Electricity tariff | ₹6.50/kWh (CERC 2024) |
| Specific yield | 0.15 (CGWB alluvial aquifer norm) |
| Training samples DHSF | 2,000 |
| Training samples Stress | 3,000 |
| Dataset period | 2015–2022 (Atal Jal CSV) |
| Backend hosting | Render (gunicorn 4 workers) |
| Frontend hosting | Vercel |
| Database | Firebase Firestore |
| Email provider | SendGrid |
