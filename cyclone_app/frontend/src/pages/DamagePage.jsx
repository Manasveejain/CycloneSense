import React, { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { MapContainer, TileLayer, CircleMarker, Tooltip, LayersControl } from 'react-leaflet'
import { predictDamage, generateAlerts } from '../api/client'
import toast from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'
import './DamagePage.css'

const { BaseLayer } = LayersControl

const PRESET_DISTRICTS = [
  { district_id: 'Chennai',      distance_to_path_km: 20,  predicted_wind_kt: 95,  vulnerability_index: 72, lat: 13.08, lon: 80.27 },
  { district_id: 'Tiruvallur',   distance_to_path_km: 45,  predicted_wind_kt: 88,  vulnerability_index: 65, lat: 13.14, lon: 79.91 },
  { district_id: 'Kanchipuram',  distance_to_path_km: 80,  predicted_wind_kt: 75,  vulnerability_index: 58, lat: 12.83, lon: 79.70 },
  { district_id: 'Villupuram',   distance_to_path_km: 140, predicted_wind_kt: 60,  vulnerability_index: 50, lat: 11.94, lon: 79.49 },
  { district_id: 'Cuddalore',    distance_to_path_km: 55,  predicted_wind_kt: 85,  vulnerability_index: 70, lat: 11.75, lon: 79.76 },
  { district_id: 'Puducherry',   distance_to_path_km: 30,  predicted_wind_kt: 92,  vulnerability_index: 68, lat: 11.93, lon: 79.83 },
]

const ZONE_COLOR  = { Red: '#ef4444', Orange: '#f97316', Yellow: '#eab308' }
const ZONE_CLASS  = { Red: 'badge-red', Orange: 'badge-orange', Yellow: 'badge-yellow' }
const EMPTY_ROW   = { district_id: '', distance_to_path_km: '', predicted_wind_kt: '', vulnerability_index: '', lat: '', lon: '' }

const FIELDS = ['district_id', 'distance_to_path_km', 'predicted_wind_kt', 'vulnerability_index']
const FIELD_LABELS = { district_id: 'District', distance_to_path_km: 'Dist to Path (km)', predicted_wind_kt: 'Wind (kt)', vulnerability_index: 'Vuln. (0–100)' }

export default function DamagePage() {
  const [districts, setDistricts] = useState(PRESET_DISTRICTS)
  const [result, setResult]       = useState(null)
  const [alerts, setAlerts]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [alertLoading, setAL]     = useState(false)
  const [tab, setTab]             = useState('table')   // 'table' | 'map' | 'alerts'

  const updateRow = (i, field, val) =>
    setDistricts(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d))

  const run = async () => {
    try {
      const rows = districts.map(d => ({
        district_id:         String(d.district_id),
        distance_to_path_km: parseFloat(d.distance_to_path_km),
        predicted_wind_kt:   parseFloat(d.predicted_wind_kt),
        vulnerability_index: parseFloat(d.vulnerability_index),
      }))
      if (rows.some(r => isNaN(r.distance_to_path_km) || isNaN(r.predicted_wind_kt) || isNaN(r.vulnerability_index))) {
        toast.error('All numeric fields must be valid numbers.')
        return
      }
      setLoading(true)
      setResult(null)
      setAlerts(null)
      const data = await predictDamage(rows)
      setResult(data)
      toast.success('Damage estimation complete!')
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  const dispatchAlerts = async () => {
    if (!result) return
    try {
      setAL(true)
      const payload = result.results.map(r => ({
        district_id:   r.district_id,
        risk_zone:     r.risk_zone,
        wind_kt:       districts.find(d => d.district_id === r.district_id)?.predicted_wind_kt || 0,
        damage_musd:   r.estimated_damage_musd,
        district_name: r.district_id,
      }))
      const data = await generateAlerts(payload)
      setAlerts(data)
      setTab('alerts')
      toast.success('CAP alerts generated!')
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setAL(false)
    }
  }

  const chartData = result?.results?.map(r => ({
    name:   r.district_id,
    damage: r.estimated_damage_musd,
    fill:   ZONE_COLOR[r.risk_zone] || '#3b82f6',
  })) || []

  const radarData = result?.results?.map(r => {
    const d = districts.find(x => x.district_id === r.district_id)
    return {
      district: r.district_id,
      wind:     d?.predicted_wind_kt || 0,
      vuln:     d?.vulnerability_index || 0,
      damage:   r.estimated_damage_musd,
    }
  }) || []

  // Map markers from results
  const mapMarkers = result
    ? result.results.map(r => {
        const d = districts.find(x => x.district_id === r.district_id)
        return d ? { ...r, lat: parseFloat(d.lat || 0), lon: parseFloat(d.lon || 0) } : null
      }).filter(Boolean)
    : []

  return (
    <div>
      <div className="page-header">
        <h1>⚠️ Damage Estimation &amp; Risk Zones</h1>
        <p>XGBoost model — per-district economic damage and colour-coded risk zones.</p>
      </div>

      <div className="damage-layout">
        {/* Input section */}
        <div className="card input-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 className="section-title" style={{ margin: 0 }}>District Inputs</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ fontSize: '.75rem', padding: '5px 10px' }}
                onClick={() => setDistricts([...districts, { ...EMPTY_ROW }])}>+ Row</button>
              <button className="btn btn-ghost" style={{ fontSize: '.75rem', padding: '5px 10px' }}
                onClick={() => { setDistricts(PRESET_DISTRICTS); setResult(null); setAlerts(null) }}>Reset</button>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {FIELDS.map(f => <th key={f}>{FIELD_LABELS[f]}</th>)}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {districts.map((d, i) => (
                  <tr key={i}>
                    {FIELDS.map(f => (
                      <td key={f}>
                        <input
                          className="table-input"
                          type={f === 'district_id' ? 'text' : 'number'}
                          value={d[f]}
                          onChange={e => updateRow(i, f, e.target.value)}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '3px 8px', fontSize: '.72rem' }}
                        onClick={() => setDistricts(prev => prev.filter((_, idx) => idx !== i))}
                        disabled={districts.length <= 1}
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn btn-primary" onClick={run} disabled={loading} style={{ width: '100%', marginTop: 14 }}>
            {loading
              ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Running…</>
              : '▶ Run Damage Model'}
          </button>
        </div>

        {/* Results section */}
        {result && (
          <div className="results-section">
            {/* Summary chips */}
            <div className="grid-4" style={{ marginBottom: 16 }}>
              <div className="stat-chip">
                <span className="label">Total Damage</span>
                <span className="value" style={{ color: '#ef4444' }}>
                  ${result.summary.total_estimated_damage_musd.toFixed(1)}M
                </span>
              </div>
              <div className="stat-chip">
                <span className="label">🔴 Red Zones</span>
                <span className="value" style={{ color: '#ef4444' }}>{result.summary.zone_counts.Red}</span>
              </div>
              <div className="stat-chip">
                <span className="label">🟠 Orange Zones</span>
                <span className="value" style={{ color: '#f97316' }}>{result.summary.zone_counts.Orange}</span>
              </div>
              <div className="stat-chip">
                <span className="label">🟡 Yellow Zones</span>
                <span className="value" style={{ color: '#eab308' }}>{result.summary.zone_counts.Yellow}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="tab-bar">
              {[
                { id: 'table',  label: '📋 Results Table' },
                { id: 'chart',  label: '📊 Chart' },
                { id: 'map',    label: '🗺️ Risk Map' },
                { id: 'alerts', label: `🔔 CAP Alerts${alerts ? ` (${alerts.alerts.length})` : ''}` },
              ].map(t => (
                <button
                  key={t.id}
                  className={`tab-btn ${tab === t.id ? 'tab-btn--active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Table tab */}
            {tab === 'table' && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 className="section-title" style={{ margin: 0 }}>Results by District</h3>
                  <button className="btn btn-primary" style={{ fontSize: '.8rem', padding: '6px 14px' }}
                    onClick={dispatchAlerts} disabled={alertLoading}>
                    {alertLoading ? '…' : '🔔 Generate CAP Alerts'}
                  </button>
                </div>
                <table className="data-table">
                  <thead>
                    <tr><th>District</th><th>Risk Zone</th><th>Damage (M USD)</th><th>Urgency</th><th>Instruction</th></tr>
                  </thead>
                  <tbody>
                    {result.results.map(r => (
                      <tr key={r.district_id}>
                        <td>{r.district_id}</td>
                        <td><span className={`badge ${ZONE_CLASS[r.risk_zone]}`}>{r.risk_zone}</span></td>
                        <td><strong style={{ color: ZONE_COLOR[r.risk_zone] }}>${r.estimated_damage_musd.toFixed(2)}M</strong></td>
                        <td style={{ color: ZONE_COLOR[r.risk_zone] }}>{r.urgency}</td>
                        <td style={{ fontSize: '.78rem', color: 'var(--muted)', maxWidth: 240 }}>{r.instruction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Chart tab */}
            {tab === 'chart' && (
              <div className="card">
                <h3 className="section-title">Estimated Damage by District</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                    <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} unit="M" />
                    <RTooltip
                      contentStyle={{ background: '#1f2937', border: '1px solid #30363d', borderRadius: 8 }}
                      formatter={v => [`$${v}M`, 'Damage']}
                    />
                    <Bar dataKey="damage" radius={[5, 5, 0, 0]}>
                      {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Map tab */}
            {tab === 'map' && (
              <div className="card">
                <h3 className="section-title">🗺️ Risk Zone Map</h3>
                <div style={{ height: 380, borderRadius: 8, overflow: 'hidden' }}>
                  <MapContainer center={[13, 80]} zoom={7} style={{ height: '100%', width: '100%' }}>
                    <LayersControl position="topright">
                      <BaseLayer checked name="Dark">
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                      </BaseLayer>
                      <BaseLayer name="Satellite">
                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                      </BaseLayer>
                    </LayersControl>

                    {mapMarkers.filter(m => m.lat && m.lon).map(m => (
                      <CircleMarker
                        key={m.district_id}
                        center={[m.lat, m.lon]}
                        radius={14}
                        color={ZONE_COLOR[m.risk_zone]}
                        fillColor={ZONE_COLOR[m.risk_zone]}
                        fillOpacity={0.75}
                      >
                        <Tooltip permanent>
                          <div style={{ fontSize: '.78rem' }}>
                            <strong>{m.district_id}</strong>
                            <div>${m.estimated_damage_musd.toFixed(1)}M · {m.risk_zone}</div>
                          </div>
                        </Tooltip>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: '.76rem', color: 'var(--muted)' }}>
                  {['Red', 'Orange', 'Yellow'].map(z => (
                    <span key={z}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: ZONE_COLOR[z], marginRight: 5, verticalAlign: 'middle' }} />
                      {z}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Alerts tab */}
            {tab === 'alerts' && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 className="section-title" style={{ margin: 0 }}>🔔 CAP Alert Dispatch</h3>
                  {!alerts && (
                    <button className="btn btn-primary" style={{ fontSize: '.8rem' }}
                      onClick={dispatchAlerts} disabled={alertLoading}>
                      {alertLoading ? '…' : 'Generate Alerts'}
                    </button>
                  )}
                </div>
                {!alerts ? (
                  <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
                    Click "Generate Alerts" to create CAP-format emergency alerts for each district.
                  </p>
                ) : (
                  <div className="alerts-list">
                    {alerts.alerts.map(a => (
                      <div
                        key={a.identifier}
                        className="alert-item"
                        style={{ borderLeft: `4px solid ${ZONE_COLOR[a.info.severity] || '#3b82f6'}` }}
                      >
                        <div className="alert-header">
                          <span className={`badge ${ZONE_CLASS[a.info.severity] || 'badge-blue'}`}>
                            {a.info.severity}
                          </span>
                          <span className="alert-id" style={{ fontSize: '.72rem', color: 'var(--muted)' }}>
                            {a.identifier}
                          </span>
                          <span style={{ fontSize: '.78rem', color: ZONE_COLOR[a.info.severity] }}>
                            {a.info.urgency}
                          </span>
                        </div>
                        <p className="alert-desc">{a.info.description}</p>
                        <p className="alert-instr" style={{ color: 'var(--muted)' }}>
                          📋 {a.info.instruction}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
