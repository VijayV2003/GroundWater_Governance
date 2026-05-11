/**
 * useGroundwaterData.js
 * ----------------------
 * Custom React hooks that wrap the API calls with loading / error state.
 * Each hook gracefully falls back to mock data if the API is unreachable.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchStations, fetchDashboardSummary, fetchRegionalSummary,
  fetchAlerts, fetchForecast, fetchDHSF, fetchAnomalies,
  fetchRecharge, fetchGSI, fetchDHERP, fetchStress, fetchFullReport,
  MOCK_STATIONS, MOCK_SUMMARY, MOCK_RECHARGE, MOCK_FORECAST,
} from '../api/groundwaterApi';

// ─── Generic async hook factory ───────────────────────────────────────────────

function useAsync(asyncFn, deps = [], fallback = null) {
  const [data,    setData]    = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFn();
      setData(result);
    } catch (err) {
      console.warn('[API]', err.message, '— using mock data');
      setError(err.message);
      // Keep existing (mock) data when API fails
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]);

  return { data, loading, error, refresh: run };
}

// ─── Dashboard hooks ──────────────────────────────────────────────────────────

/** Returns all DWLR stations, falls back to MOCK_STATIONS. */
export function useStations() {
  return useAsync(fetchStations, [], MOCK_STATIONS);
}

/** Returns KPI summary object, falls back to MOCK_SUMMARY. */
export function useDashboardSummary() {
  return useAsync(fetchDashboardSummary, [], MOCK_SUMMARY);
}

/** Returns regional aggregation rows. */
export function useRegionalSummary() {
  const fallback = [
    { region: 'North',   stations: 892,  critical: 78,  warning: 156, normal: 658 },
    { region: 'South',   stations: 1240, critical: 134, warning: 287, normal: 819 },
    { region: 'East',    stations: 756,  critical: 45,  warning: 98,  normal: 613 },
    { region: 'West',    stations: 1456, critical: 203, warning: 345, normal: 908 },
    { region: 'Central', stations: 916,  critical: 67,  warning: 178, normal: 671 },
  ];
  return useAsync(fetchRegionalSummary, [], fallback);
}

