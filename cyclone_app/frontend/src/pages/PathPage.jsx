import React, { useState, useEffect } from 'react'
import {
  MapContainer, TileLayer, Polyline, CircleMarker,
  Tooltip, LayersControl,
} from 'react-leaflet'
import { listStorms, getStormTrack, searchStorms } from '../api/client'
import toast from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'
import './PathPage.css'

const { BaseLayer, Overlay } = LayersControl

const WIND_COLOR = (kt) => {
  if (!kt) return '#3b82f6'
  if (kt >= 120) return '#9f1239'
  if (kt >= 90)  return '#ef4444'
  if (kt >= 64)  return '#f97316'
  if (kt >= 48)  return '#eab308'
  return '#22c55e'
}

export default function PathPage() {
  const [storms, setStorms]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const [track, setTrack]         = useState([])
  const [trackLoading, setTL]     = useState(false)

  const [searchName,  setSearchName]  = useState('')
  const [searchYear,  setSearchYear]  = useState('')
  const [searchBasin, setSearchBasin] = useState('')
  const [searching,   setSearching]   = useState(false)

  useEffect(() => {
    listStorms(500)
      .then(d => setStorms(d.storms || []))
      .catch(e => toast.error('Could not load storms: ' + e.message))
      .finally(() => setLoading(false))
  }, [])

  const loadTrack = (stormId) => {
    setSelected(stormId)
    setTL(true)
    setTrack([])
    getStormTrack(stormId)
      .then(d => { setTrack(d.track || []); toast.success(`Track loaded: ${stormId}`) })
      .catch(e => toast.error(e.response?.data?.detail || e.message))
      .finally(() => setTL(false))
  }

  const runSearch = async () => {
    try {
      setSearching(true)
      const payload = {}
      if (searchName)  payload.name  = searchName
      if (searchYear)  payload.year  = parseInt(searchYear)
      if (searchBasin) payload.basin = searchBasin
      const data = await searchStorms(payload)
      setStorms(data.storms || [])
      toast.success(`Found ${data.count} storm(s)`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSearching(false)
    }
  }

  const resetSearch = () => {
    setSearchName(''); setSearchYear(''); setSearchBasin('')
    setLoading(true)
    listStorms(500).then(d => setStorms(d.storms || [])).finally(() => setLoading(false))
  }

  const trackPositions = track
    .filter(p => p.lat != null && p.lon != null)
    .map(p => [p.lat, p.lon])

  const selectedStorm = storms.find(s => s.id === selected)

  return (
    <div>
      <div className="page-header">
        <h1>🗺️ Path Prediction &amp; IMD Data</h1>
        <p>Historical IMD best-track records from the imdtrack library. Click a storm to view its full track.</p>
      </div>

      <div className="path-layout">
        {/* Sidebar */}
        <div className="path-sidebar">
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="section-title">🔍 Search Storms</h3>
            <div className="form-group">
              <label>Name (contains)</label>
              <input value={searchName} onChange={e => setSearchName(e.target.value)} placeholder="e.g. FANI" />
            </div>
            <div className="form-group">
              <label>Year</label>
              <input type="number" value={searchYear} onChange={e => setSearchYear(e.target.value)} placeholder="e.g. 2019" />
            </div>
            <div className="form-group">
              <label>Basin</label>
              <select value={searchBasin} onChange={e => setSearchBasin(e.target.value)}>
                <option value="">All Basins</option>
                <option value="NI">NI – North Indian</option>
                <option value="SI">SI – South Indian</option>
                <option value="SP">SP – South Pacific</option>
                <option value="WP">WP – West Pacific</option>
                <option value="EP">EP – East Pacific</option>
                <option value="NA">NA – North Atlantic</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={runSearch} disabled={searching} style={{ flex: 1 }}>
                {searching ? '…' : '🔍 Search'}
              </button>
              <button className="btn btn-ghost" onClick={resetSearch}>Reset</button>
            </div>
          </div>

          <div className="card storm-card">
            <h3 className="section-title">{storms.length} Storm(s)</h3>
            {loading ? (
              <div className="center-spinner"><div className="spinner" /></div>
            ) : (
              <div className="storm-scroll">
                {storms.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>No results.</p>
                ) : (
                  storms.map(s => (
                    <div
                      key={s.id}
                      className={`storm-row ${selected === s.id ? 'storm-row--active' : ''}`}
                      onClick={() => loadTrack(s.id)}
                    >
                      <div className="storm-name">{s.name || s.id}</div>
                      <div className="storm-meta">
                        <span>{s.year || '—'}</span>
                        {s.basin && (
                          <span className="badge badge-blue" style={{ fontSize: '.6rem', padding: '1px 6px' }}>
                            {s.basin}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main: map + table */}
        <div className="path-main">
          <div className="card map-card" style={{ marginBottom: 16 }}>
            <h3 className="section-title">
              {selectedStorm
                ? `Track: ${selectedStorm.name || selected} (${selectedStorm.year || ''})`
                : 'Select a storm to view its track'}
              {trackLoading && (
                <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '.78rem', marginLeft: 10 }}>
                  Loading…
                </span>
              )}
            </h3>
            <div className="map-wrap">
              <MapContainer center={[15, 80]} zoom={4} style={{ height: '100%', width: '100%', borderRadius: 8 }}>
                <LayersControl position="topright">
                  <BaseLayer checked name="OpenStreetMap">
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                  </BaseLayer>
                  <BaseLayer name="Satellite (ESRI)">
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution="© Esri"
                    />
                  </BaseLayer>
                  <Overlay checked name="NASA GIBS – MODIS">
                    <TileLayer
                      url="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-01-01/GoogleMapsCompatible/{z}/{y}/{x}.jpg"
                      attribution="NASA GIBS"
                      opacity={0.45}
                    />
                  </Overlay>
                </LayersControl>

                {trackPositions.length > 1 && (
                  <Polyline positions={trackPositions} color="#3b82f6" weight={2.5} />
                )}
                {track
                  .filter(p => p.lat != null && p.lon != null)
                  .map((pt, i) => {
                    const isLast = i === trackPositions.length - 1
                    const c = WIND_COLOR(pt.wind_kt)
                    return (
                      <CircleMarker
                        key={i}
                        center={[pt.lat, pt.lon]}
                        radius={isLast ? 9 : 5}
                        color={isLast ? '#ef4444' : c}
                        fillColor={isLast ? '#ef4444' : c}
                        fillOpacity={0.9}
                      >
                        <Tooltip>
                          <div style={{ fontSize: '.8rem' }}>
                            {pt.time     && <div>🕐 {pt.time}</div>}
                            {pt.wind_kt  != null && <div>💨 {pt.wind_kt} kt</div>}
                            {pt.pressure_hpa != null && <div>📉 {pt.pressure_hpa} hPa</div>}
                            <div>📍 {pt.lat.toFixed(2)}°N {pt.lon.toFixed(2)}°E</div>
                          </div>
                        </Tooltip>
                      </CircleMarker>
                    )
                  })}
              </MapContainer>
            </div>

            {/* Wind intensity legend */}
            {track.length > 0 && (
              <div className="wind-legend">
                {[
                  { label: '< 34 kt TD',  color: '#22c55e' },
                  { label: '48+ kt SCS',  color: '#eab308' },
                  { label: '64+ kt VSCS', color: '#f97316' },
                  { label: '90+ kt ESCS', color: '#ef4444' },
                  { label: '120+ kt SuCS',color: '#9f1239' },
                ].map(w => (
                  <span key={w.label}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: w.color, marginRight: 4, verticalAlign: 'middle' }} />
                    {w.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Observations table */}
          {track.length > 0 && (
            <div className="card obs-card">
              <h3 className="section-title">Best-Track Observations ({track.length} fixes)</h3>
              <div className="obs-table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Time</th>
                      <th>Lat</th>
                      <th>Lon</th>
                      <th>Wind (kt)</th>
                      <th>Category</th>
                      <th>MSLP (hPa)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {track.map((pt, i) => {
                      const c    = WIND_COLOR(pt.wind_kt)
                      const cat  = pt.wind_kt >= 120 ? 'SuCS' : pt.wind_kt >= 90 ? 'ESCS' : pt.wind_kt >= 64 ? 'VSCS' : pt.wind_kt >= 48 ? 'SCS' : pt.wind_kt >= 34 ? 'CS' : 'TD'
                      return (
                        <tr key={i}>
                          <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
                          <td style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{pt.time || '—'}</td>
                          <td>{pt.lat?.toFixed(2) ?? '—'}</td>
                          <td>{pt.lon?.toFixed(2) ?? '—'}</td>
                          <td><strong style={{ color: c }}>{pt.wind_kt?.toFixed(0) ?? '—'}</strong></td>
                          <td><span className="badge" style={{ background: `${c}22`, color: c, fontSize: '.65rem' }}>{cat}</span></td>
                          <td>{pt.pressure_hpa?.toFixed(0) ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
