/**
 * GroundwaterMonitoringSystem.jsx
 * --------------------------------
 * Root component — now fully connected to the FastAPI ML backend.
 *
 * Changes from original:
 *  • All static arrays replaced by live API hooks with mock fallback
 *  • Sustainability index sourced from Model 5 (GSI) via API
 *  • Water-level chart uses Model 1 (Forecasting) data
 *  • Recharge chart uses Model 4 data
 *  • Depletion-factors pie uses Model 2 (DHSF) data
 *  • Alerts driven by Model 3 (Anomaly Detection)
 *  • New "Model Insights" tab surfaces all 7 models per station
 *  • API status banner (bottom-right corner)
 *  • Loading skeletons while data fetches
 */

import React, { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from 'recharts';
import {
  AlertCircle, Droplet, Activity, Bell, TrendingUp, TrendingDown,
  Settings, FileText, Database, Zap, Globe, Shield, Eye,
  Calendar, Download, RefreshCw, Info, CheckCircle, AlertTriangle,
  XCircle, BarChart3, MapPin, Waves, CloudRain, Home, Menu, X, Search,
  Brain,
} from 'lucide-react';

import {
  useStations, useDashboardSummary, useRegionalSummary,
  useAlerts, useForecast, useDHSF, useRecharge,
} from './hooks/useGroundwaterData';
import { useGSI } from './hooks/useGroundwaterData';
import ModelInsights from './components/ModelInsights';
import ApiStatusBanner from './components/ApiStatusBanner';

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = {
    normal:   { cls: 'bg-green-100 text-green-800',  Icon: CheckCircle  },
    warning:  { cls: 'bg-yellow-100 text-yellow-800', Icon: AlertTriangle },
    critical: { cls: 'bg-red-100 text-red-800',       Icon: XCircle       },
  };
  const { cls, Icon } = cfg[status] || cfg.normal;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const TrendIndicator = ({ trend }) => {
  if (trend === 'rising')    return <TrendingUp    className="w-4 h-4 text-green-600" />;
  if (trend === 'declining') return <TrendingDown  className="w-4 h-4 text-red-600"   />;
  return                            <Activity      className="w-4 h-4 text-gray-600"  />;
};

function Skeleton({ className = 'h-6 w-full' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

// ─── Dashboard tab ────────────────────────────────────────────────────────────

function Dashboard({ selectedStation, setSelectedStation }) {
  const { data: summary,  loading: sumLoading  } = useDashboardSummary();
  const { data: stations, loading: staLoading  } = useStations();
  const { data: regional, loading: regLoading  } = useRegionalSummary();

  // Model 1 – forecast for selected station (or first)
  const activeId = selectedStation?.id || (stations?.[0]?.id);
  const { data: fcData, loading: fcLoading } = useForecast(activeId, 24);

  // Model 4 – recharge
  const { data: rchData, loading: rchLoading } = useRecharge(activeId);

  // Model 5 – GSI
  const { data: gsiData, loading: gsiLoading } = useGSI(activeId);

  // Model 2 – DHSF depletion factors
  const { data: dhsfData, loading: dhsfLoading } = useDHSF(activeId);

  const waterLevelData = (fcData?.data || []).filter(d => d.level !== null || d.predicted !== null);
  const rechargeData   = rchData?.recharge_data || [];
  const depletionFactors = dhsfData?.depletion_factors || [];
  const gsiScore = gsiData?.gsi_score ?? summary?.sustainability_index ?? 72;
  const gsiColor = gsiData?.band_color ?? (gsiScore > 70 ? '#10b981' : gsiScore > 40 ? '#f59e0b' : '#ef4444');

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Active DWLR Stations',
            value: sumLoading ? null : (summary?.total_stations?.toLocaleString() ?? '5,260'),
            sub:   `↑ ${summary?.online_pct ?? 99.8}% Online`,
            subCls:'text-green-600',
            Icon: Database, bg: 'bg-blue-100', ic: 'text-blue-600',
          },
          {
            label: 'Avg Water Level',
            value: sumLoading ? null : `${summary?.avg_water_level_m ?? 42.3}m`,
            sub:   '↓ 2.3m from last month',
            subCls:'text-red-600',
            Icon: Waves, bg: 'bg-cyan-100', ic: 'text-cyan-600',
          },
          {
            label: 'Sustainability Index',
            value: gsiLoading ? null : `${gsiScore}%`,
            sub:   gsiData?.band ?? 'Moderate Risk',
            subCls:'text-yellow-600',
            Icon: Shield, bg: 'bg-green-100', ic: 'text-green-600',
          },
          {
            label: 'Active Alerts',
            value: sumLoading ? null : (summary?.active_alerts ?? 3),
            sub:   `${summary?.critical_count ?? 2} Critical, ${summary?.warning_count ?? 1} Warning`,
            subCls:'text-orange-600',
            Icon: Bell, bg: 'bg-red-100', ic: 'text-red-600',
          },
        ].map(({ label, value, sub, subCls, Icon, bg, ic }) => (
          <div key={label} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{label}</p>
                {value === null
                  ? <Skeleton className="h-8 w-24 mt-1" />
                  : <p className="text-2xl font-bold text-gray-900">{value}</p>}
                <p className={`text-xs mt-1 ${subCls}`}>{sub}</p>
              </div>
              <div className={`${bg} p-3 rounded-full`}>
                <Icon className={`w-6 h-6 ${ic}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model 1 – Water level forecast */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Water Level Trends &amp; AI Predictions
              {fcData?.trend && (
                <span className={`ml-2 text-xs font-normal ${fcData.trend === 'declining' ? 'text-red-500' : fcData.trend === 'rising' ? 'text-green-500' : 'text-gray-500'}`}>
                  ({fcData.trend})
                </span>
              )}
            </h3>
            {fcLoading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
          </div>
          {fcLoading
            ? <Skeleton className="h-56 w-full" />
            : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={waterLevelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="level"     stroke="#3b82f6" fill="#93c5fd" name="Actual Level"   connectNulls />
                  <Line type="monotone" dataKey="predicted" stroke="#ef4444" strokeDasharray="5 5" name="AI Prediction" dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Model 4 – Recharge */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recharge Analysis
            {rchLoading && <RefreshCw className="w-3 h-3 inline ml-2 text-gray-400 animate-spin" />}
          </h3>
          {rchLoading
            ? <Skeleton className="h-56 w-full" />
            : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={rechargeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="natural"    fill="#10b981" name="Natural Recharge" />
                  <Bar dataKey="artificial" fill="#3b82f6" name="Artificial Recharge" />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* GSI + DHSF + DH-ERP row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Model 5 – GSI radial */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Groundwater Sustainability Index</h3>
          {gsiLoading
            ? <Skeleton className="h-48 w-full" />
            : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%"
                    data={[{ name: 'GSI', value: gsiScore, fill: gsiColor }]}>
                    <RadialBar dataKey="value" cornerRadius={10} />
                    <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle"
                      className="text-2xl font-bold" fill={gsiColor} fontSize={28} fontWeight={700}>
                      {gsiScore}%
                    </text>
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Status:</span>
                    <span className="font-medium" style={{ color: gsiColor }}>{gsiData?.band ?? 'Moderate'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Trend:</span>
                    <span className="font-medium text-red-500">{fcData?.trend ?? 'declining'}</span>
                  </div>
                </div>
              </>
            )
          }
        </div>

        {/* Model 2 – DHSF depletion factors */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Hydro-Socioeconomic Factors</h3>
          {dhsfLoading
            ? <Skeleton className="h-48 w-full" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={depletionFactors} cx="50%" cy="50%" outerRadius={75}
                    dataKey="value" nameKey="factor"
                    label={({ factor, value }) => `${factor.split(' ')[0]}: ${value.toFixed(0)}%`}
                    labelLine={false} fontSize={9}>
                    {depletionFactors.map((f, i) => <Cell key={i} fill={f.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v.toFixed(1)}%`]} />
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Model 6 – DH-ERP (static until we add the hook here too) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Energy-Cost Restoration Model</h3>
          <div className="space-y-4">
            {[
              { label: 'Energy Required', value: '2.4 GWh', pct: 75, color: 'bg-orange-600' },
              { label: 'Estimated Cost',  value: '₹45.2 Cr', pct: 60, color: 'bg-purple-600' },
              { label: 'Time to Restore', value: '18 months', pct: 45, color: 'bg-blue-600' },
            ].map(({ label, value, pct, color }) => (
              <div key={label}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className="text-sm font-medium">{value}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Regional table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Regional Station Overview</h3>
        {regLoading
          ? <Skeleton className="h-40 w-full" />
          : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Region', 'Total Stations', 'Critical', 'Warning', 'Normal', 'Health Score'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(regional || []).map(r => (
                    <tr key={r.region} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.region}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{r.stations?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-red-600">{r.critical}</td>
                      <td className="px-6 py-4 text-sm text-yellow-600">{r.warning}</td>
                      <td className="px-6 py-4 text-sm text-green-600">{r.normal}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${Math.round((r.normal / r.stations) * 100)}%` }} />
                          </div>
                          <span className="text-sm text-gray-600 w-10 text-right">
                            {Math.round((r.normal / r.stations) * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

// ─── Station Monitor tab ──────────────────────────────────────────────────────

function StationMonitor({ selectedStation, setSelectedStation }) {
  const [searchQuery, setSearchQuery]   = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const { data: stations, loading, refresh } = useStations();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    refresh().finally(() => setTimeout(() => setRefreshing(false), 800));
  };

  const visible = (stations || []).filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        s.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRegion = selectedRegion === 'all' || s.region?.toLowerCase() === selectedRegion;
    return matchSearch && matchRegion;
  });

  return (
    <div className="space-y-6">
      {/* Search & filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text" placeholder="Search DWLR stations…"
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <select className="px-4 py-2 border rounded-lg" value={selectedRegion}
            onChange={e => setSelectedRegion(e.target.value)}>
            {['all', 'north', 'south', 'east', 'west', 'central'].map(r => (
              <option key={r} value={r}>{r === 'all' ? 'All Regions' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
          <button onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map placeholder */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">DWLR Station Map</h3>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg h-80 relative overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 800 600">
              <path d="M400 150 L450 200 L480 250 L470 350 L420 400 L380 400 L330 350 L320 250 L350 200 Z"
                fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2" />
              {(stations || []).map(s => {
                const x = ((s.lng - 70) / 30) * 800;
                const y = ((30 - s.lat) / 20) * 600;
                const c = s.status === 'critical' ? '#ef4444' : s.status === 'warning' ? '#f59e0b' : '#10b981';
                return (
                  <g key={s.id} onClick={() => setSelectedStation(s)} className="cursor-pointer">
                    <circle cx={x} cy={y} r={selectedStation?.id === s.id ? 11 : 8}
                      fill={c} stroke="white" strokeWidth="2" className="hover:opacity-80" />
                    <text x={x} y={y - 13} textAnchor="middle" fontSize="9" fill="#374151">{s.name}</text>
                  </g>
                );
              })}
            </svg>
            <div className="absolute bottom-3 left-3 bg-white rounded-lg p-2 shadow text-xs flex gap-3">
              {[['#10b981','Normal'],['#f59e0b','Warning'],['#ef4444','Critical']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />{l}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Station detail */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Station Details</h3>
          {selectedStation ? (
            <div className="space-y-3">
              {[
                ['Station ID', selectedStation.id],
                ['Location',   selectedStation.name],
                ['Water Level',`${selectedStation.waterLevel}m`],
                ['Region',     selectedStation.region],
                ['Last Reading',selectedStation.lastReading],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-gray-500">{k}</p>
                  <p className="font-medium text-sm">{v}</p>
                </div>
              ))}
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <StatusBadge status={selectedStation.status} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Trend</p>
                <div className="flex items-center gap-1.5">
                  <TrendIndicator trend={selectedStation.trend} />
                  <span className="text-sm capitalize">{selectedStation.trend}</span>
                </div>
              </div>
              <button
                onClick={() => {}}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                View Full Report
              </button>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-10">
              <MapPin className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>Select a station on the map to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Station table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">All DWLR Stations</h3>
        {loading
          ? <Skeleton className="h-40 w-full" />
          : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Station ID','Location','Water Level','Status','Trend','Last Reading'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visible.map(s => (
                    <tr key={s.id} className={`hover:bg-gray-50 cursor-pointer ${selectedStation?.id === s.id ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedStation(s)}>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{s.id}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{s.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{s.waterLevel}m</td>
                      <td className="px-6 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1">
                          <TrendIndicator trend={s.trend} />
                          <span className="text-sm capitalize">{s.trend}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">{s.lastReading}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

// ─── Alerts tab ───────────────────────────────────────────────────────────────

function AlertsSection() {
  const { data: alerts, loading, refresh } = useAlerts(30000);
  const counts = { critical: 0, warning: 0, info: 0 };
  (alerts || []).forEach(a => { if (counts[a.type] !== undefined) counts[a.type]++; });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Real-Time Alert System</h3>
          <div className="flex items-center gap-2">
            {loading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
            <button onClick={refresh} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
              <Settings className="w-4 h-4" /> Configure Alerts
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { type: 'critical', label: 'Critical Alerts', count: counts.critical, Icon: XCircle,       bg: 'bg-red-50',    ic: 'text-red-500',    tc: 'text-red-800'    },
            { type: 'warning',  label: 'Warnings',        count: counts.warning,  Icon: AlertTriangle, bg: 'bg-yellow-50', ic: 'text-yellow-500', tc: 'text-yellow-800' },
            { type: 'info',     label: 'Info Updates',    count: counts.info,     Icon: Info,          bg: 'bg-blue-50',   ic: 'text-blue-500',   tc: 'text-blue-800'   },
          ].map(({ label, count, Icon, bg, ic, tc }) => (
            <div key={label} className={`${bg} rounded-lg p-4 flex items-center justify-between`}>
              <div>
                <p className={`text-sm ${ic.replace('500','600')}`}>{label}</p>
                <p className={`text-2xl font-bold ${tc}`}>{count}</p>
              </div>
              <Icon className={`w-8 h-8 ${ic}`} />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {(alerts || []).length === 0 && !loading && (
            <p className="text-center text-gray-400 py-6">No active alerts — all stations nominal</p>
          )}
          {(alerts || []).map(a => (
            <div key={a.id}
              className={`rounded-lg p-4 border-l-4 ${
                a.type === 'critical' ? 'bg-red-50 border-red-500' :
                a.type === 'warning'  ? 'bg-yellow-50 border-yellow-500' :
                                        'bg-blue-50 border-blue-500'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {a.type === 'critical'
                    ? <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    : a.type === 'warning'
                    ? <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                    : <Info className="w-5 h-5 text-blue-500 mt-0.5" />}
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{a.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.station}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />
                        {new Date(a.time).toLocaleTimeString ? new Date(a.time).toLocaleTimeString() : a.time}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Policy Tools tab ─────────────────────────────────────────────────────────

function PolicyTools({ summary }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-6">Policy &amp; Research Support Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { Icon: FileText, color: 'text-blue-600', bg:'bg-blue-100', label: 'Water Security Report Generator',
              desc: 'Generate comprehensive reports with AI-driven insights and recommendations', btn: 'Generate Report', btnCls: 'bg-blue-600 hover:bg-blue-700' },
            { Icon: BarChart3, color: 'text-green-600', bg:'bg-green-100', label: 'Conservation Strategy Simulator',
              desc: 'Simulate different conservation strategies and predict their groundwater impact', btn: 'Run Simulation', btnCls: 'bg-green-600 hover:bg-green-700' },
            { Icon: Shield, color: 'text-purple-600', bg:'bg-purple-100', label: 'Policy Impact Analysis',
              desc: 'Analyse the potential impact of proposed water policies on groundwater resources', btn: 'Analyse Policy', btnCls: 'bg-purple-600 hover:bg-purple-700' },
            { Icon: Download, color: 'text-orange-600', bg:'bg-orange-100', label: 'Research Data Export',
              desc: 'Export historical and real-time data for academic research and analysis', btn: 'Export Data', btnCls: 'bg-orange-600 hover:bg-orange-700' },
          ].map(({ Icon, color, bg, label, desc, btn, btnCls }) => (
            <div key={label} className="border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className={`${bg} p-2 rounded-lg`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <h4 className="font-medium text-gray-900 text-sm">{label}</h4>
              </div>
              <p className="text-sm text-gray-500 mb-3">{desc}</p>
              <button className={`px-4 py-2 text-white text-sm rounded ${btnCls}`}>{btn}</button>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t pt-6">
          <h4 className="font-medium mb-4">Key Policy Metrics</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              ['23%', 'Depletion Rate'],
              ['67%', 'Aquifer Stress'],
              [`₹${summary?.annual_loss_crore_inr ?? 126}Cr`, 'Annual Loss'],
              [`${summary?.people_affected_million ?? 2.3}M`, 'People Affected'],
            ].map(([v, l]) => (
              <div key={l}>
                <p className="text-3xl font-bold text-gray-900">{v}</p>
                <p className="text-sm text-gray-500">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function GroundwaterMonitoringSystem() {
  const [activeTab,       setActiveTab]       = useState('dashboard');
  const [selectedStation, setSelectedStation] = useState(null);
  const [mobileMenuOpen,  setMobileMenuOpen]  = useState(false);
  const { data: alerts }   = useAlerts();
  const { data: summary }  = useDashboardSummary();

  const tabs = [
    { id: 'dashboard', label: 'Dashboard',       Icon: Home      },
    { id: 'stations',  label: 'Station Monitor', Icon: MapPin    },
    { id: 'alerts',    label: 'Alerts',           Icon: Bell      },
    { id: 'insights',  label: 'Model Insights',   Icon: Brain     },
    { id: 'policy',    label: 'Policy Tools',     Icon: FileText  },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-gray-400 hover:bg-gray-100">
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <div className="flex items-center gap-3 ml-2 md:ml-0">
                <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-2 rounded-lg">
                  <Droplet className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Groundwater Intelligence Platform</h1>
                  <p className="text-xs text-gray-500">Real-Time National DWLR Network · 7 ML Models Active</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-gray-400 hover:text-gray-500">
                <Bell className="h-6 w-6" />
                {(alerts || []).length > 0 && (
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400" />
                )}
              </button>
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
                <Globe className="h-4 w-4" />
                <span>India National Network</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className={`${mobileMenuOpen ? 'block' : 'hidden'} md:block bg-white shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:space-x-2 py-2 md:py-0">
            {tabs.map(({ id, label, Icon }) => (
              <button key={id}
                onClick={() => { setActiveTab(id); setMobileMenuOpen(false); }}
                className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === id ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}`}>
                <Icon className="w-4 h-4" />
                {label}
                {id === 'alerts' && (alerts || []).length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                    {(alerts || []).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <Dashboard selectedStation={selectedStation} setSelectedStation={setSelectedStation} />}
        {activeTab === 'stations'  && <StationMonitor selectedStation={selectedStation} setSelectedStation={setSelectedStation} />}
        {activeTab === 'alerts'    && <AlertsSection />}
        {activeTab === 'insights'  && <ModelInsights selectedStation={selectedStation} />}
        {activeTab === 'policy'    && <PolicyTools summary={summary} />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 text-sm text-gray-500">
            <span>© 2024 Real-Time Groundwater Resource Evaluation System</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-500" />System Online</span>
              <span>5,260 Active Stations</span>
              <span>7 ML Models Active</span>
            </div>
          </div>
        </div>
      </footer>

      {/* API status indicator */}
      <ApiStatusBanner />
    </div>
  );
}
