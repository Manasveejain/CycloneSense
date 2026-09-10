# 🌪️ CycloSense — Cyclone Prediction System

A full-stack AI-powered cyclone prediction platform using trained ML models and real-time satellite imagery.

---

## Architecture

```
MY Model/
├── venv/                          ← Python 3.11 virtual environment
├── cyclone_app/
│   ├── backend/                   ← FastAPI (Python)
│   │   ├── main.py                ← App entry point
│   │   ├── model_loader.py        ← Lazy model singletons
│   │   ├── requirements.txt
│   │   ├── routers/
│   │   │   ├── track.py           ← LSTM track prediction
│   │   │   ├── intensity.py       ← CNN intensity from satellite images
│   │   │   ├── damage.py          ← XGBoost damage + risk zones
│   │   │   ├── path.py            ← IMD best-track data
│   │   │   ├── alerts.py          ← CAP-format emergency alerts
│   │   │   └── satellite.py       ← NASA EONET / GIBS / GOES real-time
│   │   └── utils/
│   │       └── preprocessing.py   ← Shared input preparation helpers
│   └── frontend/                  ← React + Vite
│       └── src/pages/
│           ├── Dashboard.jsx      ← Live map + NASA EONET events
│           ├── SatellitePage.jsx  ← Satellite viewer + CNN intensity
│           ├── TrackPage.jsx      ← LSTM track prediction
│           ├── IntensityPage.jsx  ← CNN intensity (3 input modes)
│           ├── DamagePage.jsx     ← XGBoost damage estimation
│           └── PathPage.jsx       ← IMD historical storm paths
├── track_prediction_lstm_model.h5
├── intensity_estimation_cnn_model.h5
├── damage_estimation_xgb_model.json
└── TCIR-CPAC_IO_SH.h5
```

---

## ML Models

| Model | File | Purpose |
|-------|------|---------|
| LSTM | `track_prediction_lstm_model.h5` | Predicts next lat/lon positions from 8 past observations |
| CNN | `intensity_estimation_cnn_model.h5` | Estimates max sustained wind speed from 64×64×4 satellite images |
| XGBoost | `damage_estimation_xgb_model.json` | Estimates economic damage and risk zone per district |

---

## Satellite Imagery Sources

| Source | What it provides |
|--------|-----------------|
| **NASA EONET** | Active tropical cyclone & severe storm events with lat/lon tracks (no API key needed) |
| **NASA GIBS / Worldview** | Near real-time MODIS Terra/Aqua and VIIRS true-colour tiles (no API key needed) |
| **NOAA GOES-East** | Latest geostationary IR / visible / water vapour sector images (no API key needed) |

---

## Quick Start

### Prerequisites

- Python 3.11 (already in `venv/`)
- Node.js ≥ 18
- All model `.h5` / `.json` files in the `MY Model/` root folder

---

### Terminal 1 — Start the Backend

```powershell
# From the "MY Model" directory
cd "c:\Users\jainv\Downloads\MY Model"

# Activate the virtual environment
.\venv\Scripts\Activate.ps1

# Move into backend directory
cd cyclone_app\backend

# Start FastAPI with hot-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **http://localhost:8000** — API root
- **http://localhost:8000/docs** — Swagger UI (interactive API explorer)
- **http://localhost:8000/health** — Health check

---

### Terminal 2 — Start the Frontend

```powershell
# From the "MY Model" directory
cd "c:\Users\jainv\Downloads\MY Model\cyclone_app\frontend"

# Install dependencies (first time only)
npm install

# Start Vite dev server
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## API Reference

### Track Prediction
```
POST /predict/track
Body: { "observations": [{lat, lon, wind_kt, pressure_hpa}, ...], "steps": 3 }
```

### Intensity Estimation
```
POST /predict/intensity
Body: { "tcir_sample_index": 0 }          ← TCIR archive sample
      { "image_flat": [16384 floats] }     ← Flat 64×64×4 array from satellite tile

POST /predict/intensity/upload             ← Upload an image file (multipart)

GET  /predict/intensity/tcir-info          ← Dataset metadata
```

### Damage Estimation
```
POST /predict/damage
Body: { "districts": [{district_id, distance_to_path_km, predicted_wind_kt, vulnerability_index}, ...] }
```

### Satellite Imagery
```
GET  /satellite/events?days=20             ← NASA EONET active storm events
GET  /satellite/tile?layer=...&date=...    ← NASA GIBS WMTS tile (returns JPEG)
GET  /satellite/goes?band=13               ← GOES-East latest image (returns JPEG)
GET  /satellite/intensity-input?...        ← Tile as flat array for CNN
POST /satellite/storm-image                ← Body: {lat, lon, date, layer}
GET  /satellite/layers                     ← Available imagery layers
```

### IMD Path Data
```
GET  /path/storms?limit=200
GET  /path/storm/{storm_id}
POST /path/search   Body: {name, year, basin}
```

### CAP Alerts
```
POST /alerts/generate
GET  /alerts/levels
```

---

## Frontend Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Live map showing NASA EONET active events + IMD storm archive |
| **Satellite Imagery** | Browse active events, fetch GOES-East live images, run CNN from any map position |
| **Track Prediction** | Enter past observations, predict future positions with the LSTM |
| **Intensity Estimation** | Three modes: TCIR sample / Live satellite tile / Upload image |
| **Damage Estimation** | Per-district XGBoost model with result table, bar chart, risk map, and CAP alerts |
| **Path / IMD Data** | Search and visualise historical IMD best-track records |

---

## Re-installing Dependencies (if needed)

```powershell
# Backend (inside activated venv)
cd "c:\Users\jainv\Downloads\MY Model"
.\venv\Scripts\Activate.ps1
pip install -r cyclone_app\backend\requirements.txt

# Frontend
cd cyclone_app\frontend
npm install
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ModuleNotFoundError: tensorflow` | Make sure the venv is activated before starting uvicorn |
| `CORS error` in browser | Backend must be running on port 8000; vite proxy handles the rest |
| Blank satellite tile | NASA GIBS tiles have a ~1 day delay; the API automatically falls back to yesterday/day-before |
| `imdtrack` fails to load | The app falls back to an empty storm list gracefully; track/intensity/damage still work |
| Port 8000 already in use | `uvicorn main:app --reload --port 8001` then update `vite.config.js` proxy targets |

---

## Tech Stack

**Backend:** Python 3.11 · FastAPI 0.115 · TensorFlow 2.17 · XGBoost 2.1 · NumPy · Pandas · h5py · Pillow · httpx · imdtrack

**Frontend:** React 18 · Vite 5 · React-Leaflet 4 · Recharts 2 · Axios · react-hot-toast

**Satellite sources:** NASA EONET v3 · NASA GIBS (WMTS) · NOAA GOES-East STAR CDN
