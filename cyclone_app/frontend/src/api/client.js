import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
})

// ── Track Prediction ──────────────────────────────────────────────────────────
export const predictTrack = (observations, steps = 3) =>
  api.post('/predict/track', { observations, steps }).then(r => r.data)

// ── Intensity Estimation ──────────────────────────────────────────────────────
export const predictIntensity = (tcir_sample_index = 0) =>
  api.post('/predict/intensity', { tcir_sample_index }).then(r => r.data)

export const predictIntensityFromFlat = (image_flat) =>
  api.post('/predict/intensity', { image_flat }).then(r => r.data)

export const predictIntensityUpload = (formData) =>
  api.post('/predict/intensity/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

export const getTcirInfo = () =>
  api.get('/predict/intensity/tcir-info').then(r => r.data)

// ── Damage Estimation ─────────────────────────────────────────────────────────
export const predictDamage = (districts) =>
  api.post('/predict/damage', { districts }).then(r => r.data)

// ── Path / IMD ────────────────────────────────────────────────────────────────
export const listStorms = (limit = 200) =>
  api.get(`/path/storms?limit=${limit}`).then(r => r.data)

export const getStormTrack = (stormId) =>
  api.get(`/path/storm/${stormId}`).then(r => r.data)

export const searchStorms = (payload) =>
  api.post('/path/search', payload).then(r => r.data)

// ── Alerts ────────────────────────────────────────────────────────────────────
export const generateAlerts = (districts) =>
  api.post('/alerts/generate', districts).then(r => r.data)

export const getAlertLevels = () =>
  api.get('/alerts/levels').then(r => r.data)

// ── Satellite Imagery ─────────────────────────────────────────────────────────
export const getSatelliteEvents = (days = 20, status = 'open') =>
  api.get(`/satellite/events?days=${days}&status=${status}`).then(r => r.data)

export const getSatelliteLayers = () =>
  api.get('/satellite/layers').then(r => r.data)

export const getSatelliteTileUrl = (layer, date, zoom, row, col) =>
  `http://localhost:8000/satellite/tile?layer=${layer}&date=${date}&zoom=${zoom}&row=${row}&col=${col}`

export const getGoesUrl = (band = '13') =>
  `http://localhost:8000/satellite/goes?band=${band}`

export const getIntensityInput = (layer, date, zoom, row, col) =>
  api.get('/satellite/intensity-input', {
    params: { layer, date, zoom, row, col },
  }).then(r => r.data)

export const getStormImage = (lat, lon, date = '', layer = 'modis_terra_truecolor') =>
  api.post('/satellite/storm-image', { lat, lon, date, layer }).then(r => r.data)

export default api
