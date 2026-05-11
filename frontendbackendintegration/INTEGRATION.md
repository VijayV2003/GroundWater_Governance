# Frontend Integration Guide

Drop these files into your existing React project to connect the UI to the 7 ML model backend.

---

## Files to add / replace

```
src/
├── App.js                                   ← replace (minor update)
├── GroundwaterMonitoringSystem.jsx          ← replace (API-connected version)
├── api/
│   └── groundwaterApi.js                   ← NEW – centralised API client
├── hooks/
│   └── useGroundwaterData.js               ← NEW – custom React hooks
└── components/
    ├── ModelInsights.jsx                    ← NEW – 7-model insights tab
    └── ApiStatusBanner.jsx                 ← NEW – live/mock status indicator
.env.example                                ← NEW – copy to .env.local
```

---

## What changed

### `src/api/groundwaterApi.js`
All `fetch()` calls in one place.  Every model has a typed function:

| Export | Calls |
|--------|-------|
| `fetchStations()` | `GET /api/stations` |
| `fetchDashboardSummary()` | `GET /api/dashboard/summary` |
| `fetchForecast(id)` | `GET /api/models/forecast/:id` |
| `fetchDHSF(id)` | `GET /api/models/dhsf/:id` |
| `fetchAnomalies(id)` | `GET /api/models/anomaly/:id` |
| `fetchRecharge(id)` | `GET /api/models/recharge/:id` |
| `fetchGSI(id)` | `GET /api/models/gsi/:id` |
| `fetchDHERP(id)` | `GET /api/models/dherp/:id` |
| `fetchStress(id)` | `GET /api/models/stress/:id` |
| `fetchFullReport(id)` | `GET /api/station/:id/full-report` |

### `src/hooks/useGroundwaterData.js`
Each hook wraps an API call with `{ data, loading, error, refresh }`.  
If the backend is down, hooks transparently use bundled mock data — no broken UI.

```js
// Example usage in any component:
import { useGSI, useForecast } from '../hooks/useGroundwaterData';

function MyPanel({ stationId }) {
  const { data: gsi, loading } = useGSI(stationId);
  const { data: fc  }          = useForecast(stationId, 24);
  // …
}
```

### `src/GroundwaterMonitoringSystem.jsx` — key changes

| Old (static) | New (live) |
|---|---|
| `const [dwlrStations]  = useState([…])` | `const { data: stations } = useStations()` |
| `const waterLevelData  = […]` | Comes from `useForecast(activeStationId)` |
| `const rechargeData    = […]` | Comes from `useRecharge(activeStationId)` |
| `const depletionFactors= […]` | Comes from `useDHSF(activeStationId)` |
| `const sustainabilityIndex` | Comes from `useGSI(activeStationId)` |
| `useEffect → alertTimer` | `useAlerts(30000)` auto-polls every 30 s |
| 4 tabs | 5 tabs — added **Model Insights** |

### New tab – Model Insights
Click any station in Station Monitor, then open **Model Insights** to see all 7 model outputs:
- Forecast bar chart (Model 1)
- DHSF depletion pie + cause badge (Model 2)
- Anomaly status + recent events (Model 3)
- Monthly recharge stacked bar (Model 4)
- GSI radar chart + score (Model 5)
- DH-ERP progress bars (Model 6)
- Stress class + probability bars + recommended actions (Model 7)

### `ApiStatusBanner`
Small floating chip bottom-right:
- 🟢 **Connected** – shows backend URL
- 🟡 **Mock data mode** – shows how to start the server

---

## Quick start

```bash
# Terminal 1 – start the ML backend
cd groundwater_models
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 – start the React frontend
cd your-react-project
cp .env.example .env.local      # optional, defaults to localhost:8000
npm install
npm start
```

Then visit http://localhost:3000 and click any station → **Model Insights**.

---

## Auto-refresh & polling

| Data | Refresh strategy |
|------|-----------------|
| Stations | On mount + manual Refresh button |
| Dashboard KPIs | On mount |
| Alerts | On mount + every 30 s automatically |
| Model outputs | On station selection change |
| Full report | On demand (button) |
