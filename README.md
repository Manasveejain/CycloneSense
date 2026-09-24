# 🌪️ CycloneSense

### AI-Powered End-to-End Cyclone Prediction, Risk Assessment & Alert System

CycloneSense is an end-to-end AI/ML and geospatial decision-support system designed to assist with tropical cyclone monitoring and disaster preparedness.

The system combines satellite-image analysis, cyclone intensity estimation, trajectory forecasting, coastal risk assessment, economic damage estimation, and emergency alert generation into a unified dashboard.

> **Project goal:** Transform raw cyclone and satellite observations into actionable information for disaster-management workflows.

---

## 🚀 Key Capabilities

CycloneSense is organized as a multi-module pipeline:

| Module | Purpose | Technology / Approach |
|---|---|---|
| **Module 1** | Cyclone intensity estimation and IMD classification | Deep-learning image model |
| **Module 2** | Infrared-based intensity estimation | ResNet-18 / deep-learning regression |
| **Module 3** | Cyclone trajectory forecasting | GRU/LSTM-based time-series forecasting |
| **Module 4** | Coastal risk assessment | GIS + multi-criteria risk analysis |
| **Module 5** | Economic damage estimation | XGBoost-based regression |
| **Module 6** | Emergency communication | CAP-style alert generation and dispatch |

The unified dashboard also supports historical cyclone scenarios and custom satellite-image input.

---

## 🧠 System Workflow

```text
                    ┌─────────────────────────┐
                    │  Satellite / Cyclone    │
                    │        Data             │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Satellite Perception    │
                    │ IR / WV / VIS / PMW     │
                    └────────────┬────────────┘
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
       ┌──────────────────┐             ┌──────────────────┐
       │ Intensity Model  │             │ Track Forecast   │
       │ CNN / ResNet     │             │ GRU / LSTM       │
       └────────┬─────────┘             └────────┬─────────┘
                │                                │
                ▼                                ▼
       ┌──────────────────┐             ┌──────────────────┐
       │ IMD Classification│            │ Uncertainty Cone │
       └────────┬─────────┘             └────────┬─────────┘
                │                                │
                └──────────────┬─────────────────┘
                               ▼
                    ┌─────────────────────────┐
                    │ Coastal Risk Assessment │
                    │       GIS Module        │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Economic Damage Model   │
                    │        XGBoost          │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Emergency Alert System  │
                    │       CAP Alerts        │
                    └─────────────────────────┘
```

---

## ✨ Features

### 🛰️ Multi-Spectral Satellite Analysis

CycloneSense supports analysis of multiple satellite observation channels:

- Infrared (IR)
- Water Vapor (WV)
- Visible (VIS)
- Passive Microwave (PMW)

These observations can be used to analyze cyclone structure, intensity, and evolution.

### 🌪️ Cyclone Intensity Estimation

The system estimates cyclone intensity from satellite observations and maps the prediction to cyclone categories used by the India Meteorological Department (IMD).

Outputs can include:

- Maximum sustained wind speed
- Wind speed in knots / km/h
- Cyclone intensity category
- Model confidence / prediction information

### 📍 Trajectory Forecasting

Historical cyclone observations are processed as time-series data to forecast future cyclone positions.

The forecasting module provides:

- Future latitude
- Future longitude
- Multiple lead-time predictions
- Forecast trajectory
- Uncertainty / prediction cone visualization

### 🗺️ GIS-Based Coastal Risk Assessment

The GIS module combines relevant geographic and cyclone-related factors to classify coastal risk.

Example risk levels:

- 🔴 Red
- 🟠 Orange
- 🟡 Yellow

This helps translate meteorological predictions into geographically meaningful risk information.

### 💰 Economic Damage Estimation

An XGBoost-based model estimates potential economic damage using cyclone and affected-area information.

Results can be displayed in:

- USD millions
- INR crores

