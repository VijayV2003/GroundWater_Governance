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

  // Auto-refresh on interval
  useEffect(() => {
    if (!pollInterval) return;
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, pollInterval]);

  return { data, loading, error, refresh };
}

// ─── Station-specific model hooks ─────────────────────────────────────────────

/** Model 1 – 24-hour water-level forecast for a station. */
export function useForecast(stationId, horizonHours = 24) {
  const fallback = { data: MOCK_FORECAST, trend: 'declining' };
  return useAsync(
    () => stationId ? fetchForecast(stationId, horizonHours) : Promise.resolve(fallback),
    [stationId, horizonHours],
    fallback,
  );
}

/** Model 2 – DHSF depletion-cause classification. */
export function useDHSF(stationId) {
  const fallback = {
    predicted_cause: 'agricultural',
    confidence: 0.72,
    depletion_factors: [
      { factor: 'Agricultural Use', value: 45, color: '#3b82f6' },
      { factor: 'Industrial Use',   value: 25, color: '#8b5cf6' },
      { factor: 'Climate Impact',   value: 20, color: '#f59e0b' },
      { factor: 'Urban Growth',     value: 10, color: '#10b981' },
    ],
  };
  return useAsync(
    () => stationId ? fetchDHSF(stationId) : Promise.resolve(fallback),
    [stationId],
    fallback,
  );
}

/** Model 3 – Anomaly detection for a station. */
export function useAnomalies(stationId) {
  return useAsync(
    () => stationId ? fetchAnomalies(stationId) : Promise.resolve({ status: 'normal', anomalies: [], anomaly_count: 0 }),
    [stationId],
    { status: 'normal', anomalies: [], anomaly_count: 0 },
  );
}

/** Model 4 – Monthly recharge prediction. */
export function useRecharge(stationId) {
  return useAsync(
    () => stationId ? fetchRecharge(stationId) : Promise.resolve({ recharge_data: MOCK_RECHARGE }),
    [stationId],
    { recharge_data: MOCK_RECHARGE },
  );
}

/** Model 5 – GSI sustainability score. */
export function useGSI(stationId) {
  const fallback = { gsi_score: 72, band: 'Moderate', band_color: '#f59e0b', sub_scores: {} };
  return useAsync(
    () => stationId ? fetchGSI(stationId) : Promise.resolve(fallback),
    [stationId],
    fallback,
  );
}

/** Model 6 – DH-ERP restoration energy/cost/time. */
export function useDHERP(stationId) {
  const fallback = {
    estimated_cost_crore_inr: 45.2,
    energy_required_gwh: 2.4,
    time_to_restore_months: 18,
    dherp_index: 30,
  };
  return useAsync(
    () => stationId ? fetchDHERP(stationId) : Promise.resolve(fallback),
    [stationId],
    fallback,
  );
}

/** Model 7 – Aquifer stress classification. */
export function useStress(stationId) {
  const fallback = { stress_class: 'Semi-Critical', stress_color: '#f59e0b', confidence: 0.7, recommended_actions: [] };
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
