import React, { useState, useEffect, useRef } from 'react'
import {
  MapContainer, TileLayer, Polyline, CircleMarker,
  Tooltip, LayersControl, WMSTileLayer,
} from 'react-leaflet'
import {
  getSatelliteEvents, getSatelliteLayers,
  getSatelliteTileUrl, getGoesUrl,
  getStormImage, predictIntensityFromFlat,
} from '../api/client'
import toast from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'
import './SatellitePage.css'

const { BaseLayer, Overlay } = LayersControl

const BANDS = [
  { id: '02', label: 'Band 02 – Visible (0.64 µm)' },
  { id: '09', label: 'Band 09 – Mid-level Water Vapour' },
  { id: '13', label: 'Band 13 – Clean IR Window (10.3 µm)' },
  { id: '14', label: 'Band 14 – IR Longwave Window (11.2 µm)' },
]

const LAYER_LABELS = {
  modis_terra_truecolor:  'MODIS Terra – True Colour',
  modis_aqua_truecolor:   'MODIS Aqua – True Colour',
  viirs_noaa20_truecolor: 'VIIRS NOAA-20 – True Colour',
  viirs_suomi_truecolor:  'VIIRS Suomi NPP – True Colour',
  goes_east_ir:           'GOES-East – IR Band 13',
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SatellitePage() {
  const [events, setEvents]         = useState([])
  const [evLoading, setEL]          = useState(true)
  const [layers, setLayers]         = useState([])
  const [selectedEv, setSelectedEv] = useState(null)

  // Satellite image viewer
  const [goesBand, setGoesBand]     = useState('13')
  const [goesImg, setGoesImg]       = useState(null)
  const [goesLoading, setGL]        = useState(false)

  // Storm-centre fetch
  const [stormLat, setStormLat]     = useState('13.5')
  const [stormLon, setStormLon]     = useState('80.2')
  const [stormDate, setStormDate]   = useState('')
  const [stormLayer, setStormLayer] = useState('modis_terra_truecolor')
  const [stormImg, setStormImg]     = useState(null)
  const [stormFlat, setStormFlat]   = useState(null)
  const [stormLoading, setSL]       = useState(false)

  // Intensity from satellite
  const [intensity, setIntensity]   = useState(null)
  const [iLoading, setIL]           = useState(false)

  // Days filter
  const [days, setDays]             = useState(20)

  useEffect(() => {
    getSatelliteEvents(days, 'all')
      .then(d => { setEvents(d.events || []); setEL(false) })
      .catch(() => setEL(false))
    getSatelliteLayers()
      .then(d => setLayers(d.layers || []))
      .catch(() => {})
  }, [days])

  const fetchGoes = async () => {
    try {
      setGL(true)
      setGoesImg(null)
      const url = getGoesUrl(goesBand)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      setGoesImg(URL.createObjectURL(blob))
      toast.success('GOES-East image loaded')
    } catch (e) {
      toast.error('GOES fetch failed: ' + e.message)
    } finally {
      setGL(false)
    }
  }

  const fetchStormImage = async () => {
    const lat = parseFloat(stormLat)
    const lon = parseFloat(stormLon)
    if (isNaN(lat) || isNaN(lon)) { toast.error('Enter valid lat/lon'); return }
    try {
      setSL(true)
      setStormImg(null)
      setStormFlat(null)
      setIntensity(null)
      const data = await getStormImage(lat, lon, stormDate, stormLayer)
      setStormImg(`data:image/jpeg;base64,${data.image_b64}`)
      setStormFlat(data.image_flat)
      toast.success(`Satellite image loaded (${data.layer}, ${data.date})`)
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setSL(false)
    }
  }

  const runIntensity = async () => {
    if (!stormFlat) { toast.error('Fetch a satellite image first'); return }
    try {
      setIL(true)
      const data = await predictIntensityFromFlat(stormFlat)
      setIntensity(data)
      toast.success(`Intensity: ${data.estimated_wind_kt.toFixed(1)} kt`)
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setIL(false)
    }
  }

  const selectEvent = (ev) => {
    setSelectedEv(ev.id === selectedEv?.id ? null : ev)
    if (ev.latest_lat && ev.latest_lon) {
      setStormLat(ev.latest_lat.toFixed(2))
      setStormLon(ev.latest_lon.toFixed(2))
    }
  }

  const evTrackPath = selectedEv?.track
    ?.filter(p => p.lat && p.lon)
    .map(p => [p.lat, p.lon]) || []

  const windColor = (kt) => {
    if (!kt) return '#3b82f6'
    if (kt >= 120) return '#9f1239'
    if (kt >= 90)  return '#ef4444'
    if (kt >= 64)  return '#f97316'
    if (kt >= 48)  return '#eab308'
    return '#22c55e'
  }

  return (
    <div>
      <div className="page-header">
        <h1>🛰️ Satellite Imagery</h1>
        <p>
          Real-time NASA EONET events · GOES-East live feed · NASA Worldview tiles ·
          Direct CNN intensity estimation from satellite imagery.
        </p>
      </div>

      <div className="sat-layout">
        {/* ── Left: event list + controls ── */}
        <div className="sat-left">

          {/* Event filter */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="section-title">🌐 NASA EONET Events</h3>
            <div className="form-group">
              <label>Look-back window (days)</label>
              <select value={days} onChange={e => { setDays(+e.target.value); setEL(true) }}>
                {[7, 14, 20, 30, 60, 90].map(d => (
                  <option key={d} value={d}>Last {d} days</option>
                ))}
              </select>
            </div>
            {evLoading ? (
              <div className="center-spinner"><div className="spinner" /></div>
            ) : events.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>No events found.</p>
            ) : (
              <div className="ev-list">
                {events.map(ev => (
                  <div
                    key={ev.id}
                    className={`ev-row ${selectedEv?.id === ev.id ? 'ev-row--active' : ''}`}
                    onClick={() => selectEvent(ev)}
                  >
                    <div className="ev-title">{ev.title}</div>
                    <div className="ev-meta">
                      {ev.latest_lat != null && (
                        <span>📍 {ev.latest_lat.toFixed(1)}°N {ev.latest_lon.toFixed(1)}°E</span>
                      )}
                      <span
                        className="badge"
                        style={{
                          background: ev.closed ? 'rgba(139,148,158,.15)' : 'rgba(249,115,22,.18)',
                          color:      ev.closed ? '#8b949e' : '#f97316',
                          fontSize:   '.6rem',
                        }}
                      >
                        {ev.closed ? 'Closed' : 'Active'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GOES-East live */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="section-title">📡 GOES-East Live Image</h3>
            <div className="form-group">
              <label>ABI Band</label>
              <select value={goesBand} onChange={e => setGoesBand(e.target.value)}>
                {BANDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
            <button
              className="btn btn-teal"
              style={{ width: '100%' }}
              onClick={fetchGoes}
              disabled={goesLoading}
            >
              {goesLoading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Fetching…</> : '📡 Fetch Latest GOES Image'}
            </button>
            {goesImg && (
              <div className="sat-img-wrap" style={{ marginTop: 12 }}>
                <img src={goesImg} alt="GOES-East" className="sat-img" />
                <div className="sat-img-caption">
                  GOES-East ABI Band {goesBand} – Latest available frame
                </div>
              </div>
            )}
          </div>

          {/* Satellite layer info */}
          <div className="card">
            <h3 className="section-title">📚 Available Layers</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {layers.map(l => (
                <div key={l.id} className="layer-row">
                  <span className="badge badge-teal" style={{ fontSize: '.65rem' }}>{l.id.split('_')[0].toUpperCase()}</span>
                  <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{l.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: map + storm-centre fetch + intensity ── */}
        <div className="sat-right">

          {/* Map */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="section-title">
              🗺️ Event Tracks
              {selectedEv && (
                <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '.8rem', marginLeft: 8 }}>
                  — {selectedEv.title}
                </span>
              )}
            </h3>
            <div style={{ height: 340, borderRadius: 8, overflow: 'hidden' }}>
              <MapContainer
                center={[15, 80]}
                zoom={3}
                style={{ height: '100%', width: '100%' }}
              >
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
                  <BaseLayer name="OpenStreetMap">
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="© OpenStreetMap"
                    />
                  </BaseLayer>
                  <Overlay checked name="NASA GIBS – MODIS Terra">
                    <TileLayer
                      url="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-01-01/GoogleMapsCompatible/{z}/{y}/{x}.jpg"
                      attribution="NASA GIBS"
                      opacity={0.55}
                    />
                  </Overlay>
                </LayersControl>

                {/* All events */}
                {events.map(ev => {
                  if (!ev.latest_lat || !ev.latest_lon) return null
                  const isActive = !ev.closed
                  return (
                    <CircleMarker
                      key={ev.id}
                      center={[ev.latest_lat, ev.latest_lon]}
                      radius={isActive ? 10 : 6}
                      color={isActive ? '#f97316' : '#8b949e'}
                      fillColor={isActive ? '#f97316' : '#8b949e'}
                      fillOpacity={0.8}
                      eventHandlers={{ click: () => selectEvent(ev) }}
                    >
                      <Tooltip>
                        <div style={{ fontSize: '.8rem' }}>
                          <strong>{ev.title}</strong>
                          <div style={{ color: '#8b949e' }}>{ev.closed ? 'Closed' : '🟠 Active'}</div>
                          <div>📍 {ev.latest_lat.toFixed(2)}°, {ev.latest_lon.toFixed(2)}°</div>
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  )
                })}

                {/* Selected event track */}
                {evTrackPath.length > 1 && (
                  <Polyline positions={evTrackPath} color="#f97316" weight={2.5} />
                )}
                {selectedEv?.track?.filter(p => p.lat && p.lon).map((p, i) => (
                  <CircleMarker
                    key={`ev-${i}`}
                    center={[p.lat, p.lon]}
                    radius={4}
                    color="#f97316"
                    fillColor="#fed7aa"
                    fillOpacity={0.7}
                  >
                    <Tooltip>
                      <div style={{ fontSize: '.78rem' }}>
                        <div>{formatDate(p.date)}</div>
                        <div>📍 {p.lat?.toFixed(2)}°, {p.lon?.toFixed(2)}°</div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </div>

          {/* Storm-centre image fetch + CNN */}
          <div className="card">
            <h3 className="section-title">🌀 Fetch Satellite Image &amp; Predict Intensity</h3>
            <p style={{ color: 'var(--muted)', fontSize: '.83rem', marginBottom: 14, lineHeight: 1.6 }}>
              Enter a storm centre position to fetch the corresponding NASA Worldview tile.
              The tile is then fed directly into the CNN intensity model.
              Clicking an event above auto-fills the coordinates.
            </p>

            <div className="storm-fetch-grid">
              <div className="form-group" style={{ margin: 0 }}>
                <label>Latitude</label>
                <input
                  type="number"
                  value={stormLat}
                  onChange={e => setStormLat(e.target.value)}
                  placeholder="e.g. 13.5"
                  step="0.1"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Longitude</label>
                <input
                  type="number"
                  value={stormLon}
                  onChange={e => setStormLon(e.target.value)}
                  placeholder="e.g. 80.2"
                  step="0.1"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Date (optional)</label>
                <input
                  type="date"
                  value={stormDate}
                  onChange={e => setStormDate(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Layer</label>
                <select value={stormLayer} onChange={e => setStormLayer(e.target.value)}>
                  {Object.entries(LAYER_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={fetchStormImage}
                disabled={stormLoading}
              >
                {stormLoading
                  ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Fetching…</>
                  : '🛰️ Fetch NASA Tile'}
              </button>
              <button
                className="btn btn-orange"
                style={{ flex: 1 }}
                onClick={runIntensity}
                disabled={iLoading || !stormFlat}
              >
                {iLoading
                  ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Predicting…</>
                  : '🌀 Run CNN Intensity'}
              </button>
            </div>

            {/* Result row */}
            {(stormImg || intensity) && (
              <div className="result-row" style={{ marginTop: 18 }}>
                {stormImg && (
                  <div className="sat-img-wrap">
                    <img src={stormImg} alt="Storm satellite tile" className="sat-img" />
                    <div className="sat-img-caption">NASA Worldview tile · 64×64 CNN input</div>
                  </div>
                )}
                {intensity && (
                  <div className="intensity-result">
                    <div
                      className="int-wind"
                      style={{ color: windColor(intensity.estimated_wind_kt) }}
                    >
                      {intensity.estimated_wind_kt.toFixed(1)} kt
                    </div>
                    <div className="int-cat">{intensity.intensity_category}</div>
                    <div className="int-meta">
                      <span>SS: <strong>{intensity.saffir_simpson_scale}</strong></span>
                      <span>{intensity.wind_kmh?.toFixed(0)} km/h</span>
                      <span>{intensity.wind_ms?.toFixed(1)} m/s</span>
                    </div>
                    <div className="int-src">Source: {intensity.source}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