> Damage estimates are model outputs and should be treated as decision-support information rather than official loss assessments.

### 🚨 Emergency Alerts

CycloneSense includes a Common Alerting Protocol (CAP)-style emergency communication workflow intended to structure cyclone warnings for downstream dissemination.

---

## 🗂️ Repository Structure

```text
CycloneSense/
│
├── cyclone_app/
│   ├── backend/
│   │   ├── main.py
│   │   └── ...
│   │
│   └── frontend/
│       ├── src/
│       ├── public/
│       └── ...
│
├── Main_Module.ipynb
├── 02_module2_ir_intensity_.ipynb
├── IBTrACS.ALL.v04r01.nc
├── run code.txt
├── .gitignore
└── README.md
```

The repository contains both the research/model-development notebooks and the application layer used for the unified dashboard.

---

## 📊 Data

CycloneSense uses cyclone and satellite-related datasets for model development and analysis.

### IBTrACS

The repository includes an IBTrACS dataset file:

```text
IBTrACS.ALL.v04r01.nc
```

IBTrACS (International Best Track Archive for Climate Stewardship) provides historical tropical-cyclone best-track information.

### TCIR Dataset

The infrared intensity module is designed to work with the TCIR dataset stored as an HDF5 archive.

The processing pipeline includes:

- Lazy loading from HDF5
- Missing-value handling
- Per-channel normalization
- Image resizing
- Batch-wise data loading
- Stratified group cross-validation
- Intensity regression

The IR module uses four input channels and resizes observations to `64 × 64` before model processing.

---

## 🤖 Machine Learning Pipeline

### Intensity Module

The intensity pipeline uses satellite imagery to estimate maximum sustained wind speed.

The implementation includes:

- Image preprocessing
- Channel normalization
- Lazy dataset loading
- Deep-learning regression
- Mean Absolute Error (MAE)
- Mean Squared Error (MSE)
- R² evaluation
- Cross-validation

The repository's IR-intensity notebook implements a ResNet-18-based regression approach and also includes a digital Advanced Dvorak Technique (ADT) benchmark.

### Trajectory Module

The trajectory forecasting component uses sequential cyclone observations to predict future positions.

The configured forecasting horizon includes:

```text
+6 hours
+12 hours
+18 hours
+24 hours
+30 hours
```

The dashboard can visualize these predictions as a projected trajectory with an uncertainty region.

### Damage Prediction

The economic-impact module uses XGBoost regression to estimate potential losses based on cyclone and affected-region characteristics.

---

## 🛠️ Technology Stack

### Machine Learning

- Python
- TensorFlow / Keras
- PyTorch
- Scikit-learn
- XGBoost
- NumPy
- Pandas

### Scientific & Geospatial Processing

- Xarray
- GeoPandas
- Rasterio
- HDF5 / h5py
- Matplotlib

### Backend

- FastAPI
- Uvicorn
- Python

### Frontend

- React
- Vite
- JavaScript / TypeScript

### Data

- IBTrACS
- TCIR satellite imagery dataset
- Historical cyclone observations

---

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/Manasveejain/CycloneSense.git
cd CycloneSense
```

### 2. Create a Python virtual environment

```bash
python -m venv venv
```

#### Windows

```bash
venv\Scripts\activate
```

#### Linux / macOS

```bash
source venv/bin/activate
```

### 3. Install backend dependencies

If a `requirements.txt` file is available in the backend directory:

```bash
cd cyclone_app/backend
pip install -r requirements.txt
```

If dependencies are being installed manually for the notebooks, the project uses packages including:

```bash
pip install numpy pandas matplotlib scikit-learn tensorflow torch torchvision
pip install xarray geopandas rasterio h5py py7zr joblib xgboost
```

---

## ▶️ Running the Application

### Start the FastAPI Backend

From the backend directory:

```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend:

```text
http://localhost:8000
```

Interactive API documentation:

```text
http://localhost:8000/docs
```