/** Returns live alert list (anomaly events). */
export function useAlerts(pollInterval = 30000) {
  const { data, loading, error, refresh } = useAsync(fetchAlerts, [], []);

  // Fake data for showcase
  const MOCK_ALERTS = [
    { id: 'a1', type: 'critical', message: 'Sudden depletion detected: Drop of 1.2m in 24h exceeds safe threshold.', station: 'G_1_BK_021 (Deri)', time: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
    { id: 'a2', type: 'critical', message: 'Anomaly: DHSF model indicates severe agricultural over-extraction.', station: 'G_1_BK_018 (Akoli)', time: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
    { id: 'a3', type: 'warning', message: 'Trend alert: Sustained decline over 7 days.', station: 'G_1_BK_021 (Deri)', time: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
    { id: 'a4', type: 'warning', message: 'Forecast warning: Projected level may breach baseline in 48h.', station: 'DWLR004 (Bangalore Urban)', time: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
    { id: 'a5', type: 'info', message: 'Recharge event: Rainfall of 12mm registered, monitoring recovery.', station: 'DWLR001 (Delhi NCR)', time: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() },
  ];

  const showcaseData = data && data.length > 0 ? data : MOCK_ALERTS;

  // Auto-refresh on interval
  useEffect(() => {
    if (!pollInterval) return;
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, pollInterval]);

  return { data: showcaseData, loading, error, refresh };
}

// --- Station Specific Mock Profiles ---
const STATION_PROFILES = {
  'DWLR001': { // Delhi - Normal, stable
    forecastTrend: 'stable', levelOffset: 0,
    dhsf: { cause: 'urban', conf: 0.82, factors: [{factor: 'Urban Growth', value: 55, color: '#10b981'}, {factor: 'Climate Impact', value: 25, color: '#f59e0b'}, {factor: 'Industrial Use', value: 20, color: '#8b5cf6'}] },
    anomalies: { status: 'normal', count: 0, list: [] },
    rechargeMod: 1,
    gsi: { score: 82, band: 'Safe', color: '#10b981', subs: { level_deficit: 85, recharge_balance: 80, trend: 85, climate_support: 75 } },
    dherp: { cost: 12.5, energy: 0.8, time: 6, index: 85 },
    stress: { class: 'Safe', color: '#10b981', conf: 0.88, actions: ['Maintain current monitoring', 'Promote rooftop rainwater harvesting'] }
  },
  'DWLR002': { // Mumbai - Warning, declining
    forecastTrend: 'declining', levelOffset: -12.4,
    dhsf: { cause: 'industrial', conf: 0.75, factors: [{factor: 'Industrial Use', value: 60, color: '#8b5cf6'}, {factor: 'Urban Growth', value: 30, color: '#10b981'}, {factor: 'Climate Impact', value: 10, color: '#f59e0b'}] },
    anomalies: { status: 'warning', count: 2, list: [{type: 'Rapid_Drawdown', severity: 'warning', description: 'Unusual drop of 0.8m over weekend'}, {type: 'Quality_Shift', severity: 'warning', description: 'Salinity indicator rising'}] },
    rechargeMod: 1.2,
    gsi: { score: 58, band: 'Moderate', color: '#f59e0b', subs: { level_deficit: 50, recharge_balance: 65, trend: 45, climate_support: 70 } },
    dherp: { cost: 85.0, energy: 4.2, time: 24, index: 45 },
    stress: { class: 'Semi-Critical', color: '#f59e0b', conf: 0.79, actions: ['Mandate industrial recycling', 'Restrict new borewells'] }
  },
  'DWLR003': { // Chennai - Critical, declining
    forecastTrend: 'declining', levelOffset: -16.7,
    dhsf: { cause: 'climate', conf: 0.89, factors: [{factor: 'Climate Impact', value: 45, color: '#f59e0b'}, {factor: 'Agricultural Use', value: 35, color: '#3b82f6'}, {factor: 'Urban Growth', value: 20, color: '#10b981'}] },
    anomalies: { status: 'critical', count: 4, list: [{type: 'Depletion_Alert', severity: 'critical', description: 'Breached historic low'}, {type: 'Seawater_Intrusion', severity: 'critical', description: 'High risk of irreversible contamination'}] },
    rechargeMod: 0.4,
    gsi: { score: 24, band: 'Critical', color: '#ef4444', subs: { level_deficit: 15, recharge_balance: 20, trend: 10, climate_support: 50 } },
    dherp: { cost: 240.5, energy: 12.5, time: 60, index: 12 },
    stress: { class: 'Over-Exploited', color: '#7f1d1d', conf: 0.92, actions: ['Immediate extraction halt', 'Emergency artificial recharge', 'Desalination shift'] }
  },
  'DWLR004': { // Bangalore - Normal, rising
    forecastTrend: 'rising', levelOffset: 10.1,
    dhsf: { cause: 'agricultural', conf: 0.68, factors: [{factor: 'Agricultural Use', value: 50, color: '#3b82f6'}, {factor: 'Urban Growth', value: 30, color: '#10b981'}, {factor: 'Climate Impact', value: 20, color: '#f59e0b'}] },
    anomalies: { status: 'normal', count: 0, list: [] },
    rechargeMod: 1.5,
    gsi: { score: 76, band: 'Safe', color: '#10b981', subs: { level_deficit: 70, recharge_balance: 85, trend: 80, climate_support: 70 } },
    dherp: { cost: 22.0, energy: 1.2, time: 10, index: 75 },
    stress: { class: 'Safe', color: '#10b981', conf: 0.81, actions: ['Optimize artificial recharge structures'] }
  },
  'DWLR005': { // Kolkata - Normal, stable
    forecastTrend: 'stable', levelOffset: 3.5,
    dhsf: { cause: 'agricultural', conf: 0.77, factors: [{factor: 'Agricultural Use', value: 65, color: '#3b82f6'}, {factor: 'Industrial Use', value: 20, color: '#8b5cf6'}, {factor: 'Urban Growth', value: 15, color: '#10b981'}] },
    anomalies: { status: 'normal', count: 1, list: [{type: 'Sensor_Drift', severity: 'warning', description: 'Minor calibration offset detected'}] },
    rechargeMod: 1.1,
    gsi: { score: 68, band: 'Moderate', color: '#f59e0b', subs: { level_deficit: 65, recharge_balance: 75, trend: 60, climate_support: 70 } },
    dherp: { cost: 45.2, energy: 2.4, time: 18, index: 60 },
    stress: { class: 'Semi-Critical', color: '#f59e0b', conf: 0.74, actions: ['Promote efficient irrigation', 'Monitor alluvial extraction'] }
  }
};

// ─── Station-specific model hooks ─────────────────────────────────────────────

/** Model 1 – 24-hour water-level forecast for a station. */
export function useForecast(stationId, horizonHours = 24) {
  const prof = STATION_PROFILES[stationId] || STATION_PROFILES['DWLR001'];
  const fallback = { 
    data: MOCK_FORECAST.map(d => ({
      ...d, 
      level: d.level !== null ? +(d.level + prof.levelOffset).toFixed(2) : null,
      predicted: d.predicted !== null ? +(d.predicted + prof.levelOffset).toFixed(2) : null
    })), 
    trend: prof.forecastTrend 
  };
  return useAsync(
    () => stationId ? fetchForecast(stationId, horizonHours) : Promise.resolve(fallback),
    [stationId, horizonHours],
    fallback,
  );
}

/** Model 2 – DHSF depletion-cause classification. */
export function useDHSF(stationId) {
  const prof = STATION_PROFILES[stationId] || STATION_PROFILES['DWLR001'];
  const fallback = {
    predicted_cause: prof.dhsf.cause,
    confidence: prof.dhsf.conf,
    depletion_factors: prof.dhsf.factors,
  };
  return useAsync(
    () => stationId ? fetchDHSF(stationId) : Promise.resolve(fallback),
    [stationId],
    fallback,
  );
}

/** Model 3 – Anomaly detection for a station. */
export function useAnomalies(stationId) {
  const prof = STATION_PROFILES[stationId] || STATION_PROFILES['DWLR001'];
  const fallback = { status: prof.anomalies.status, anomalies: prof.anomalies.list, anomaly_count: prof.anomalies.count };
  return useAsync(
    () => stationId ? fetchAnomalies(stationId) : Promise.resolve(fallback),
    [stationId],
    fallback,
  );
}

/** Model 4 – Monthly recharge prediction. */
export function useRecharge(stationId) {
  const prof = STATION_PROFILES[stationId] || STATION_PROFILES['DWLR001'];
  const fallback = { 
    recharge_data: MOCK_RECHARGE.map(r => ({
      ...r,
      natural: +(r.natural * prof.rechargeMod).toFixed(0),
      artificial: +(r.artificial * prof.rechargeMod).toFixed(0),
    }))
  };
  return useAsync(
    () => stationId ? fetchRecharge(stationId) : Promise.resolve(fallback),
    [stationId],
    fallback,
  );
}

/** Model 5 – GSI sustainability score. */
export function useGSI(stationId) {
  const prof = STATION_PROFILES[stationId] || STATION_PROFILES['DWLR001'];
  const fallback = { gsi_score: prof.gsi.score, band: prof.gsi.band, band_color: prof.gsi.color, sub_scores: prof.gsi.subs };
  return useAsync(
    () => stationId ? fetchGSI(stationId) : Promise.resolve(fallback),
    [stationId],
    fallback,
  );
}

/** Model 6 – DH-ERP restoration energy/cost/time. */
export function useDHERP(stationId) {
  const prof = STATION_PROFILES[stationId] || STATION_PROFILES['DWLR001'];
  const fallback = {
    estimated_cost_crore_inr: prof.dherp.cost,
    energy_required_gwh: prof.dherp.energy,
    time_to_restore_months: prof.dherp.time,
    dherp_index: prof.dherp.index,
  };
  return useAsync(
    () => stationId ? fetchDHERP(stationId) : Promise.resolve(fallback),
    [stationId],
    fallback,
  );
}

/** Model 7 – Aquifer stress classification. */
export function useStress(stationId) {
  const prof = STATION_PROFILES[stationId] || STATION_PROFILES['DWLR001'];
  const fallback = { stress_class: prof.stress.class, stress_color: prof.stress.color, confidence: prof.stress.conf, recommended_actions: prof.stress.actions };
  return useAsync(
    () => stationId ? fetchStress(stationId) : Promise.resolve(fallback),
    [stationId],
    fallback,
  );
}

/** All 7 models combined – used by "View Full Report". */
export function useFullReport(stationId) {
  return useAsync(
    () => stationId ? fetchFullReport(stationId) : Promise.resolve(null),
    [stationId],
    null,
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Returns true if the API server appears reachable. */
export function useApiHealth() {
  const [online, setOnline] = useState(null);
  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000'}/health`)
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }, []);
  return online;
}
