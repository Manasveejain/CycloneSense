import React, { useState } from 'react'
import {
  MapContainer, TileLayer, Polyline, CircleMarker,
  Tooltip, LayersControl,
} from 'react-leaflet'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { predictTrack } from '../api/client'
import toast from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'
import './TrackPage.css'

const { BaseLayer, Overlay } = LayersControl

const EMPTY_OBS = { lat: '', lon: '', wind_kt: '', pressure_hpa: '' }

const PRESETS = {
  'Bay of Bengal (Sample)': [
    { lat: '13.5', lon: '80.2', wind_kt: '65', pressure_hpa: '985' },
    { lat: '14.1', lon: '81.0', wind_kt: '70', pressure_hpa: '980' },
    { lat: '14.8', lon: '81.9', wind_kt: '75', pressure_hpa: '975' },
  ],
  'Arabian Sea (Sample)': [
    { lat: '12.0', lon: '65.0', wind_kt: '55', pressure_hpa: '990' },
    { lat: '13.5', lon: '63.5', wind_kt: '70', pressure_hpa: '980' },
    { lat: '15.0', lon: '62.0', wind_kt: '85', pressure_hpa: '968' },
  ],
  'VSCS Level (Sample)': [
    { lat: '10.0', lon: '84.0', wind_kt: '80', pressure_hpa: '970' },
    { lat: '11.5', lon: '83.0', wind_kt: '90', pressure_hpa: '958' },
    { lat: '13.0', lon: '82.0', wind_kt: '95', pressure_hpa: '950' },
    { lat: '14.5', lon: '81.5', wind_kt: '100', pressure_hpa: '944' },
  ],
}

