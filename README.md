# 🌪️ CycloneSense

### AI-Powered Cyclone Track Forecasting, Intensity Estimation, Risk Assessment, Economic Loss Modeling & Multilingual Alerts

CycloneSense is an end-to-end AI/ML-based cyclone decision-support system that combines **track forecasting, cyclone intensity estimation, spatial risk assessment, economic loss modeling, and multilingual emergency alerts** into a unified workflow.

The system is designed to transform historical cyclone observations and satellite imagery into actionable information for cyclone monitoring, preparedness, and disaster-response planning.

---

## 🚀 Key Features

- 🌪️ **Multi-step cyclone track forecasting**
- 💨 **Cyclone wind-speed and pressure forecasting**
- 🛰️ **Infrared satellite-based intensity estimation**
- 🧠 **Machine-learning cyclone category classification**
- 🗺️ **Fuzzy-AHP spatial risk assessment**
- 🏠 **Population and building vulnerability modeling**
- 💰 **Sector-wise economic loss estimation**
- 🎲 **Monte Carlo uncertainty analysis**
- 🚨 **Dynamic emergency alert generation**
- 🌐 **Multilingual alerts in 7 Indian languages**
- 📊 **Unified decision-support workflow**

---

# 🧠 System Architecture

```text
                  ┌────────────────────────────┐
                  │ Historical Cyclone Data   │
                  │ Satellite IR Observations │
                  └─────────────┬──────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
              ▼                                   ▼
     ┌──────────────────┐                ┌──────────────────┐
     │    MODULE 1      │                │    MODULE 2      │
     │ Track & Intensity│                │ IR Intensity     │
     │ Forecasting      │                │ Estimation       │
     │ GBR + RF +       │                │ ResNet18IR       │
     │ CLIPER           │                │                  │
     └────────┬─────────┘                └────────┬─────────┘
              │                                   │
              └────────────────┬──────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Cyclone Forecast &  │
                    │ Intensity Estimates │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
        ┌──────────────────┐        ┌──────────────────┐
        │    MODULE 3      │        │    MODULE 4      │
        │ Risk Assessment  │        │ Economic Loss    │
        │ Fuzzy-AHP +      │        │ Holland Wind     │
        │ Spatial Model    │        │ + Monte Carlo    │
        └────────┬─────────┘        └────────┬─────────┘
                 │                           │
                 └─────────────┬─────────────┘
                               ▼
                    ┌─────────────────────┐
                    │    MODULE 5         │
                    │ Multilingual Alert  │
                    │ Generation          │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Emergency / Public  │
                    │ Communication       │
                    └─────────────────────┘
```

---

# 🌪️ Module 1: Cyclone Track & Intensity Forecasting

Module 1 uses machine-learning models to forecast cyclone movement, intensity, and storm category at multiple future lead times.

## 1. Gradient Boosting Regressor (GBR)

The Gradient Boosting Regressor performs **multi-step forecasting** for cyclone track displacement and intensity-related variables.

### Configuration

| Parameter | Value |
|---|---:|
| Estimators | 150 |
| Learning Rate | 0.03 |
| Maximum Depth | 3 |
| Subsample | 0.8 |

### Forecast Targets

The model predicts four quantities at five forecast lead times:

| Target | Unit | Lead Times |
|---|---|---|
| Distance displacement | km | 6, 12, 18, 24, 30 h |
| Heading | radians | 6, 12, 18, 24, 30 h |
| Wind speed | knots | 6, 12, 18, 24, 30 h |
| Pressure | hPa | 6, 12, 18, 24, 30 h |

This produces a multi-step representation of both cyclone movement and intensity evolution.

---

## 2. Random Forest Classifier

A Random Forest classifier predicts the cyclone's storm status/intensity category.

### Configuration

- **Estimators:** 200
- **Maximum depth:** 12
- **Class weighting:** Enabled to address imbalanced cyclone categories

The classifier predicts IMD cyclone categories ranging from:

```text
Low Pressure Area
        ↓
Depression
        ↓
Deep Depression
        ↓
Cyclonic Storm
        ↓
Severe Cyclonic Storm
        ↓
Very Severe Cyclonic Storm
        ↓
Extremely Severe Cyclonic Storm
        ↓
Super Cyclonic Storm
```

---

## 3. Stratified Group K-Fold Cross-Validation

The forecasting pipeline uses **Stratified Group K-Fold Cross-Validation** to reduce data leakage.

### Grouping

Cyclone **track IDs** are used as groups.

