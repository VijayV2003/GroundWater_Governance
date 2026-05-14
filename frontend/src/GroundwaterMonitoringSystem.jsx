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
                const c = s.status === 'critical' ? '#ef4444' : s.status === 'warning' ? '#f59e0b' : '#10b981';
                const isSelected = selectedStation?.id === s.id;
                return (
                  <CircleMarker 
                    key={s.id} 
                    center={[s.lat, s.lng]} 
                    radius={isSelected ? 8 : 5}
                    pathOptions={{ fillColor: c, fillOpacity: 0.9, color: '#fff', weight: 1.5 }}
                    eventHandlers={{ click: () => setSelectedStation(s) }}
                  >
                    <LeafletTooltip direction="top" offset={[0, -10]} opacity={1}>
                      <span className="font-semibold text-gray-800">{s.name}</span>
                    </LeafletTooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>
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
              {userRole !== 'general' && (
                <button
                  onClick={() => setActiveTab('insights')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                  View Full Report
                </button>
              )}
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
  const [simRainfall, setSimRainfall] = useState(0);
  const [simExtraction, setSimExtraction] = useState(0);
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
      case 'Conservation Strategy Simulator':
        return (
          <div className="space-y-6">
            <h4 className="text-lg font-bold text-gray-900">Conservation Simulator</h4>
            <div className="space-y-4">
              <div>
                <label className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                  <span>Rainfall Scenario</span>
                  <span className="text-blue-600">{simRainfall > 0 ? '+' : ''}{simRainfall}%</span>
                </label>
                <input type="range" min="-50" max="50" value={simRainfall} onChange={(e) => setSimRainfall(Number(e.target.value))} className="w-full accent-blue-600" />
              </div>
              <div>
                <label className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                  <span>Extraction Reduction</span>
                  <span className="text-green-600">{simExtraction}%</span>
                </label>
                <input type="range" min="0" max="100" value={simExtraction} onChange={(e) => setSimExtraction(Number(e.target.value))} className="w-full accent-green-600" />
              </div>
              <button onClick={async () => {
                try {
                  const res = await fetch(`http://localhost:8000/api/policy/simulate`, {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ rainfall_change_pct: simRainfall, extraction_reduction_pct: simExtraction })
                  });
                  const data = await res.json();
                  setSimProjectedGSI(data.projected_gsi);
                } catch (e) {
                  console.error(e);
                }
              }} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition-colors">
                Calculate Impact
              </button>
            </div>
            {simProjectedGSI !== null && (
              <div className="p-6 bg-gray-50 rounded-xl border text-center">
                <p className="text-sm font-medium text-gray-500 mb-1">Projected Sustainability Index (National)</p>
                <p className={`text-4xl font-bold ${simProjectedGSI > 70 ? 'text-green-600' : simProjectedGSI > 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {simProjectedGSI}%
                </p>
              </div>
            )}
          </div>
        );
      case 'Policy Impact Analysis':
        return (
          <div className="space-y-5">
            <h4 className="text-lg font-bold text-gray-900">Policy Analysis</h4>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Select Proposed Policy</label>
              <select className="w-full border-gray-300 border focus:border-purple-500 focus:ring-purple-500 rounded-lg p-2.5 text-sm" value={selectedPolicy} onChange={e => {
                const val = e.target.value;
                setSelectedPolicy(val);
                if (val) {
                  fetch(`http://localhost:8000/api/policy/impact`, {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ policy_name: val })
                  }).then(r => r.json()).then(setPolicyImpactData).catch(console.error);
                } else {
                  setPolicyImpactData(null);
                }
              }}>
                <option value="">-- Select a Policy --</option>
                {['Subsidized Micro-Irrigation', 'Energy Tariff Hike', 'Mandatory Rainwater Harvesting'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {policyImpactData && (
              <div className={`p-4 bg-purple-50 text-purple-800 rounded-lg border border-purple-200`}>
                <p className="font-medium">
                  {policyImpactData.depletion_reduction ? `Expected Depletion Rate Reduction: ${policyImpactData.depletion_reduction}%` : ''}
                  {policyImpactData.recharge_increase ? `Expected Recharge Increase: ${policyImpactData.recharge_increase}%` : ''}
                </p>
                <p className="text-sm mt-2 opacity-90 font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Projected GSI Improvement: +{policyImpactData.gsi_improvement}%
                </p>
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
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative animate-in zoom-in-95 duration-200">
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
