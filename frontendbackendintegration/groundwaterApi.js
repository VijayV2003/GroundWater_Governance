/**
 * groundwaterApi.js
 * -----------------
 * Centralised API client for the Groundwater Intelligence Platform backend.
 * All fetch calls live here so the rest of the app stays pure UI logic.
 *
 * Base URL can be overridden via REACT_APP_API_BASE_URL env var.
 * Falls back to mock data when the server is unreachable (dev convenience).
 */

export const BASE_URL =
  process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// ─── Generic helpers ──────────────────────────────────────────────────────────

async function get(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

// ─── Dashboard endpoints ──────────────────────────────────────────────────────

/** All DWLR stations with live status. */
export const fetchStations = () => get('/api/stations');

/** KPI card data: total stations, avg level, GSI, alert counts. */
export const fetchDashboardSummary = () => get('/api/dashboard/summary');

/** Regional table rows. */
export const fetchRegionalSummary = () => get('/api/dashboard/regional');

/** Active anomaly alert list (last 20 events). */
export const fetchAlerts = () => get('/api/alerts');

// ─── Model 1 – Forecasting ────────────────────────────────────────────────────

/**
 * Predict water levels for `horizonHours` into the future.
 * Returns { data: [{ time, level, predicted }], trend, ... }
 */
export const fetchForecast = (stationId, horizonHours = 24) =>
  get(`/api/models/forecast/${stationId}`, { horizon_hours: horizonHours });

// ─── Model 2 – DHSF ──────────────────────────────────────────────────────────

/**
 * Classify depletion driver for a station.
 * Returns { predicted_cause, depletion_factors, probabilities, ... }
 */
export const fetchDHSF = (stationId) =>
  get(`/api/models/dhsf/${stationId}`);

// ─── Model 3 – Anomaly Detection ─────────────────────────────────────────────

/** Detect anomalies in recent readings. */
export const fetchAnomalies = (stationId, days = 90) =>
  get(`/api/models/anomaly/${stationId}`, { days });

// ─── Model 4 – Recharge Prediction ───────────────────────────────────────────

/**
 * Predict monthly natural + artificial recharge.
 * Returns { recharge_data: [{ month, natural, artificial }], summary }
 */
export const fetchRecharge = (stationId) =>
  get(`/api/models/recharge/${stationId}`);

// ─── Model 5 – GSI Scoring ────────────────────────────────────────────────────

/** Groundwater Sustainability Index (0–100) + risk band. */
export const fetchGSI = (stationId) =>
  get(`/api/models/gsi/${stationId}`);

// ─── Model 6 – DH-ERP ────────────────────────────────────────────────────────

/** Energy / cost / time estimates to restore aquifer to baseline. */
export const fetchDHERP = (stationId) =>
  get(`/api/models/dherp/${stationId}`);

// ─── Model 7 – Aquifer Stress ─────────────────────────────────────────────────

/** Stress classification: Safe / Semi-Critical / Critical / Over-Exploited. */
export const fetchStress = (stationId) =>
  get(`/api/models/stress/${stationId}`);

// ─── Full report ──────────────────────────────────────────────────────────────

/** Run all 7 models for a station in one call. */
export const fetchFullReport = (stationId) =>
  get(`/api/station/${stationId}/full-report`);

// ─── Mock fallback data ───────────────────────────────────────────────────────
// Used when the backend isn't running so the UI still renders in dev mode.

export const MOCK_STATIONS = [
  { id: 'DWLR001', name: 'Delhi NCR',      lat: 28.61, lng: 77.21, waterLevel: 45.2, status: 'normal',   trend: 'stable',   lastReading: '2 min ago', region: 'North' },
  { id: 'DWLR002', name: 'Mumbai Suburban',lat: 19.08, lng: 72.88, waterLevel: 32.8, status: 'warning',  trend: 'declining',lastReading: '5 min ago', region: 'West'  },
  { id: 'DWLR003', name: 'Chennai Central', lat: 13.08, lng: 80.27, waterLevel: 28.5, status: 'critical', trend: 'declining',lastReading: '1 min ago', region: 'South' },
  { id: 'DWLR004', name: 'Bangalore Urban', lat: 12.97, lng: 77.59, waterLevel: 55.3, status: 'normal',   trend: 'rising',   lastReading: '3 min ago', region: 'South' },
  { id: 'DWLR005', name: 'Kolkata Metro',   lat: 22.57, lng: 88.36, waterLevel: 48.7, status: 'normal',   trend: 'stable',   lastReading: '1 min ago', region: 'East'  },
];

export const MOCK_SUMMARY = {
  total_stations: 5260, online_pct: 99.8,
  avg_water_level_m: 42.3, active_alerts: 3,
  critical_count: 2, warning_count: 1,
  sustainability_index: 72,
  annual_loss_crore_inr: 126, people_affected_million: 2.3,
};

export const MOCK_RECHARGE = [
  { month: 'Jan', natural: 120, artificial: 80  },
  { month: 'Feb', natural: 110, artificial: 85  },
  { month: 'Mar', natural: 95,  artificial: 90  },
  { month: 'Apr', natural: 85,  artificial: 95  },
  { month: 'May', natural: 75,  artificial: 100 },
  { month: 'Jun', natural: 150, artificial: 110 },
  { month: 'Jul', natural: 180, artificial: 120 },
  { month: 'Aug', natural: 200, artificial: 130 },
  { month: 'Sep', natural: 160, artificial: 115 },
  { month: 'Oct', natural: 130, artificial: 100 },
  { month: 'Nov', natural: 100, artificial: 90  },
  { month: 'Dec', natural: 110, artificial: 85  },
];

export const MOCK_FORECAST = Array.from({ length: 24 }, (_, i) => ({
  time:      `${String(i).padStart(2, '0')}:00`,
  level:     i < 12 ? +(45.5 - i * 0.1).toFixed(2) : null,
  predicted: i >= 10 ? +(44.5 - (i - 10) * 0.08).toFixed(2) : null,
}));