This prevents observations belonging to the same cyclone track from being split between training and validation folds.

### Stratification

The folds are stratified according to wind/intensity categories to maintain a balanced distribution of storm categories.

This is particularly important for cyclone datasets because consecutive observations from the same storm are strongly correlated.

---

## 4. CLIPER Baseline

CycloneSense includes a CLIPER-style baseline as a benchmark for track displacement forecasting.

The baseline uses:

```text
50% Persistence
       +
50% Climatology
```

The baseline produces a single-step displacement forecast that can be used as a reference for evaluating the ML-based forecasting approach.

---

# 🛰️ Module 2: Infrared Satellite Intensity Estimation

Module 2 estimates cyclone **maximum sustained wind speed (Vmax)** directly from thermal infrared satellite imagery.

## ResNet18IR

The model used in this module is `ResNet18IR`, a modified version of the standard ResNet-18 architecture.

### Base Architecture

The model uses a pretrained ResNet-18 convolutional neural network as its feature-extraction backbone.

Standard ResNet-18 expects a three-channel RGB image:

```text
RGB → 3 channels
```

CycloneSense modifies the first convolutional layer to accept a single thermal infrared channel:

```text
Thermal IR → 1 channel
```

The pretrained three-channel convolution weights are converted to single-channel weights by averaging the original channel weights.

---

## Regression Head

The original ResNet-18 classification head is replaced with a custom regression head:

```text
ResNet-18 Feature Extractor
          ↓
Linear
512 → 128
          ↓
ReLU
          ↓
Dropout
p = 0.2
          ↓
Linear
128 → 1
          ↓
Predicted Vmax
```

The final layer has no activation function because the model performs continuous regression.

### Output

```text
Maximum Sustained Wind Speed (Vmax)
Unit: knots
```

Thus, the module transforms single-channel thermal infrared satellite imagery into a quantitative estimate of cyclone intensity.

---

# 🗺️ Module 3: Spatial Risk Assessment

Module 3 converts cyclone hazards, population exposure, and infrastructure vulnerability into a spatial risk representation.

## 5. Fuzzy-AHP

CycloneSense uses **Fuzzy Analytical Hierarchy Process (Fuzzy-AHP)** for multi-criteria decision analysis and risk weighting.

Four criteria are incorporated:

1. Wind hazard
2. Storm-surge hazard
3. Population exposure
4. Building vulnerability

Fuzzy-AHP generates normalized weights that are used to integrate hazard and vulnerability information.

---

## 6. Hazard × Vulnerability × Consequence Model

The spatial risk model operates on a:

```text
160 × 200
```

grid covering:

```text
Latitude:  8°N – 24°N
Longitude: 60°E – 100°E
```

### Spatial Factors

#### 🌬️ Wind Hazard

Wind hazard is modeled using an exponential decay relationship from the cyclone center.

```text
Cyclone Center
      ↓
Maximum Wind Hazard
      ↓
Hazard decreases with distance
```

#### 🌊 Surge Hazard

The model incorporates ocean/coastal exposure to represent potential storm-surge impacts.

#### 👥 Population Exposure

Population density is represented using a gamma-distributed model.

#### 🏢 Building Vulnerability

Building vulnerability is represented using a beta-distributed model.

### Risk Pipeline

```text
Wind Hazard
     +
Surge Hazard
     +
Population Exposure
     +
Building Vulnerability
     ↓
Fuzzy-AHP Weighting
     ↓
Spatial Risk Score
     ↓
Risk Map
```

---

# 💰 Module 4: Economic Loss Model

Module 4 estimates potential economic losses caused by cyclone wind exposure.

## Holland Wind Profile Model

The system uses the **Holland Wind Profile Model** to generate a spatial wind field.

The model uses atmospheric pressure and wind relationships to estimate wind speeds around the cyclone center.

```text
Cyclone Parameters
        ↓
Holland Wind Profile
        ↓
Spatial Wind Field
        ↓
Damage Calculation
```

---

## Sector-Based Loss Calculation

Economic losses are calculated separately for three major sectors:

### 🏠 Residential Buildings

Estimates potential damage to residential structures exposed to the modeled wind field.

### 🌾 Agricultural Crops

Estimates potential agricultural losses caused by cyclone wind exposure.

### 🏗️ Public Infrastructure

Estimates potential losses to public infrastructure exposed to the modeled hazard.

---

## Monte Carlo Uncertainty Analysis

