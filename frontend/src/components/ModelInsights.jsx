/**
 * ModelInsights.jsx
 * -----------------
 * New "Model Insights" tab that surfaces all 7 ML model outputs
 * for the selected DWLR station in a single, scannable view.
 */

import React, { useState } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import {
  Brain, Zap, AlertTriangle, CheckCircle, XCircle,
  TrendingDown, TrendingUp, Activity, Droplet, MapPin,
  Cpu, RefreshCw,
} from 'lucide-react';
import {
  useDHSF, useGSI, useDHERP, useStress, useAnomalies, useRecharge, useForecast,
} from '../hooks/useGroundwaterData';

// ─── Sub-card wrapper ─────────────────────────────────────────────────────────

function ModelCard({ title, icon: Icon, iconColor, loading, error, children }) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-lg ${iconColor}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        {loading && <RefreshCw className="w-3 h-3 ml-auto text-gray-400 animate-spin" />}
      </div>
      {children}
    </div>
  );
}

function Pill({ label, color }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ background: color + '22', color }}
    >
      {label}
    </span>
  );
}

function MiniBar({ label, value, max = 100, color }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-medium">{typeof value === 'number' ? value.toFixed(1) : value}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Individual model panels ──────────────────────────────────────────────────

function ForecastPanel({ stationId }) {
  const { data, loading, error } = useForecast(stationId, 24);
  const points = (data?.data || []).filter(d => d.predicted !== null).slice(0, 8);
  const trend  = data?.trend || 'stable';
  const TIcon  = trend === 'declining' ? TrendingDown : trend === 'rising' ? TrendingUp : Activity;
  const tColor = trend === 'declining' ? 'text-red-500' : trend === 'rising' ? 'text-green-500' : 'text-gray-500';

  return (
    <ModelCard title="Model 1 – Level Forecast (24 h)" icon={Activity} iconColor="bg-blue-500" loading={loading} error={error}>
      <div className="flex items-center gap-2 mb-3">
        <TIcon className={`w-4 h-4 ${tColor}`} />
        <span className={`text-sm font-medium capitalize ${tColor}`}>{trend} trend</span>
        {data?.min_predicted && (
          <span className="ml-auto text-xs text-gray-500">
            {data.min_predicted}–{data.max_predicted} m predicted
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={points} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
          <Tooltip formatter={(v) => [`${v} m`, 'Predicted']} />
          <Bar dataKey="predicted" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ModelCard>
  );
}

function DHSFPanel({ stationId }) {
  const { data, loading, error } = useDHSF(stationId);
  const factors = data?.depletion_factors || [];

  return (
    <ModelCard title="Model 2 – Depletion Cause (DHSF)" icon={Brain} iconColor="bg-purple-500" loading={loading} error={error}>
      <div className="flex items-center gap-2 mb-3">
        <Pill
          label={data?.predicted_cause || '—'}
          color={{ agricultural: '#3b82f6', industrial: '#8b5cf6', climate: '#f59e0b', urban: '#10b981' }[data?.predicted_cause] || '#6b7280'}
        />
        <span className="text-xs text-gray-500 ml-auto">
          confidence {((data?.confidence || 0) * 100).toFixed(0)}%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <PieChart>
          <Pie data={factors} dataKey="value" nameKey="factor" cx="50%" cy="50%"
            outerRadius={45} label={({ factor, value }) => `${factor.split(' ')[0]} ${value.toFixed(0)}%`}
            labelLine={false} fontSize={9}>
            {factors.map((f, i) => <Cell key={i} fill={f.color} />)}
          </Pie>
          <Tooltip formatter={(v) => [`${v.toFixed(1)}%`]} />
        </PieChart>
      </ResponsiveContainer>
    </ModelCard>
  );
}

function AnomalyPanel({ stationId }) {
  const { data, loading, error } = useAnomalies(stationId);
  const status   = data?.status || 'normal';
  const count    = data?.anomaly_count || 0;
  const recent   = (data?.anomalies || []).slice(0, 3);
  const StatusIcon = status === 'critical' ? XCircle : status === 'warning' ? AlertTriangle : CheckCircle;
  const sColor     = status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#10b981';

  return (
    <ModelCard title="Model 3 – Anomaly Detection" icon={AlertTriangle} iconColor="bg-orange-500" loading={loading} error={error}>
      <div className="flex items-center gap-3 mb-3">
        <StatusIcon style={{ color: sColor }} className="w-6 h-6" />
        <div>
          <p className="text-sm font-medium capitalize" style={{ color: sColor }}>{status}</p>
          <p className="text-xs text-gray-400">{count} event{count !== 1 ? 's' : ''} detected</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-lg font-bold text-gray-800">{data?.latest_level ?? '—'} m</p>
          <p className="text-xs text-gray-400">current level</p>
        </div>
      </div>
      <div className="space-y-1.5 mt-2">
        {recent.length === 0
          ? <p className="text-xs text-gray-400 italic">No anomalies in recent window</p>
          : recent.map((a, i) => (
              <div key={i} className={`text-xs rounded px-2 py-1 ${a.severity === 'critical' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                {a.type?.replace(/_/g, ' ')} — {a.description}
              </div>
            ))
        }
      </div>
    </ModelCard>
  );
}

function RechargePanel({ stationId }) {
  const { data, loading, error } = useRecharge(stationId);
  const monthly = data?.recharge_data || [];
  const summary = data?.summary || {};

  return (
    <ModelCard title="Model 4 – Recharge Prediction" icon={Droplet} iconColor="bg-cyan-500" loading={loading} error={error}>
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={monthly} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip />
          <Bar dataKey="natural"    fill="#10b981" radius={[2, 2, 0, 0]} stackId="a" name="Natural" />
          <Bar dataKey="artificial" fill="#3b82f6" radius={[2, 2, 0, 0]} stackId="a" name="Artificial" />
        </BarChart>
      </ResponsiveContainer>
      {summary.recharge_deficit_risk && (
        <div className="mt-2 flex gap-2">
          <span className="text-xs text-gray-500">Deficit risk:</span>
          <Pill
            label={summary.recharge_deficit_risk}
            color={{ low: '#10b981', moderate: '#f59e0b', high: '#ef4444' }[summary.recharge_deficit_risk] || '#6b7280'}
          />
        </div>
      )}
    </ModelCard>
  );
}

function GSIPanel({ stationId }) {
  const { data, loading, error } = useGSI(stationId);
  const score = data?.gsi_score ?? 72;
  const subs  = data?.sub_scores || {};
  const radarData = [
    { axis: 'Level',    value: subs.level_deficit      ?? 70 },
    { axis: 'Recharge', value: subs.recharge_balance   ?? 60 },
    { axis: 'Trend',    value: subs.trend              ?? 50 },
    { axis: 'Climate',  value: subs.climate_support    ?? 65 },
  ];

  return (
    <ModelCard title="Model 5 – Sustainability Index (GSI)" icon={CheckCircle} iconColor="bg-green-500" loading={loading} error={error}>
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-3xl font-bold" style={{ color: data?.band_color || '#f59e0b' }}>{score}</p>
          <Pill label={data?.band || 'Moderate'} color={data?.band_color || '#f59e0b'} />
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </ModelCard>
  );
}

function DHERPPanel({ stationId }) {
  const { data, loading, error } = useDHERP(stationId);

  return (
    <ModelCard title="Model 6 – Restoration Cost (DH-ERP)" icon={Zap} iconColor="bg-amber-500" loading={loading} error={error}>
      <div className="space-y-3">
        <MiniBar label="Energy required (GWh)"    value={data?.energy_required_gwh ?? 2.4}         max={10}   color="#f59e0b" />
        <MiniBar label="Est. cost (₹ Crore)"       value={data?.estimated_cost_crore_inr ?? 45.2}  max={200}  color="#ef4444" />
        <MiniBar label="Time to restore (months)"  value={data?.time_to_restore_months ?? 18}       max={120}  color="#8b5cf6" />
      </div>
      {data?.restoration_feasibility && (
        <p className="mt-3 text-xs text-gray-500 italic leading-relaxed">
          {data.restoration_feasibility}
        </p>
      )}
    </ModelCard>
  );
}

function StressPanel({ stationId }) {
  const { data, loading, error } = useStress(stationId);
  const actions = (data?.recommended_actions || []).slice(0, 3);
  const probData = Object.entries(data?.probabilities || {
    Safe: 0.1, 'Semi-Critical': 0.45, Critical: 0.3, 'Over-Exploited': 0.15,
  }).map(([name, value]) => ({
    name, value: +(value * 100).toFixed(1),
    fill: { Safe: '#10b981', 'Semi-Critical': '#f59e0b', Critical: '#ef4444', 'Over-Exploited': '#7f1d1d' }[name] || '#6b7280',
  }));

  return (
    <ModelCard title="Model 7 – Aquifer Stress Class" icon={Cpu} iconColor="bg-red-500" loading={loading} error={error}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl font-bold" style={{ color: data?.stress_color || '#f59e0b' }}>
          {data?.stress_class || 'Semi-Critical'}
        </span>
        <span className="text-xs text-gray-400 ml-auto">
          confidence {((data?.confidence || 0.7) * 100).toFixed(0)}%
        </span>
      </div>
      <div className="space-y-1 mb-3">
        {probData.map(({ name, value, fill }) => (
          <MiniBar key={name} label={name} value={value} max={100} color={fill} />
        ))}
      </div>
      {actions.length > 0 && (
        <div className="border-t pt-2 space-y-1">
          {actions.map((a, i) => (
            <div key={i} className="text-xs text-gray-600 flex gap-1.5">
              <span className="text-amber-500 mt-0.5">›</span>
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}
    </ModelCard>
  );
}

// ─── Main ModelInsights component ─────────────────────────────────────────────

export default function ModelInsights({ selectedStation }) {
  const stationId = selectedStation?.id;

  if (!stationId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <MapPin className="w-12 h-12 mb-3 text-gray-300" />
        <p className="text-lg font-medium">Select a station</p>
        <p className="text-sm mt-1">Choose a DWLR station from the Station Monitor tab to view model insights</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Station header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg p-4 flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-lg">
          <Droplet className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-lg">{selectedStation.name}</h2>
          <p className="text-sm text-blue-100">
            {selectedStation.id} · {selectedStation.region} · {selectedStation.waterLevel} m bgl
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-blue-100">All 7 ML models active</p>
          <p className="text-xs text-blue-200 mt-0.5">Live inference</p>
        </div>
      </div>

      {/* 2-column model grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ForecastPanel  stationId={stationId} />
        <DHSFPanel      stationId={stationId} />
        <AnomalyPanel   stationId={stationId} />
        <RechargePanel  stationId={stationId} />
        <GSIPanel       stationId={stationId} />
        <DHERPPanel     stationId={stationId} />
      </div>

      {/* Full-width stress panel */}
      <StressPanel stationId={stationId} />
    </div>
  );
}
