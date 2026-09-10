import React, { useState, useRef, useEffect } from 'react'
import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer,
} from 'recharts'
import {
  predictIntensity, predictIntensityFromFlat,
  predictIntensityUpload, getTcirInfo,
  getStormImage,
} from '../api/client'
import toast from 'react-hot-toast'
import './IntensityPage.css'

const CATEGORY_COLOR = {
  'Tropical Depression':                   '#22c55e',
  'Tropical Storm':                        '#84cc16',
  'Severe Cyclonic Storm':                 '#eab308',
  'Very Severe Cyclonic Storm (Cat 1-2)':  '#f97316',
  'Extremely Severe (Cat 3)':              '#ef4444',
  'Super Cyclonic Storm (Cat 4)':          '#dc2626',
  'Super Cyclonic Storm (Cat 5)':          '#9f1239',
}

const SS_LABEL = {
  'TD':    'Tropical Depression',
  'TS':    'Tropical Storm',
  'SCS':   'Severe Cyclonic Storm',
  'SS1-2': 'Cat 1–2 Hurricane Equivalent',
  'SS3':   'Cat 3 – Major Hurricane',
  'SS4':   'Cat 4 – Super Cyclone',
  'SS5':   'Cat 5 – Super Cyclone',
}

const MODES = [
  { id: 'tcir',      label: '📦 TCIR Archive',       desc: 'Use a sample from the TCIR HDF5 dataset' },
  { id: 'satellite', label: '🛰️ Live Satellite Tile', desc: 'Fetch a NASA Worldview tile by position' },
  { id: 'upload',    label: '📁 Upload Image',        desc: 'Upload any satellite image file' },
]

const LAYER_LABELS = {
  modis_terra_truecolor:  'MODIS Terra – True Colour',
  modis_aqua_truecolor:   'MODIS Aqua – True Colour',
  viirs_noaa20_truecolor: 'VIIRS NOAA-20 – True Colour',
  viirs_suomi_truecolor:  'VIIRS Suomi NPP – True Colour',
  goes_east_ir:           'GOES-East IR Band 13',
}

