import React, { useEffect, useState, useCallback } from 'react'
import {
  MapContainer, TileLayer, Polyline, CircleMarker,
  Tooltip, LayersControl,
} from 'react-leaflet'
import { listStorms, getStormTrack, getSatelliteEvents } from '../api/client'
import 'leaflet/dist/leaflet.css'
import './Dashboard.css'

const { BaseLayer } = LayersControl

export default function Dashboard({ onNav }) {
  const [storms, setStorms]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [track, setTrack]           = useState([])
  const [trackLoading, setTL]       = useState(false)
  const [error, setError]           = useState(null)
  const [eonetEvents, setEonet]     = useState([])
  const [eonetLoading, setEL]       = useState(true)

  useEffect(() => {
    listStorms(300)
      .then(d => setStorms(d.storms || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))

    getSatelliteEvents(30, 'open')
      .then(d => setEonet(d.events || []))
      .catch(() => setEonet([]))
      .finally(() => setEL(false))
  }, [])

  const loadTrack = useCallback((stormId) => {
    setSelected(stormId)
    setTL(true)
    setTrack([])
    getStormTrack(stormId)
      .then(d => setTrack(d.track || []))
      .catch(() => setTrack([]))
      .finally(() => setTL(false))
  }, [])

  const trackPositions = track
    .filter(p => p.lat != null && p.lon != null)
    .map(p => [p.lat, p.lon])

  const selectedStorm = storms.find(s => s.id === selected)

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>🌐 Dashboard</h1>
        <p>Live NASA EONET active storm events + IMD historical tracks.</p>
      </div>

      {/* Stats row */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-chip">
          <span className="label">IMD Storms</span>
          <span className="value" style={{ color: '#60a5fa' }}>
            {loading ? '—' : storms.length}
          </span>
        </div>
        <div className="stat-chip">
          <span className="label">Active Events (NASA)</span>
          <span className="value" style={{ color: '#22c55e' }}>
            {eonetLoading ? '—' : eonetEvents.length}
          </span>
        </div>
        <div className="stat-chip">
          <span className="label">Track Points</span>
          <span className="value" style={{ color: '#f97316' }}>{track.length}</span>
        </div>
        <div className="stat-chip">
          <span className="label">Selected Storm</span>
          <span className="value" style={{ fontSize: '.95rem', color: '#a855f7' }}>
            {selectedStorm?.name || selected || 'None'}
          </span>
        </div>
      </div>

      <div className="dash-grid">
        {/* Map */}
        <div className="card map-card">
          <h3 className="section-title">
            🗺️ Storm Tracks &amp; Active Events
            {trackLoading && (
              <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '.78rem', marginLeft: 10 }}>
                Loading track…
              </span>
            )}
          </h3>
          <div className="map-wrap">
            <MapContainer center={[15, 80]} zoom={4} style={{ height: '100%', width: '100%', borderRadius: 8 }}>
              <LayersControl position="topright">
                <BaseLayer checked name="OpenStreetMap">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="© OpenStreetMap contributors"
                  />
                </BaseLayer>
                <BaseLayer name="Dark (CartoDB)">
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
              </LayersControl>

              {/* IMD selected track */}
              {trackPositions.length > 1 && (
                <Polyline positions={trackPositions} color="#3b82f6" weight={2.5} dashArray="6 4" />
              )}
              {trackPositions.map((pos, i) => {
                const pt = track.filter(p => p.lat != null)[i]
                const isLast = i === trackPositions.length - 1
                return (
                  <CircleMarker
                    key={`imd-${i}`}
                    center={pos}
                    radius={isLast ? 9 : 4}
                    color={isLast ? '#ef4444' : '#3b82f6'}
                    fillColor={isLast ? '#ef4444' : '#60a5fa'}
                    fillOpacity={0.9}
                  >
                    <Tooltip>
                      <div style={{ fontSize: '.8rem' }}>
                        {pt?.time && <div>🕐 {pt.time}</div>}
                        {pt?.wind_kt != null && <div>💨 {pt.wind_kt} kt</div>}
                        {pt?.pressure_hpa != null && <div>📉 {pt.pressure_hpa} hPa</div>}
                        <div>📍 {pos[0].toFixed(2)}°N {pos[1].toFixed(2)}°E</div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                )
              })}

              {/* NASA EONET active events */}
              {eonetEvents.map(ev => {
                if (!ev.latest_lat || !ev.latest_lon) return null
                const evTrack = ev.track || []
                const evPath  = evTrack.map(p => [p.lat, p.lon]).filter(p => p[0] && p[1])
                return (
                  <React.Fragment key={ev.id}>
                    {evPath.length > 1 && (
                      <Polyline positions={evPath} color="#f97316" weight={2} dashArray="4 3" />
                    )}
                    <CircleMarker
                      center={[ev.latest_lat, ev.latest_lon]}
                      radius={10}
                      color="#f97316"
                      fillColor="#f97316"
                      fillOpacity={0.85}
                    >
                      <Tooltip permanent={false}>
                        <div style={{ fontSize: '.8rem' }}>
                          <strong>🟠 {ev.title}</strong>
                          <div style={{ color: '#8b949e' }}>NASA EONET Active Event</div>
                          <div>📍 {ev.latest_lat?.toFixed(2)}°N {ev.latest_lon?.toFixed(2)}°E</div>
                          {ev.track?.length > 0 && <div>Track pts: {ev.track.length}</div>}
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  </React.Fragment>
                )
              })}
            </MapContainer>
          </div>

          {/* Legend */}
          <div className="map-legend">
            <span><span className="legend-dot" style={{ background: '#3b82f6' }} /> IMD Track</span>
            <span><span className="legend-dot" style={{ background: '#f97316' }} /> NASA EONET Active</span>
            <span><span className="legend-dot" style={{ background: '#ef4444' }} /> Latest Position</span>
          </div>
        </div>

        {/* Right column */}
        <div className="dash-right">
          {/* Active events */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="section-title">🟠 NASA EONET Active Events</h3>
            {eonetLoading ? (
              <div className="center-spinner"><div className="spinner" /></div>
            ) : eonetEvents.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>No active storm events at this time.</p>
            ) : (
              <div className="eonet-list">
                {eonetEvents.slice(0, 6).map(ev => (
                  <div key={ev.id} className="eonet-row">
                    <div className="eonet-title">{ev.title}</div>
                    <div className="eonet-meta">
                      {ev.latest_lat != null && (
                        <span>📍 {ev.latest_lat.toFixed(1)}°N {ev.latest_lon.toFixed(1)}°E</span>
                      )}
                      <span className="badge badge-orange" style={{ fontSize: '.6rem', marginLeft: 4 }}>Active</span>
                    </div>
                  </div>
                ))}
                <button
                  className="btn btn-ghost"
                  style={{ width: '100%', marginTop: 8, fontSize: '.8rem' }}
                  onClick={() => onNav('satellite')}
                >
                  View All in Satellite →
                </button>
              </div>
            )}
          </div>

          {/* IMD Storm list */}
          <div className="card storm-list-card">
            <h3 className="section-title">📋 IMD Storm Archive</h3>
            {error && <div className="error-msg">{error}</div>}
            {loading ? (
              <div className="center-spinner"><div className="spinner" /></div>
            ) : (
              <div className="storm-scroll">
                {storms.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: '.85rem', padding: 12 }}>
                    No storms loaded. Is the backend running?
                  </p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Year</th>
                        <th>Basin</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {storms.map(s => (
                        <tr key={s.id} className={selected === s.id ? 'row-selected' : ''}>
                          <td>{s.name || '—'}</td>
                          <td>{s.year || '—'}</td>
                          <td>{s.basin && <span className="badge badge-blue">{s.basin}</span>}</td>
                          <td>
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '3px 10px', fontSize: '.72rem' }}
                              onClick={() => loadTrack(s.id)}
                            >
                              Track
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