export default function TrackPage() {
  const [observations, setObs] = useState(PRESETS['Bay of Bengal (Sample)'])
  const [steps, setSteps]      = useState(3)
  const [result, setResult]    = useState(null)
  const [loading, setLoading]  = useState(false)
  const [showSat, setShowSat]  = useState(true)

  const updateObs = (i, field, val) =>
    setObs(prev => prev.map((o, idx) => idx === i ? { ...o, [field]: val } : o))

  const run = async () => {
    try {
      const parsed = observations.map(o => ({
        lat:          parseFloat(o.lat),
        lon:          parseFloat(o.lon),
        wind_kt:      parseFloat(o.wind_kt),
        pressure_hpa: parseFloat(o.pressure_hpa),
      }))
      if (parsed.some(o => Object.values(o).some(isNaN))) {
        toast.error('All fields must be valid numbers.')
        return
      }
      setLoading(true)
      const data = await predictTrack(parsed, steps)
      setResult(data)
      toast.success(`Track predicted – ${steps} step(s)`)
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  const knownPath = observations
    .map(o => [parseFloat(o.lat), parseFloat(o.lon)])
    .filter(p => !p.some(isNaN))

  const predPath  = result?.storm_path?.map(p => [p.predicted_lat, p.predicted_lon]) || []

  const chartData = result?.storm_path?.map(p => ({
    name: `+${p.step}×3h`,
    lat:  p.predicted_lat,
    lon:  p.predicted_lon,
  })) || []

  // map centre = last known position
  const mapCenter = knownPath.length > 0 ? knownPath[knownPath.length - 1] : [15, 80]

  return (
    <div>
      <div className="page-header">
        <h1>📡 Track Prediction</h1>
        <p>LSTM model — predict the next N 3-hourly positions from past observations.</p>
      </div>

      <div className="track-layout">
        {/* ── Input panel ── */}
        <div className="card input-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Past Observations</h3>
            <select
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', padding: '5px 10px', fontSize: '.78rem' }}
              onChange={e => { if (e.target.value) { setObs(PRESETS[e.target.value]); setResult(null) } }}
              defaultValue=""
            >
              <option value="">Load preset…</option>
              {Object.keys(PRESETS).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div className="obs-list">
            {observations.map((o, i) => (
              <div key={i} className="obs-row">
                <span className="obs-num">#{i + 1}</span>
                {['lat', 'lon', 'wind_kt', 'pressure_hpa'].map(f => (
                  <div key={f} className="obs-field">
                    <label>
                      {f === 'pressure_hpa' ? 'Pres (hPa)'
                        : f === 'wind_kt' ? 'Wind (kt)'
                        : f.toUpperCase()}
                    </label>
                    <input
                      type="number"
                      value={o[f]}
                      onChange={e => updateObs(i, f, e.target.value)}
                    />
                  </div>
                ))}
                <button
                  className="btn btn-danger obs-del"
                  onClick={() => setObs(prev => prev.filter((_, idx) => idx !== i))}
                  disabled={observations.length <= 1}
                >✕</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost"
              onClick={() => setObs(prev => [...prev, { ...EMPTY_OBS }])}
              disabled={observations.length >= 8}
            >
              + Add Row
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Steps</label>
              <select
                value={steps}
                onChange={e => setSteps(Number(e.target.value))}
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', padding: '5px 10px', fontSize: '.85rem' }}
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} step{n > 1 ? 's' : ''} ({n * 3}h)</option>)}
              </select>
            </div>
          </div>

          <hr className="divider" />
          <button className="btn btn-primary" onClick={run} disabled={loading} style={{ width: '100%' }}>
            {loading
              ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Predicting…</>
              : '▶ Predict Track'}
          </button>

          {/* Result table */}
          {result && (
            <div style={{ marginTop: 20 }}>
              <h3 className="section-title">Predicted Positions</h3>
              <table className="data-table">
                <thead>
                  <tr><th>Step</th><th>Latitude</th><th>Longitude</th></tr>
                </thead>
                <tbody>
                  {result.storm_path.map(p => (
                    <tr key={p.step}>
                      <td><span className="badge badge-blue">+{p.step}×3h</span></td>
                      <td>{p.predicted_lat.toFixed(4)}°N</td>
                      <td>{p.predicted_lon.toFixed(4)}°E</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Right: map + chart ── */}
        <div className="results-col">
          {/* Map */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 className="section-title" style={{ margin: 0 }}>🗺️ Track Map</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.8rem', color: 'var(--muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={showSat} onChange={e => setShowSat(e.target.checked)} />
                Satellite overlay
              </label>
            </div>
            <div style={{ height: 360, borderRadius: 8, overflow: 'hidden' }}>
              <MapContainer center={mapCenter} zoom={5} style={{ height: '100%', width: '100%' }}>
                <LayersControl position="topright">
                  <BaseLayer checked name="Dark (CartoDB)">
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      attribution="© CartoDB"
                    />
                  </BaseLayer>
                  <BaseLayer name="Satellite (ESRI)">
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution="© Esri"
                    />
                  </BaseLayer>
                  {showSat && (
                    <Overlay checked name="NASA GIBS – MODIS Terra">
                      <TileLayer
                        url="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-01-01/GoogleMapsCompatible/{z}/{y}/{x}.jpg"
                        attribution="NASA GIBS"
                        opacity={0.5}
                      />
                    </Overlay>
                  )}
                </LayersControl>

                {/* Known path */}
                {knownPath.length > 1 && (
                  <Polyline positions={knownPath} color="#8b949e" weight={2} dashArray="5 4" />
                )}
                {/* Predicted path */}
                {predPath.length > 0 && knownPath.length > 0 && (
                  <Polyline
                    positions={[knownPath[knownPath.length - 1], ...predPath]}
                    color="#3b82f6"
                    weight={2.5}
                  />
                )}
                {/* Known markers */}
                {knownPath.map((p, i) => (
                  <CircleMarker key={`k-${i}`} center={p} radius={5} color="#8b949e" fillColor="#8b949e" fillOpacity={0.85}>
                    <Tooltip>Obs #{i + 1} | Wind: {observations[i]?.wind_kt} kt</Tooltip>
                  </CircleMarker>
                ))}
                {/* Predicted markers */}
                {predPath.map((p, i) => (
                  <CircleMarker key={`p-${i}`} center={p} radius={7} color="#3b82f6" fillColor="#60a5fa" fillOpacity={0.9}>
                    <Tooltip>
                      <div>🔵 Predicted Step {i + 1}</div>
                      <div>📍 {p[0].toFixed(3)}°N, {p[1].toFixed(3)}°E</div>
                    </Tooltip>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
            <div className="map-legend" style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: '.75rem', color: 'var(--muted)' }}>
              <span><span style={{ display: 'inline-block', width: 12, height: 3, background: '#8b949e', verticalAlign: 'middle', marginRight: 4 }} />Known observations</span>
              <span><span style={{ display: 'inline-block', width: 12, height: 3, background: '#3b82f6', verticalAlign: 'middle', marginRight: 4 }} />LSTM predicted path</span>
            </div>
          </div>

          {/* Chart */}
          {result && chartData.length > 0 && (
            <div className="card">
              <h3 className="section-title">Forecast Trajectory (Lat / Lon)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <RTooltip
                    contentStyle={{ background: '#1f2937', border: '1px solid #30363d', borderRadius: 8 }}
                    formatter={(v, name) => [`${v.toFixed(4)}°`, name === 'lat' ? 'Latitude' : 'Longitude']}
                  />
                  <Legend wrapperStyle={{ fontSize: '.82rem', color: '#8b949e' }} />
                  <Line type="monotone" dataKey="lat" stroke="#3b82f6" strokeWidth={2} dot name="Latitude" />
                  <Line type="monotone" dataKey="lon" stroke="#f97316" strokeWidth={2} dot name="Longitude" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
