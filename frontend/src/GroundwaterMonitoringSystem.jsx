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
  Brain, LogOut, ShieldAlert
} from 'lucide-react';
import { useAuth } from './context/AuthContext';

import {
  useStations, useDashboardSummary, useRegionalSummary,
  useAlerts, useForecast, useDHSF, useRecharge, generateReport
} from './hooks/useGroundwaterData';
import { useGSI } from './hooks/useGroundwaterData';
import ModelInsights from './components/ModelInsights';
import AdminDashboard from './components/AdminDashboard';
import ApiStatusBanner from './components/ApiStatusBanner';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip } from 'react-leaflet';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function TopClock() {
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="hidden md:flex flex-col items-end justify-center mr-4 border-r pr-4">
      <span className="text-sm font-semibold text-gray-700">{time.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
      <span className="text-xs text-gray-500 font-medium">{time.toLocaleTimeString()}</span>
    </div>
  );
}

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
  const { data: alerts,   loading: alertsLoading } = useAlerts();

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
            value: alertsLoading ? null : (alerts || []).length,
            sub:   `${(alerts || []).filter(a => a.type === 'critical').length} Critical, ${(alerts || []).filter(a => a.type === 'warning').length} Warning`,
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

function StationMonitor({ selectedStation, setSelectedStation, setActiveTab }) {
  const { userRole } = useAuth();
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
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg h-[500px] relative overflow-hidden">
            <MapContainer
              center={[22.5, 82]}
              zoom={4.2}
              zoomSnap={0.1}
              style={{ width: "100%", height: "100%", zIndex: 1 }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
              {(stations || []).map(s => {
                // Color by TREND — status shown via ring
                const trendColor = s.trend === 'rising'   ? '#10b981'   // emerald green
                                 : s.trend === 'declining' ? '#ef4444'   // red
                                 :                           '#f59e0b';  // amber for stable

                const statusRing = s.status === 'critical' ? '#7f1d1d'
                                 : s.status === 'warning'  ? '#92400e'
                                 :                           '#ffffff';

                const isSelected = selectedStation?.id === s.id;

                return (
                  <React.Fragment key={s.id}>
                    {/* Outer glow ring for selected station */}
                    {isSelected && (
                      <CircleMarker
                        center={[s.lat, s.lng]}
                        radius={18}
                        pathOptions={{
                          fillColor: trendColor,
                          fillOpacity: 0.2,
                          color: trendColor,
                          weight: 2,
                          opacity: 0.6,
                        }}
                        interactive={false}
                      />
                    )}
                    {/* Main marker */}
                    <CircleMarker
                      center={[s.lat, s.lng]}
                      radius={isSelected ? 11 : 7}
                      pathOptions={{
                        fillColor: trendColor,
                        fillOpacity: 0.95,
                        color: statusRing,
                        weight: isSelected ? 3 : 2,
                      }}
                      eventHandlers={{
                        click: () => setSelectedStation(s),
                      }}
                    >
                      <LeafletTooltip direction="top" offset={[0, -14]} opacity={1} permanent={false}>
                        <div style={{ minWidth: 140, fontFamily: 'sans-serif', fontSize: 12 }}>
                          <div style={{ fontWeight: 700, marginBottom: 2, color: '#1e293b' }}>{s.name}</div>
                          <div style={{ color: '#64748b', marginBottom: 4 }}>{s.id} · {s.region}</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ color: '#3b82f6' }}>💧 {s.waterLevel}m</span>
                            <span style={{ color: trendColor, fontWeight: 600 }}>
                              {s.trend === 'rising' ? '↑ Rising' : s.trend === 'declining' ? '↓ Declining' : '→ Stable'}
                            </span>
                          </div>
                        </div>
                      </LeafletTooltip>
                    </CircleMarker>
                  </React.Fragment>
                );
              })}
            </MapContainer>

            {/* Legend — trend-based */}
            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg p-2.5 shadow text-xs z-[999] space-y-1">
              <p className="font-semibold text-gray-600 text-xs mb-1.5">Trend</p>
              {[['#10b981','↑ Rising'],['#f59e0b','→ Stable'],['#ef4444','↓ Declining']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ background: c }} />
                  <span className="text-gray-700">{l}</span>
                </div>
              ))}
              <div className="border-t pt-1 mt-1">
                <p className="font-semibold text-gray-600 text-xs mb-1">Ring = Status</p>
                {[['#ef4444', 'Critical'],['#f59e0b','Warning'],['#ffffff','Normal']].map(([c,l]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full border-2" style={{ background: '#9ca3af', borderColor: c }} />
                    <span className="text-gray-700">{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Click hint when nothing selected */}
            {!selectedStation && (
              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow text-xs text-gray-600 z-[999]">
                🖱 Click a marker to select station
              </div>
            )}
          </div>

        </div>

        {/* Station detail */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Station Details</h3>
          {selectedStation ? (() => {
            const trendColor = selectedStation.trend === 'rising'   ? '#10b981'
                             : selectedStation.trend === 'declining' ? '#ef4444'
                             :                                         '#f59e0b';
            const trendLabel = selectedStation.trend === 'rising'   ? '↑ Rising'
                             : selectedStation.trend === 'declining' ? '↓ Declining'
                             :                                         '→ Stable';
            return (
              <div className="space-y-4">
                {/* Status + trend header */}
                <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ borderColor: trendColor + '44', background: trendColor + '11' }}>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: trendColor }} />
                  <div>
                    <p className="text-xs text-gray-500">Trend</p>
                    <p className="font-bold text-sm" style={{ color: trendColor }}>{trendLabel}</p>
                  </div>
                  <div className="ml-auto">
                    <StatusBadge status={selectedStation.status} />
                  </div>
                </div>

                {/* Water level bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Water Level</span>
                    <span className="font-bold text-gray-800">{selectedStation.waterLevel} m bgl</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (selectedStation.waterLevel / 80) * 100)}%`, background: trendColor }}
                    />
                  </div>
                </div>

                {/* Key info */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Station ID', selectedStation.id],
                    ['Region', selectedStation.region],
                    ['Location', selectedStation.name],
                    ['Last Reading', selectedStation.lastReading],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs text-gray-400">{k}</p>
                      <p className="font-semibold text-sm text-gray-800 mt-0.5 truncate">{v}</p>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="space-y-2 pt-1">
                  {userRole !== 'general' && (
                    <button
                      onClick={() => setActiveTab('insights')}
                      className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Brain className="w-4 h-4" /> View Model Insights
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedStation(null)}
                    className="w-full px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            );
          })() : (
            <div className="text-center text-gray-400 py-10">
              <MapPin className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Select a station on the map to view details</p>
              <p className="text-xs mt-1 text-gray-300">or click a row in the table below</p>
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
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configSettings, setConfigSettings] = useState({
    critical: true,
    warning: true,
    info: false,
    email: true,
    sms: false
  });
  const counts = { critical: 0, warning: 0, info: 0 };
  (alerts || []).forEach(a => { if (counts[a.type] !== undefined) counts[a.type]++; });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Real-Time Alert System</h3>
          <div className="flex items-center gap-2">
            {loading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
            <button onClick={refresh} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowConfigModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-lg text-sm font-medium">
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

      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Suggested Actions &amp; Mitigations</h3>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 border rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">For Critical Alerts</h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Immediate halt on industrial extraction in the affected zones.</li>
              <li>Deploy rapid groundwater recharge interventions (e.g., injection wells).</li>
              <li>Issue advisory to local agricultural boards to minimize water-intensive crops.</li>
            </ul>
          </div>
          <div className="p-4 bg-gray-50 border rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">For Warning Alerts</h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Increase monitoring frequency for the specific station.</li>
              <li>Initiate community awareness programs regarding water conservation.</li>
              <li>Evaluate seasonal extraction patterns and suggest limits.</li>
            </ul>
          </div>
        </div>
      </div>

      {showConfigModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowConfigModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" /> Alert Configuration
            </h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3 uppercase tracking-wider">Alert Types to Display</h4>
                <div className="space-y-3">
                  {['critical', 'warning', 'info'].map(type => (
                    <label key={type} className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-gray-700 capitalize group-hover:text-gray-900 transition-colors">{type} Alerts</span>
                      <input 
                        type="checkbox" 
                        checked={configSettings[type]}
                        onChange={(e) => setConfigSettings({...configSettings, [type]: e.target.checked})}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-900 mb-3 uppercase tracking-wider">Delivery Methods</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Email Notifications</span>
                    <input 
                      type="checkbox" 
                      checked={configSettings.email}
                      onChange={(e) => setConfigSettings({...configSettings, email: e.target.checked})}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">SMS Alerts (Critical Only)</span>
                    <input 
                      type="checkbox" 
                      checked={configSettings.sms}
                      onChange={(e) => setConfigSettings({...configSettings, sms: e.target.checked})}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-6">
                <button 
                  onClick={() => setShowConfigModal(false)} 
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Policy Tools tab ─────────────────────────────────────────────────────────

function PolicyTools({ summary, selectedStation }) {
  const [activeModal, setActiveModal] = useState(null);
  const [reportProgress, setReportProgress] = useState(0);
  const [simRainfall,    setSimRainfall]    = useState(0);
  const [simExtraction,  setSimExtraction]  = useState(0);
  const [simRWH,         setSimRWH]         = useState(0);
  const [simCrop,        setSimCrop]        = useState(0);
  const [simIndustrial,  setSimIndustrial]  = useState(0);
  const [selectedPolicy, setSelectedPolicy] = useState('');
  
  const [simProjectedGSI, setSimProjectedGSI] = useState(null);
  const [policyImpactData, setPolicyImpactData] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const handleAction = (label) => {
    if (label === 'Research Data Export') {
      const csvContent = "data:text/csv;charset=utf-8,Station,Region,Level,Status\nStation A,North,45m,Normal\nStation B,South,30m,Critical";
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `groundwater_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      setActiveModal(label);
      if (label === 'Conservation Strategy Simulator') {
        setSimProjectedGSI(summary?.sustainability_index ?? 72);
      }
    }
  };

  const renderModalContent = () => {
    switch (activeModal) {
      case 'Water Security Report Generator':
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-gray-900">Gemini-Powered Policy Brief</h4>
            {!selectedStation ? (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                Please select a station in the Station Monitor first to generate a specific report.
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  This will use Google Gemini to generate a 5-page Word policy brief for <strong>{selectedStation.name}</strong>, including a visual snapshot of all 7 ML model insights.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>The report will capture the current <strong>Model Insights</strong> panel as a visual appendix embedded in the Word document.</span>
                </div>
                {isGeneratingReport ? (
                  <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-sm font-medium text-gray-700">Generating comprehensive report...</p>
                    <p className="text-xs text-gray-500 mt-1">Capturing model insights & calling Gemini API…</p>
                  </div>
                ) : (
                  <button onClick={async () => {
                    setIsGeneratingReport(true);
                    try {
                      // 1. Capture the Model Insights panel as a PNG snapshot
                      let imageBase64 = null;
                      const captureEl = document.getElementById('model-insights-capture');
                      if (captureEl) {
                        const html2canvas = (await import('html2canvas')).default;
                        const canvas = await html2canvas(captureEl, {
                          scale: 1.5,
                          useCORS: true,
                          backgroundColor: '#ffffff',
                          logging: false,
                        });
                        imageBase64 = canvas.toDataURL('image/png').split(',')[1];
                      }
                      // 2. Call centralized API client
                      const blob = await generateReport(selectedStation.id, imageBase64);
                      
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Policy_Brief_${selectedStation.id}.docx`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                      setActiveModal(null);
                    } catch (err) {
                      alert(`Error generating report: ${err.message}`);
                    } finally {
                      setIsGeneratingReport(false);
                    }
                  }} className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg shadow hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5" /> Generate Word Document
                  </button>
                )}
              </>
            )}
          </div>
        );
      case 'Conservation Strategy Simulator': {
        // ── Real-time hydrology computation (no backend needed) ──────────────
        const baseGSI       = summary?.sustainability_index ?? 72;
        const baseLevel     = selectedStation?.waterLevel ?? 45;
        const baseTrend     = selectedStation?.status === 'critical' ? -1.8 : selectedStation?.status === 'warning' ? -0.9 : -0.3;

        // Core water-balance model: driven by 5 levers
        const rechargeGain  = (simRainfall / 100) * 280;              // mm/yr from rainfall delta
        const extractDelta  = -(simExtraction / 100) * 420;           // mm/yr extraction reduction
        const rwh           = (simRWH / 100) * 140;                   // artificial recharge from RWH
        const cropSaving    = (simCrop / 100) * 180;                  // demand drop from crop shift
        const industrialCut = (simIndustrial / 100) * 90;             // industrial reduction

        const netBalance    = rechargeGain + extractDelta + rwh + cropSaving + industrialCut;   // mm/yr
        const recoveryRate  = netBalance / 1000;                       // m/yr aquifer level change
        const newTrend      = baseTrend + recoveryRate;
        const depletionRate = Math.max(0, Math.min(100, 67 - (netBalance / 10)));
        const rechargeRate  = Math.max(0, Math.min(100, 38 + (netBalance / 12)));
        const extractIndex  = Math.max(0, 100 - simExtraction - simCrop * 0.5 - simIndustrial * 0.3);
        const projGSI       = Math.max(5, Math.min(99, baseGSI + (netBalance / 15)));
        const yearsToRecover = recoveryRate > 0 ? Math.ceil((baseLevel - 20) / recoveryRate) : null;

        const riskLevel = projGSI > 75 ? 'Safe' : projGSI > 55 ? 'Moderate' : projGSI > 35 ? 'Critical' : 'Over-Exploited';
        const riskColor = projGSI > 75 ? 'text-green-600' : projGSI > 55 ? 'text-yellow-600' : projGSI > 35 ? 'text-red-600' : 'text-red-900';
        const riskBg    = projGSI > 75 ? 'from-green-50 to-emerald-50 border-green-200' : projGSI > 55 ? 'from-yellow-50 to-amber-50 border-yellow-200' : 'from-red-50 to-rose-50 border-red-200';

        // 10-year projection data
        const projectionData = Array.from({ length: 11 }, (_, yr) => {
          const level = +(baseLevel + newTrend * yr).toFixed(2);
          const baseline = +(baseLevel + baseTrend * yr).toFixed(2);
          return { year: `Y${yr}`, level: Math.max(5, level), baseline: Math.max(5, baseline) };
        });

        const PRESETS = [
          { label: 'Baseline',     rain: 0,   ext: 0,  rwh: 0,  crop: 0,  ind: 0,  color: 'bg-gray-100 text-gray-700' },
          { label: 'Drought',      rain: -40, ext: 0,  rwh: 0,  crop: 0,  ind: 0,  color: 'bg-red-100 text-red-700' },
          { label: 'Conservation', rain: 10,  ext: 40, rwh: 60, crop: 30, ind: 20, color: 'bg-blue-100 text-blue-700' },
          { label: 'Aggressive',   rain: 20,  ext: 80, rwh: 90, crop: 70, ind: 50, color: 'bg-green-100 text-green-700' },
        ];

        const sliders = [
          { key: 'rain',      label: 'Rainfall Change',          min: -50, max: 50,  val: simRainfall,   set: setSimRainfall,   unit: '%', color: 'accent-blue-500',   desc: 'Monsoon deviation from historical average' },
          { key: 'ext',       label: 'Extraction Reduction',     min: 0,   max: 100, val: simExtraction, set: setSimExtraction, unit: '%', color: 'accent-green-500',  desc: 'Agricultural groundwater pump reduction' },
          { key: 'rwh',       label: 'Rainwater Harvesting',     min: 0,   max: 100, val: simRWH,        set: setSimRWH,        unit: '%', color: 'accent-cyan-500',   desc: 'Rooftop RWH adoption rate' },
          { key: 'crop',      label: 'Crop Diversification',     min: 0,   max: 100, val: simCrop,       set: setSimCrop,       unit: '%', color: 'accent-amber-500',  desc: 'Shift to low water-intensity crops' },
          { key: 'ind',       label: 'Industrial Efficiency',    min: 0,   max: 100, val: simIndustrial, set: setSimIndustrial, unit: '%', color: 'accent-purple-500', desc: 'Industrial process water recycling' },
        ];

        return (
          <div className="space-y-4 max-h-[85vh] overflow-y-auto pr-1">
            {/* Header */}
            <div className="flex items-center justify-between sticky top-0 bg-white pb-2 z-10">
              <div>
                <h4 className="text-lg font-bold text-gray-900">Conservation Simulator</h4>
                <p className="text-xs text-gray-500">Adjust levers — results update live</p>
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full border bg-gradient-to-r ${riskBg} ${riskColor}`}>
                {riskLevel}
              </span>
            </div>

            {/* Scenario presets */}
            <div className="flex gap-2 flex-wrap">
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => {
                  setSimRainfall(p.rain); setSimExtraction(p.ext);
                  setSimRWH(p.rwh); setSimCrop(p.crop); setSimIndustrial(p.ind);
                }} className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors hover:opacity-80 ${p.color}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Sliders */}
            <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
              {sliders.map(({ label, min, max, val, set, unit, color, desc }) => (
                <div key={label}>
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="text-xs font-semibold text-gray-700">{label}</span>
                    <span className="text-xs font-bold text-gray-900">
                      {val > 0 && min < 0 ? '+' : ''}{val}{unit}
                    </span>
                  </div>
                  <input
                    type="range" min={min} max={max} value={val}
                    onChange={e => set(Number(e.target.value))}
                    className={`w-full h-1.5 ${color} cursor-pointer`}
                  />
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>

            {/* Output metrics grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Projected GSI',    value: projGSI.toFixed(0),        unit: '/100',   color: projGSI > 70 ? 'text-green-600' : projGSI > 45 ? 'text-yellow-600' : 'text-red-600', icon: '🌊' },
                { label: 'Depletion Rate',   value: depletionRate.toFixed(0),   unit: '%',      color: depletionRate < 30 ? 'text-green-600' : depletionRate < 60 ? 'text-yellow-600' : 'text-red-600', icon: '📉' },
                { label: 'Recharge Rate',    value: rechargeRate.toFixed(0),    unit: '%',      color: rechargeRate > 60 ? 'text-green-600' : rechargeRate > 35 ? 'text-yellow-600' : 'text-red-600', icon: '💧' },
                { label: 'Extraction Idx',   value: extractIndex.toFixed(0),    unit: '%',      color: extractIndex < 40 ? 'text-green-600' : extractIndex < 70 ? 'text-yellow-600' : 'text-red-600', icon: '⛏️' },
                { label: 'Net Balance',      value: netBalance > 0 ? `+${netBalance.toFixed(0)}` : netBalance.toFixed(0), unit: 'mm/yr', color: netBalance > 0 ? 'text-green-600' : 'text-red-600', icon: '⚖️' },
                { label: 'Recovery',         value: yearsToRecover ? `${Math.min(yearsToRecover, 99)}` : '∞', unit: 'yrs',   color: yearsToRecover && yearsToRecover < 20 ? 'text-green-600' : yearsToRecover && yearsToRecover < 50 ? 'text-yellow-600' : 'text-red-600', icon: '🔄' },
              ].map(({ label, value, unit, color, icon }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-3 text-center shadow-sm">
                  <div className="text-lg mb-0.5">{icon}</div>
                  <p className={`text-xl font-bold leading-none ${color}`}>{value}<span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span></p>
                  <p className="text-xs text-gray-500 mt-1 leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {/* 10-year projection chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-700 mb-3">📈 10-Year Aquifer Level Projection</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={projectionData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} domain={['auto', 'auto']} />
                  <Tooltip
                    formatter={(v, name) => [`${v} m bgl`, name === 'level' ? 'With Intervention' : 'Baseline (no action)']}
                    contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="baseline" stroke="#ef4444" strokeDasharray="4 2" dot={false} name="Baseline" strokeWidth={1.5} />
                  <Line type="monotone" dataKey="level"    stroke="#10b981" dot={false}               name="Intervention" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 text-center mt-2">
                {newTrend > 0
                  ? `✅ Aquifer recovers at +${recoveryRate.toFixed(2)} m/yr under this scenario`
                  : newTrend < baseTrend
                    ? `⚠️ Intervention slows decline to ${newTrend.toFixed(2)} m/yr (was ${baseTrend} m/yr)`
                    : `🔴 Aquifer continues declining at ${newTrend.toFixed(2)} m/yr — increase intervention`
                }
              </p>
            </div>
          </div>
        );
      }

      case 'Policy Impact Analysis':
        const POLICY_DATA = {
          'Subsidized Micro-Irrigation': {
            color: 'blue',
            icon: '💧',
            depletion_reduction: 28,
            recharge_increase: 12,
            gsi_improvement: 18,
            cost_crore: 840,
            timeframe: '18–24 months',
            risk: 'Low',
            riskColor: 'green',
            brief_outline: [
              { section: '1. Executive Summary', points: ['Micro-irrigation subsidies reduce agricultural water demand by up to 28%.', 'Targeted at districts with >60% agricultural extraction share.', 'Expected GSI improvement of +18 points within 24 months.'] },
              { section: '2. Policy Rationale', points: ['India loses ~40% of irrigation water to inefficient flood methods.', 'Drip/sprinkler systems achieve 90%+ water use efficiency.', 'Subsidy lowers adoption barrier for smallholder farmers (<2ha).'] },
              { section: '3. Implementation Plan', points: ['Phase 1 (0–6 mo): Identify eligible farmers, vendor empanelment.', 'Phase 2 (6–14 mo): Subsidy disbursement + installation drives.', 'Phase 3 (14–24 mo): Monitoring and impact verification via DWLR.'] },
              { section: '4. Budget & Financing', points: ['Total outlay: ₹840 Crore across 5 target districts.', 'Central share: 60%, State share: 40% under PMKSY.', 'ROI expected: ₹3.2 return per ₹1 invested over 5 years.'] },
              { section: '5. Expected Outcomes', points: ['28% reduction in groundwater depletion rate.', '12% increase in effective monsoon recharge (less runoff).', 'Sustained aquifer recovery of 0.3–0.5 m over 3 years.'] },
            ],
          },
          'Energy Tariff Hike': {
            color: 'orange',
            icon: '⚡',
            depletion_reduction: 35,
            recharge_increase: 5,
            gsi_improvement: 22,
            cost_crore: 0,
            timeframe: '6–12 months',
            risk: 'High',
            riskColor: 'red',
            brief_outline: [
              { section: '1. Executive Summary', points: ['Electricity tariff hike for agricultural pumps directly reduces extraction volumes.', 'Price signal achieves 35% depletion reduction — the highest of all options.', 'High political risk requires parallel farmer support mechanisms.'] },
              { section: '2. Policy Rationale', points: ['Flat-rate or free electricity eliminates conservation incentive.', 'Economic literature shows 10% tariff hike → 8–12% reduction in extraction.', 'Revenue can be reinvested into recharge infrastructure.'] },
              { section: '3. Implementation Plan', points: ['Phase 1 (0–3 mo): Farmer consultation, safety-net scheme design.', 'Phase 2 (3–6 mo): Graduated tariff rollout with monthly metering.', 'Phase 3 (6–12 mo): Full implementation with hardship exemptions.'] },
              { section: '4. Budget & Financing', points: ['Revenue-generating policy — no net outlay.', 'Estimated ₹1,200 Cr additional revenue annually.', '50% ring-fenced for Jal Shakti recharge programs.'] },
              { section: '5. Expected Outcomes', points: ['35% reduction in groundwater extraction within 12 months.', '22-point GSI improvement — strongest policy lever available.', 'Requires mandatory social safety-net or political backlash risk is HIGH.'] },
            ],
          },
          'Mandatory Rainwater Harvesting': {
            color: 'teal',
            icon: '🌧️',
            depletion_reduction: 15,
            recharge_increase: 32,
            gsi_improvement: 25,
            cost_crore: 320,
            timeframe: '24–36 months',
            risk: 'Medium',
            riskColor: 'yellow',
            brief_outline: [
              { section: '1. Executive Summary', points: ['Mandatory RWH for all buildings >200 sqm boosts aquifer recharge by 32%.', 'Addresses the demand side (supply augmentation, not reduction).', 'Proven in Chennai and Bangalore — scalable nationally.'] },
              { section: '2. Policy Rationale', points: ['Urban runoff accounts for 60–70% of precipitation in built-up areas.', 'RWH converts rooftop runoff into artificial recharge.', 'Decentralised approach reduces dependence on river/reservoir supply.'] },
              { section: '3. Implementation Plan', points: ['Phase 1 (0–6 mo): Legislation and enforcement notification.', 'Phase 2 (6–18 mo): Subsidised installation for residential compliance.', 'Phase 3 (18–36 mo): Third-party audit and municipal integration.'] },
              { section: '4. Budget & Financing', points: ['State outlay: ₹320 Crore (subsidies + enforcement infrastructure).', '70% cost borne by property owners under "Polluter Pays" principle.', 'Tax incentives (2% rebate) to accelerate voluntary adoption.'] },
              { section: '5. Expected Outcomes', points: ['32% increase in annual recharge volumes.', 'GSI improvement of +25 points over 36 months.', 'Groundwater level recovery of 0.6–1.2 m in urban aquifers.'] },
            ],
          },
          'Crop Diversification Mandate': {
            color: 'green',
            icon: '🌾',
            depletion_reduction: 22,
            recharge_increase: 18,
            gsi_improvement: 20,
            cost_crore: 560,
            timeframe: '12–24 months',
            risk: 'Medium',
            riskColor: 'yellow',
            brief_outline: [
              { section: '1. Executive Summary', points: ['Shifting from water-intensive paddy/sugarcane to millets/pulses cuts demand 22%.', 'Dual benefit: water conservation + improved soil recharge capacity.', 'Requires significant MSP restructuring and farmer education.'] },
              { section: '2. Policy Rationale', points: ['Paddy consumes 1,200–2,000 mm of water per season.', 'Millets consume 350–500 mm — 60–75% less.', 'India grows 50% of global paddy in water-scarce regions.'] },
              { section: '3. Implementation Plan', points: ['Phase 1 (0–6 mo): MSP parity announcement for alternative crops.', 'Phase 2 (6–15 mo): Extension services + FPO formation.', 'Phase 3 (15–24 mo): Market linkage and procurement guarantee.'] },
              { section: '4. Budget & Financing', points: ['₹560 Crore for MSP support, training, and market infrastructure.', 'Potential savings of ₹2,100 Cr/yr in irrigation subsidies.', 'Net positive fiscal impact within 3 years.'] },
              { section: '5. Expected Outcomes', points: ['22% depletion reduction from agricultural sector.', '18% recharge increase from improved soil infiltration.', 'Long-term aquifer recovery and reduced irrigation dependency.'] },
            ],
          },
        };

        const pInfo = selectedPolicy ? POLICY_DATA[selectedPolicy] : null;
        const colorMap = {
          blue: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500', head: 'bg-blue-600', text: 'text-blue-700' },
          orange: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500', head: 'bg-orange-600', text: 'text-orange-700' },
          teal: { bg: 'bg-teal-50', border: 'border-teal-200', badge: 'bg-teal-100 text-teal-700', bar: 'bg-teal-500', head: 'bg-teal-600', text: 'text-teal-700' },
          green: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700', bar: 'bg-green-500', head: 'bg-green-600', text: 'text-green-700' },
        };
        const c = pInfo ? (colorMap[pInfo.color] || colorMap.blue) : null;
        const riskColors = { Low: 'bg-green-100 text-green-700', Medium: 'bg-yellow-100 text-yellow-700', High: 'bg-red-100 text-red-700' };

        return (
          <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
            <h4 className="text-lg font-bold text-gray-900 sticky top-0 bg-white pb-2">Policy Impact Analysis</h4>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Select Proposed Policy</label>
              <select
                className="w-full border border-gray-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-lg p-2.5 text-sm"
                value={selectedPolicy}
                onChange={e => { setSelectedPolicy(e.target.value); setPolicyImpactData(null); }}
              >
                <option value="">-- Select a Policy --</option>
                {Object.keys(POLICY_DATA).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {pInfo && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {/* Impact metrics */}
                <div className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{pInfo.icon}</span>
                    <span className={`font-semibold text-sm ${c.text}`}>{selectedPolicy}</span>
                    <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${riskColors[pInfo.risk]}`}>
                      {pInfo.risk} Risk
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {[
                      { label: 'Depletion ↓', value: `${pInfo.depletion_reduction}%`, bar: pInfo.depletion_reduction },
                      { label: 'Recharge ↑', value: `+${pInfo.recharge_increase}%`, bar: pInfo.recharge_increase },
                      { label: 'GSI +', value: `+${pInfo.gsi_improvement}`, bar: pInfo.gsi_improvement },
                    ].map(({ label, value, bar }) => (
                      <div key={label} className="bg-white rounded-lg p-3 text-center shadow-sm">
                        <p className={`text-xl font-bold ${c.text}`}>{value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                        <div className="w-full bg-gray-100 rounded-full h-1 mt-2">
                          <div className={`h-1 rounded-full ${c.bar} transition-all duration-700`} style={{ width: `${Math.min(100, bar)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 text-xs text-gray-600 pt-2 border-t border-gray-200 mt-1">
                    <span>⏱ Timeframe: <strong>{pInfo.timeframe}</strong></span>
                    {pInfo.cost_crore > 0
                      ? <span>💰 Budget: <strong>₹{pInfo.cost_crore} Cr</strong></span>
                      : <span>💰 Budget: <strong className="text-green-600">Revenue-neutral</strong></span>
                    }
                  </div>
                </div>

                {/* Policy Brief Outline */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className={`${c.head} text-white px-4 py-3 flex items-center gap-2`}>
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-semibold">Policy Brief Outline</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {pInfo.brief_outline.map(({ section, points }) => (
                      <div key={section} className="px-4 py-3">
                        <p className={`text-xs font-bold uppercase tracking-wide ${c.text} mb-1.5`}>{section}</p>
                        <ul className="space-y-1">
                          {points.map((pt, i) => (
                            <li key={i} className="text-xs text-gray-600 flex gap-2">
                              <span className="text-gray-300 shrink-0">›</span>
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!pInfo && (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Shield className="w-10 h-10 mb-3 text-gray-200" />
                <p className="text-sm">Select a policy above to see projected impact and brief outline</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6 relative">
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
            <div key={label} className="border rounded-xl p-5 flex flex-col justify-between h-full hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`${bg} p-2.5 rounded-lg`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <h4 className="font-semibold text-gray-900">{label}</h4>
                </div>
                <p className="text-sm text-gray-500 mb-5 leading-relaxed">{desc}</p>
              </div>
              <button 
                onClick={() => handleAction(label)}
                className={`px-5 py-2.5 text-white text-sm font-medium rounded-lg self-start transition-colors ${btnCls}`}>
                {btn}
              </button>
            </div>
          ))}
        </div>

        {activeModal && (
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className={`bg-white rounded-2xl shadow-2xl ${
            activeModal === 'Policy Impact Analysis' || activeModal === 'Conservation Strategy Simulator'
              ? 'max-w-2xl' : 'max-w-lg'
          } w-full p-6 relative animate-in zoom-in-95 duration-200`}>
              <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
              {renderModalContent()}
            </div>
          </div>
        )}

        <div className="mt-8 border-t pt-6">
          <h4 className="font-medium mb-4 text-gray-900">Key Policy Metrics</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              [`${summary?.depletion_rate ?? 23}%`, 'Depletion Rate'],
              [`${summary?.aquifer_stress ?? 67}%`, 'Aquifer Stress'],
              [`₹${summary?.annual_loss_crore_inr ?? 126}Cr`, 'Annual Loss'],
              [`${summary?.people_affected_million ?? 2.3}M`, 'People Affected'],
            ].map(([v, l]) => (
              <div key={l} className="p-4 bg-gray-50 rounded-xl border">
                <p className="text-3xl font-bold text-gray-900">{v}</p>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Off-screen container for PDF generation */}
        {selectedStation && (
          <div style={{ position: 'absolute', top: '-10000px', left: '-10000px' }}>
            <div id="pdf-report-content" style={{ width: '1200px', padding: '40px', background: 'white' }}>
              <div className="flex items-center gap-4 border-b pb-4 mb-8">
                <div className="bg-blue-600 p-3 rounded-xl">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">Water Security Report</h2>
                  <p className="text-gray-500">Station: {selectedStation.name} ({selectedStation.id})</p>
                </div>
              </div>
              <ModelInsights selectedStation={selectedStation} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function GroundwaterMonitoringSystem() {
  const { currentUser, userRole, userStatus, logout } = useAuth();
  const [activeTab,       setActiveTab]       = useState('dashboard');
  const [selectedStation, setSelectedStation] = useState(null);
  const [mobileMenuOpen,  setMobileMenuOpen]  = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { data: alerts }   = useAlerts();
  const { data: summary }  = useDashboardSummary();
  const [showTerms, setShowTerms] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);

  const allTabs = [
    { id: 'dashboard', label: 'Dashboard',       Icon: Home        },
    { id: 'stations',  label: 'Station Monitor', Icon: MapPin      },
    { id: 'alerts',    label: 'Alerts',           Icon: Bell        },
    { id: 'insights',  label: 'Model Insights',   Icon: Brain       },
    { id: 'policy',    label: 'Policy Tools',     Icon: FileText    },
    { id: 'admin',     label: 'Admin Approvals',  Icon: ShieldAlert },
  ];

  // Filter tabs based on role
  const tabs = allTabs.filter(tab => {
    if (userRole === 'general') {
      return ['dashboard', 'stations'].includes(tab.id);
    }
    if (userRole === 'admin') {
      return true; // Admin sees all tabs including admin panel
    }
    // Policymakers see all except admin tab
    return tab.id !== 'admin';
  });

  if (userRole === 'policymaker' && userStatus === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center border border-gray-200">
          <ShieldAlert className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Pending Approval</h2>
          <p className="text-gray-600 mb-6">
            Your request for Policy Maker access is currently being reviewed by an administrator. 
            You will gain access to the dashboard once approved.
          </p>
          <button 
            onClick={logout}
            className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
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
                  <p className="text-xs text-gray-500">Computational Groundwater Governance · 7 ML Models Active</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <TopClock />
              {userRole !== 'general' && (
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none">
                  <Bell className="h-6 w-6" />
                  {(alerts || []).length > 0 && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400" />
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-50 overflow-hidden">
                    <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
                      <span className="font-semibold text-gray-700">Notifications</span>
                      <span className="text-xs text-blue-600 cursor-pointer hover:underline" onClick={() => { setShowNotifications(false); setActiveTab('alerts'); }}>View All</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {(alerts || []).length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">No new notifications</div>
                      ) : (
                        (alerts || []).slice(0, 5).map(a => (
                          <div key={a.id} 
                            onClick={() => { setShowNotifications(false); setActiveTab('alerts'); }}
                            className="p-3 border-b hover:bg-gray-50 cursor-pointer flex gap-3 transition-colors">
                            <div className="mt-0.5 flex-shrink-0">
                              {a.type === 'critical' ? <XCircle className="w-4 h-4 text-red-500" /> :
                               a.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-yellow-500" /> :
                               <Info className="w-4 h-4 text-blue-500" />}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-800 line-clamp-2">{a.message}</p>
                              <p className="text-[10px] text-gray-500 mt-1 flex gap-1 items-center">
                                <span className="truncate max-w-[150px]">{a.station}</span> • 
                                <span>{new Date(a.time).toLocaleTimeString ? new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : a.time}</span>
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              )}
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
                <Globe className="h-4 w-4" />
                <span>India National Network</span>
              </div>
              <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
              <div className="hidden md:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 leading-tight">{currentUser?.email}</p>
                  <p className="text-xs text-gray-500 capitalize">{userRole}</p>
                </div>
                <button 
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className={`${mobileMenuOpen ? 'block' : 'hidden'} md:block bg-white shadow-sm`}>
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
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
      <main className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <Dashboard selectedStation={selectedStation} setSelectedStation={setSelectedStation} />}
        {activeTab === 'stations'  && <StationMonitor selectedStation={selectedStation} setSelectedStation={setSelectedStation} setActiveTab={setActiveTab} />}
        {activeTab === 'alerts'    && <AlertsSection />}
        {activeTab === 'insights'  && <ModelInsights selectedStation={selectedStation} />}
        {activeTab === 'policy'    && <PolicyTools summary={summary} selectedStation={selectedStation} />}
        {activeTab === 'admin'     && <AdminDashboard />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 text-sm text-gray-500">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <span className="font-medium text-gray-700">© 2026 Computational Groundwater Governance</span>
              <div className="flex items-center gap-4 text-gray-500">
                <button onClick={() => setShowTerms(true)} className="hover:text-blue-600 transition-colors">Terms of Service</button>
                <button onClick={() => setShowPolicies(true)} className="hover:text-blue-600 transition-colors">Privacy Policy</button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-500" />System Online</span>
              <span>5,260 Active Stations</span>
              <span>7 ML Models Active</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Terms & Policies Modals */}
      {(showTerms || showPolicies) && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[2000] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative max-h-[80vh] overflow-y-auto">
            <button onClick={() => { setShowTerms(false); setShowPolicies(false); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {showTerms ? 'Terms of Service' : 'Privacy Policy'}
            </h2>
            <div className="space-y-4 text-sm text-gray-600">
              {showTerms ? (
                <>
                  <p>Welcome to the 2026 Computational Groundwater Governance Platform.</p>
                  <p><strong>1. Usage Restrictions:</strong> The models, predictions, and analytics provided by this platform are intended for governmental and authorized research use only. Unauthorized distribution of strategic water data is prohibited.</p>
                  <p><strong>2. Data Accuracy:</strong> While the ML models (Forecast, DHSF, GSI, DH-ERP, etc.) utilize state-of-the-art algorithms, they provide probabilistic estimates. Ground-truth validation remains the responsibility of local administrators.</p>
                  <p><strong>3. System Integrity:</strong> Users must not attempt to bypass role-based access controls or inject falsified telemetry data into the DWLR ingestion endpoints.</p>
                </>
              ) : (
                <>
                  <p>Your privacy and the security of our national groundwater infrastructure data are paramount.</p>
                  <p><strong>1. Data Collection:</strong> We collect telemetry data from DWLR stations, user activity logs for audit purposes, and administrative actions.</p>
                  <p><strong>2. Data Protection:</strong> All data is encrypted in transit and at rest. Access is strictly governed by Role-Based Access Control (RBAC) managed by the platform administrators.</p>
                  <p><strong>3. Third-Party Sharing:</strong> Aggregated, anonymized insights may be shared with authorized academic partners. Raw station data is strictly confidential.</p>
                </>
              )}
            </div>
            <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => { setShowTerms(false); setShowPolicies(false); }} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API status indicator */}
      <ApiStatusBanner />
    </div>
  );
}