### Start the React Frontend

Open a second terminal:

```bash
cd cyclone_app/frontend
npm install
npm run dev
```

The dashboard will normally be available at:

```text
http://localhost:5173
```

---

## 🧪 Running the Notebooks

### Main Module

Open:

```text
Main_Module.ipynb
```

This notebook contains the primary model-development workflow.

### IR Intensity Module

Open:

```text
02_module2_ir_intensity_.ipynb
```

This notebook contains the standalone infrared-intensity pipeline.

The notebook can work with the TCIR archive and stores generated models/artifacts in directories such as:

```text
models/
cyclone_artifacts/
data/processed/
```

For large datasets, the pipeline is designed to process data in batches rather than loading the entire dataset into memory.

---

## 🌪️ Historical Storm Scenarios

The unified GUI includes historical Indian Ocean cyclone examples such as:

- Cyclone Fani
- Cyclone Amphan
- Cyclone Biparjoy
- Cyclone Tauktae
- Cyclone Michaung

Users can also provide a custom satellite image for analysis.

---

## 📈 Example Output

A typical CycloneSense analysis can produce:

```text
Cyclone
   │
   ├── Current Intensity
   │      ├── Wind Speed
   │      └── IMD Category
   │
   ├── Forecast Track
   │      ├── Future Coordinates
   │      └── Uncertainty Cone
   │
   ├── Coastal Risk
   │      └── Red / Orange / Yellow
   │
   ├── Economic Impact
   │      ├── USD Million
   │      └── INR Crore
   │
   └── Emergency Response
          └── CAP Alert
```

---

## 🎯 Project Objectives

CycloneSense aims to:

1. Automate parts of cyclone analysis using AI/ML.
2. Estimate cyclone intensity from satellite observations.
3. Forecast cyclone movement using temporal models.
4. Convert meteorological information into coastal risk levels.
5. Estimate potential economic impact.
6. Provide structured emergency alerts.
7. Present multiple outputs through a single decision-support dashboard.

---

## 🔮 Future Improvements

Potential future extensions include:

- Real-time satellite data ingestion
- Integration with official meteorological APIs
- Real-time cyclone tracking
- Multi-cyclone simultaneous tracking
- Improved uncertainty quantification
- Rainfall estimation
- Flood-risk prediction
- Population exposure estimation
- Infrastructure vulnerability modeling
- Mobile emergency-alert interface
- Automated multilingual public warnings
- Edge/offline deployment for low-connectivity regions

---

## ⚠️ Limitations & Disclaimer

CycloneSense is a research and prototype decision-support system.

Model predictions should **not** replace official warnings or forecasts issued by authorized meteorological and disaster-management agencies.

Accuracy depends on:

- Quality and availability of satellite observations
- Training-data coverage
- Model generalization
- Forecast lead time
- Geographic region
- Input-data quality

Economic-loss estimates and risk classifications are model-generated estimates and should be validated against authoritative datasets before operational use.

---

## 📚 References

- **IBTrACS — International Best Track Archive for Climate Stewardship**
  https://www.ncei.noaa.gov/products/international-best-track-archive

- **India Meteorological Department (IMD)**
  https://mausam.imd.gov.in/

- **TensorFlow**
  https://www.tensorflow.org/

- **PyTorch**
  https://pytorch.org/

- **XGBoost**
  https://xgboost.readthedocs.io/

---

## 👨‍💻 Author

**Manasvee Jain
Team : Swastik
**

GitHub:  
https://github.com/Manasveejain

Project Repository:  
https://github.com/Manasveejain/CycloneSense

---

## ⭐ Acknowledgement

CycloneSense was developed as an AI/ML-based disaster-management project exploring how satellite data, deep learning, time-series forecasting, geospatial analysis, and automated alerting can be combined into a unified cyclone decision-support system.

---

## 📄 License

Add the project's intended license here if/when a license is included in the repository.