export default function IntensityPage() {
  const [mode, setMode]         = useState('tcir')
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [tcirInfo, setTcirInfo] = useState(null)
  const [previewImg, setPreview]= useState(null)

  // TCIR mode
  const [sampleIdx, setSampleIdx] = useState(0)

  // Satellite mode
  const [satLat,  setSatLat]  = useState('13.5')
  const [satLon,  setSatLon]  = useState('80.2')
  const [satDate, setSatDate] = useState('')
  const [satLayer,setSatLayer]= useState('modis_terra_truecolor')
  const [satFlat, setSatFlat] = useState(null)
  const [satFetching, setSF]  = useState(false)

  // Upload mode
  const fileRef = useRef(null)
  const [uploadFile, setUploadFile] = useState(null)

  useEffect(() => {
    getTcirInfo()
      .then(d => setTcirInfo(d))
      .catch(() => {})
  }, [])

  // ── Run model ────────────────────────────────────────────────────────────────
  const run = async () => {
    try {
      setLoading(true)
      let data

      if (mode === 'tcir') {
        data = await predictIntensity(sampleIdx)

      } else if (mode === 'satellite') {
        if (!satFlat) { toast.error('Fetch a satellite tile first'); return }
        data = await predictIntensityFromFlat(satFlat)

      } else if (mode === 'upload') {
        if (!uploadFile) { toast.error('Select an image file first'); return }
        const fd = new FormData()
        fd.append('file', uploadFile)
        data = await predictIntensityUpload(fd)
      }

      setResult(data)
      toast.success(`Estimated: ${data.estimated_wind_kt.toFixed(1)} kt`)
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Satellite tile fetch ──────────────────────────────────────────────────────
  const fetchTile = async () => {
    const lat = parseFloat(satLat)
    const lon = parseFloat(satLon)
    if (isNaN(lat) || isNaN(lon)) { toast.error('Enter valid lat/lon'); return }
    try {
      setSF(true)
      setSatFlat(null)
      setPreview(null)
      const data = await getStormImage(lat, lon, satDate, satLayer)
      setSatFlat(data.image_flat)
      setPreview(`data:image/jpeg;base64,${data.image_b64}`)
      toast.success(`Tile fetched (${data.date})`)
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message)
    } finally {
      setSF(false)
    }
  }

  // ── File select ───────────────────────────────────────────────────────────────
  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setUploadFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
  }

  const wind   = result?.estimated_wind_kt ?? 0
  const color  = result ? CATEGORY_COLOR[result.intensity_category] || '#3b82f6' : '#3b82f6'
  const pct    = Math.min((wind / 200) * 100, 100)
  const gaugeData = [{ name: 'Wind', value: pct, fill: color }]

  return (
    <div>
      <div className="page-header">
        <h1>🌀 Intensity Estimation</h1>
        <p>CNN model on 64×64×4 satellite imagery — estimates maximum sustained wind speed.</p>
      </div>

      <div className="intensity-layout">
        {/* ── Left: controls ── */}
        <div className="int-left">

          {/* Mode selector */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="section-title">Input Source</h3>
            <div className="mode-tabs">
              {MODES.map(m => (
                <button
                  key={m.id}
                  className={`mode-tab ${mode === m.id ? 'mode-tab--active' : ''}`}
                  onClick={() => { setMode(m.id); setResult(null); setPreview(null) }}
                >
                  <span>{m.label}</span>
                  <span className="mode-desc">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── TCIR mode ── */}
          {mode === 'tcir' && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 className="section-title">TCIR Archive Sample</h3>
              {tcirInfo && (
                <div className="tcir-info">
                  <span>📦 {tcirInfo.sample_count} samples</span>
                  <span>💨 {tcirInfo.wind_range_kt?.[0]?.toFixed(0)}–{tcirInfo.wind_range_kt?.[1]?.toFixed(0)} kt range</span>
                  <span>📐 {tcirInfo.image_shape?.join('×')}</span>
                </div>
              )}
              <div className="form-group">
                <label>Sample Index (0 – {tcirInfo ? tcirInfo.sample_count - 1 : '?'})</label>
                <input
                  type="number"
                  min={0}
                  max={tcirInfo ? tcirInfo.sample_count - 1 : 9999}
                  value={sampleIdx}
                  onChange={e => setSampleIdx(Number(e.target.value))}
                />
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '.8rem', lineHeight: 1.6 }}>
                The TCIR dataset contains real tropical cyclone satellite images.
                Each sample is an 4-channel (IR, WV, VIS, PMW) 64×64 patch.
              </p>
            </div>
          )}

          {/* ── Satellite mode ── */}
          {mode === 'satellite' && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 className="section-title">🛰️ NASA Worldview Tile</h3>
              <div className="grid-2" style={{ gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Latitude</label>
                  <input type="number" value={satLat} onChange={e => setSatLat(e.target.value)} step="0.1" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Longitude</label>
                  <input type="number" value={satLon} onChange={e => setSatLon(e.target.value)} step="0.1" />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 10 }}>
                <label>Date (blank = yesterday)</label>
                <input type="date" value={satDate} onChange={e => setSatDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Imagery Layer</label>
                <select value={satLayer} onChange={e => setSatLayer(e.target.value)}>
                  {Object.entries(LAYER_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-teal"
                style={{ width: '100%' }}
                onClick={fetchTile}
                disabled={satFetching}
              >
                {satFetching
                  ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Fetching tile…</>
                  : '🛰️ Fetch NASA Tile'}
              </button>
              {previewImg && (
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <img
                    src={previewImg}
                    alt="Satellite tile"
                    style={{ width: '100%', maxWidth: 200, borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                  <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 4 }}>
                    NASA Worldview tile · 64×64 CNN input ready
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Upload mode ── */}
          {mode === 'upload' && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 className="section-title">📁 Upload Satellite Image</h3>
              <p style={{ color: 'var(--muted)', fontSize: '.82rem', marginBottom: 14, lineHeight: 1.6 }}>
                Upload any satellite image (PNG, JPEG, GeoTIFF).
                The backend resizes it to 64×64 and converts to 4-channel RGBA.
                Use INSAT-3D, GOES, Himawari, or any IR/visible band imagery.
              </p>
              <div
                className="upload-zone"
                onClick={() => fileRef.current?.click()}
                onDrop={e => { e.preventDefault(); handleFile({ target: { files: e.dataTransfer.files } }) }}
                onDragOver={e => e.preventDefault()}
              >
                {previewImg ? (
                  <img src={previewImg} alt="preview" className="upload-preview" />
                ) : (
                  <>
                    <div className="upload-icon">🖼️</div>
                    <div>Click or drag &amp; drop a satellite image</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>PNG / JPEG / TIFF</div>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFile}
              />
              {uploadFile && (
                <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: 8 }}>
                  📎 {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          )}

          {/* Run button */}
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={run}
            disabled={loading || (mode === 'satellite' && !satFlat) || (mode === 'upload' && !uploadFile)}
          >
            {loading
              ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Estimating…</>
              : '▶ Run Intensity Model'}
          </button>

          <hr className="divider" />

          {/* Channel info */}
          <div className="card">
            <h3 className="section-title">TCIR Channel Reference</h3>
            {[
              { ch: 'IR',  color: '#ef4444', desc: 'Infrared – cloud-top temperatures' },
              { ch: 'WV',  color: '#3b82f6', desc: 'Water Vapour – upper-level moisture' },
              { ch: 'VIS', color: '#eab308', desc: 'Visible – cloud structure (daytime)' },
              { ch: 'PMW', color: '#a855f7', desc: 'Passive Microwave – precipitation / convection' },
            ].map(c => (
              <div key={c.ch} className="channel-row">
                <span className="ch-badge" style={{ background: `${c.color}22`, color: c.color }}>{c.ch}</span>
                <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{c.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: result ── */}
        <div className="int-right">
          {result ? (
            <>
              {/* Gauge */}
              <div className="card gauge-card" style={{ marginBottom: 16 }}>
                <h3 className="section-title">Wind Speed Gauge</h3>
                <div className="gauge-wrap">
                  <ResponsiveContainer width="100%" height={220}>
                    <RadialBarChart
                      cx="50%" cy="80%"
                      innerRadius="60%" outerRadius="100%"
                      startAngle={180} endAngle={0}
                      data={gaugeData}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" background={{ fill: '#1f2937' }} cornerRadius={8} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="gauge-label">
                    <div className="gauge-value" style={{ color }}>{wind.toFixed(1)} kt</div>
                    <div className="gauge-sub">Max Sustained Wind</div>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 className="section-title">Classification Details</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Intensity Category</span>
                    <span className="detail-value" style={{ color }}>{result.intensity_category}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Saffir-Simpson</span>
                    <span className="detail-value">
                      {result.saffir_simpson_scale} — {SS_LABEL[result.saffir_simpson_scale]}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Wind Speed (km/h)</span>
                    <span className="detail-value">{result.wind_kmh?.toFixed(1) ?? (wind * 1.852).toFixed(1)} km/h</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Wind Speed (m/s)</span>
                    <span className="detail-value">{result.wind_ms?.toFixed(1) ?? (wind * 0.5144).toFixed(1)} m/s</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Image Source</span>
                    <span className="badge badge-teal" style={{ fontSize: '.72rem' }}>{result.source}</span>
                  </div>
                </div>
              </div>

              {/* IMD Scale reference */}
              <div className="card">
                <h3 className="section-title">IMD Intensity Scale</h3>
                {[
                  { range: '< 34 kt',   label: 'Tropical Depression',             color: '#22c55e' },
                  { range: '34–47 kt',  label: 'Cyclonic Storm',                  color: '#84cc16' },
                  { range: '48–63 kt',  label: 'Severe Cyclonic Storm',           color: '#eab308' },
                  { range: '64–89 kt',  label: 'Very Severe Cyclonic Storm',      color: '#f97316' },
                  { range: '90–119 kt', label: 'Extremely Severe Cyclonic Storm', color: '#ef4444' },
                  { range: '≥ 120 kt',  label: 'Super Cyclonic Storm',            color: '#9f1239' },
                ].map(s => (
                  <div key={s.range} className="scale-row" style={{ borderLeft: `3px solid ${s.color}` }}>
                    <span className="scale-range">{s.range}</span>
                    <span className="scale-label" style={{ color: wind >= parseInt(s.range) ? s.color : 'var(--muted)' }}>
                      {s.label}
                    </span>
                    {/* active indicator */}
                    {result && CATEGORY_COLOR[result.intensity_category] === s.color && (
                      <span style={{ marginLeft: 'auto', fontSize: '.65rem', color: s.color }}>◀ current</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="card placeholder-card">
              <div className="placeholder-icon">🌀</div>
              <p>
                {mode === 'satellite' && !satFlat
                  ? 'Fetch a satellite tile first, then run the model.'
                  : mode === 'upload' && !uploadFile
                  ? 'Upload a satellite image to get started.'
                  : 'Run the model to see intensity results here.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