Cyclone intensity is uncertain, so CycloneSense uses **100 Monte Carlo simulations** by sampling uncertainty in `Vmax`.

The simulations generate probabilistic loss estimates:

```text
P10 → Lower loss estimate
P50 → Median loss estimate
P90 → Upper loss estimate
```

This allows the system to communicate a range of potential economic outcomes instead of relying on a single deterministic estimate.

---

# 🚨 Module 5: Multilingual Alert System

Module 5 converts cyclone forecasts and predicted severity into structured emergency communication.

## 🌐 Supported Languages

CycloneSense supports seven languages:

| Language |
|---|
| 🇬🇧 English |
| 🇮🇳 Hindi |
| Bengali |
| Odia |
| Tamil |
| Telugu |
| Gujarati |

---

## Dynamic Severity Mapping

Alert severity is dynamically mapped using the predicted **hours to impact** and cyclone severity.

```text
Forecast Information
        ↓
Hours to Impact
        +
Predicted Intensity
        ↓
Severity Mapping
        ↓
Alert Generation
```

This allows alerts to reflect changing urgency as the cyclone approaches.

---

## 📱 Alert Formats

The generated alerts are designed for:

- SMS-style notifications
- Mobile application notifications

Alerts can also include uncertainty information so that forecast uncertainty is communicated instead of presenting predictions as exact outcomes.

---

# 🔄 Complete End-to-End Workflow

```text
                 CYCLONE DATA
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
   Historical Tracks       Satellite IR Data
          │                       │
          ▼                       ▼
 ┌─────────────────┐     ┌─────────────────┐
 │    MODULE 1     │     │    MODULE 2     │
 │ Track & Intensity│    │ IR Intensity    │
 │ Forecasting     │     │ ResNet18IR      │
 │                 │     │                 │
 │ GBR             │     │ Single-channel  │
 │ Random Forest   │     │ regression      │
 │ CLIPER          │     │                 │
 └────────┬────────┘     └────────┬────────┘
          │                       │
          └───────────┬───────────┘
                      ▼
             Cyclone Forecast
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
 ┌─────────────────┐     ┌─────────────────┐
 │    MODULE 3     │     │    MODULE 4     │
 │ Risk Assessment │     │ Economic Loss   │
 │                 │     │                 │
 │ Fuzzy-AHP       │     │ Holland Profile │
 │ Spatial Grid    │     │ Sector Loss     │
 │ Vulnerability   │     │ Monte Carlo     │
 └────────┬────────┘     └────────┬────────┘
          │                       │
          └───────────┬───────────┘
                      ▼
              Impact Assessment
                      │
                      ▼
              ┌───────────────┐
              │   MODULE 5   │
              │ Multilingual │
              │ Alerts       │
              └───────┬───────┘
                      │
                      ▼
             Emergency Communication
```

---

# 📊 Model Summary

| Module | Model / Method | Primary Output |
|---|---|---|
| Module 1 | Gradient Boosting Regressor | Track displacement, heading, wind, pressure |
| Module 1 | Random Forest Classifier | Cyclone intensity category |
| Module 1 | Stratified Group K-Fold | Leakage-resistant validation |
| Module 1 | CLIPER | Baseline displacement forecast |
| Module 2 | ResNet18IR | Vmax from IR imagery |
| Module 3 | Fuzzy-AHP | Risk weights |
| Module 3 | Hazard × Vulnerability × Consequence | Spatial risk |
| Module 4 | Holland Wind Profile | Spatial wind field |
| Module 4 | Sector-based loss model | Economic loss |
| Module 4 | Monte Carlo | P10 / P50 / P90 loss |
| Module 5 | Template-based generation | Multilingual alerts |

---

# 🗂️ Project Structure

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

---

# 📚 Data Sources

## IBTrACS

CycloneSense uses **IBTrACS (International Best Track Archive for Climate Stewardship)** for historical tropical cyclone track information.

IBTrACS provides historical best-track observations including variables such as cyclone position, intensity, and pressure.

Official source:

https://www.ncei.noaa.gov/products/international-best-track-archive

---

## TCIR Dataset

The infrared intensity module uses the **TCIR (Tropical Cyclone Infrared) dataset** for satellite-based intensity estimation.

The processing pipeline is designed around infrared satellite imagery and supports the ResNet18IR regression architecture.

---

# 🛠️ Technology Stack

## Machine Learning

- Python
- Scikit-learn
- PyTorch
- TensorFlow / Keras
- XGBoost
- NumPy
- Pandas

## Scientific & Geospatial Computing

- Xarray
- GeoPandas
- Rasterio
- h5py
- Matplotlib

## Backend

- FastAPI
- Uvicorn

## Frontend

- React
- Vite
- JavaScript / TypeScript

---

# ⚙️ Installation

## 1. Clone the Repository

```bash
git clone https://github.com/Manasveejain/CycloneSense.git
cd CycloneSense
```

## 2. Create a Virtual Environment

### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

### Linux / macOS

```bash
python3 -m venv venv
source venv/bin/activate
```

## 3. Install Dependencies

If the repository contains a `requirements.txt`:

```bash
pip install -r requirements.txt
```

For notebook/model development, the project uses packages including:

```bash
pip install numpy pandas matplotlib scikit-learn
pip install torch torchvision tensorflow
pip install xarray geopandas rasterio h5py xgboost joblib
```

---

# ▶️ Running the Application

## Backend

Navigate to the backend:

```bash
cd cyclone_app/backend
```

Start the FastAPI server:

```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend:

```text
http://localhost:8000
```

FastAPI documentation:

```text
http://localhost:8000/docs
```

---

## Frontend

Open another terminal:

```bash
cd cyclone_app/frontend
npm install
npm run dev
```

The frontend is typically available at:

```text
http://localhost:5173
```

---

# 🧪 Running the Notebooks

## Main Module

Open:

```text
Main_Module.ipynb
```

This notebook contains the primary cyclone forecasting and analysis workflow.

## Infrared Intensity Module

Open:

```text
02_module2_ir_intensity_.ipynb
```

This notebook contains the ResNet18IR-based infrared intensity estimation pipeline.

---

# 🎯 Project Objectives

CycloneSense aims to integrate multiple stages of cyclone disaster management into a single AI/ML workflow:

1. Forecast cyclone movement.
2. Forecast cyclone intensity and pressure.
3. Estimate cyclone intensity from satellite IR imagery.
4. Classify cyclone storm categories.
5. Assess spatial hazard and vulnerability.
6. Estimate potential sector-wise economic losses.
7. Quantify uncertainty in economic loss estimates.
8. Generate multilingual emergency alerts.
9. Provide decision-support information through a unified system.

---

# 🔮 Future Scope

Potential extensions include:

- Real-time satellite data ingestion
- Real-time cyclone tracking
- Integration with operational meteorological APIs
- Improved uncertainty quantification
- Flood and rainfall risk modeling
- Population evacuation planning
- Infrastructure-specific vulnerability models
- Real-time alert delivery
- Additional Indian regional languages
- Mobile application deployment
- Edge/offline deployment for low-connectivity regions
- Improved calibration against historical cyclone damage records

---

# ⚠️ Limitations & Disclaimer

CycloneSense is a research/prototype decision-support system.

Its predictions and risk estimates should **not replace official cyclone forecasts, warnings, or disaster-management instructions** issued by authorized meteorological and government agencies.

Model performance can depend on:

- Training-data quality
- Satellite-image quality
- Geographic coverage
- Historical cyclone representation
- Forecast lead time
- Input-data availability
- Model assumptions
- Uncertainty in cyclone intensity and environmental conditions

Economic loss estimates are model-generated estimates and should be validated against authoritative damage and exposure datasets before operational deployment.

---

# 📚 References

- **IBTrACS — International Best Track Archive for Climate Stewardship**  
  https://www.ncei.noaa.gov/products/international-best-track-archive

- **India Meteorological Department (IMD)**  
  https://mausam.imd.gov.in/

- **PyTorch**  
  https://pytorch.org/

- **Scikit-learn**  
  https://scikit-learn.org/

- **XGBoost**  
  https://xgboost.readthedocs.io/

---

# 👨‍💻 Author

**Manasvi Jain**

GitHub:  
https://github.com/Manasveejain

Project:  
https://github.com/Manasveejain/CycloneSense

---

# ⭐ Project Summary

**CycloneSense** brings together:

```text
Machine Learning
       +
Satellite Image Analysis
       +
Time-Series Forecasting
       +
Geospatial Risk Modeling
       +
Economic Impact Modeling
       +
Uncertainty Quantification
       +
Multilingual Emergency Communication
```

into a single end-to-end cyclone decision-support framework.

The central objective is to move beyond **"Where will the cyclone go?"** toward a broader question:

> **"What could the cyclone affect, what could the potential impact be, and how can that information be communicated in time?"**

---

# 📄 License

Add the project's intended open-source license here if a license is included in the repository.
