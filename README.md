# 🌪️ CycloneSense

**AI-Powered Cyclone Track Forecasting, Intensity Estimation, Risk Assessment & Emergency Alerts**

CycloneSense is an end-to-end ML-based cyclone decision-support system combining track forecasting, intensity estimation, spatial risk assessment, economic loss modeling, and multilingual emergency alerts.

---

## 📁 Project Structure

```
CycloneSense/
├── frontend/           # React + Vite Frontend
├── backend/            # Dual Backend Architecture
│   ├── fastapi/       # Python FastAPI (ML Inference)
│   └── spring/        # Java Spring Boot (Business Logic)
└── ml-models/          # ML Models & Training
    ├── models/        # Trained model files (.joblib)
    └── notebooks/     # Jupyter notebooks
```

### Clean 3-Folder Architecture

1. **frontend/** - User interface (React, Vite, Tailwind, Leaflet)
2. **backend/** - API servers (FastAPI for ML + Spring Boot for business logic)
3. **ml-models/** - All ML assets (models, notebooks, training data)

---

## 🚀 Quick Start

### 1. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

### 2. FastAPI Backend (ML Inference)

```bash
cd backend/fastapi
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

FastAPI runs on: `http://localhost:8000`  
API Docs: `http://localhost:8000/docs`

### 3. Spring Boot Backend (Business Logic)

```bash
cd backend/spring
./mvnw spring-boot:run
```

Spring Boot runs on: `http://localhost:8080`

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│   FRONTEND (React + Vite)           │
│   Port: 5173                        │
└──────────┬──────────────────────────┘
           │
    ┌──────┴───────┐
    │              │
    ▼              ▼
┌─────────┐   ┌──────────────┐
│ Spring  │◄──│   FastAPI    │
│  8080   │   │    8000      │
│Business │   │ ML Inference │
└─────────┘   └──────┬───────┘
                     │
              ┌──────▼───────┐
              │  ML MODELS   │
              │  (.joblib)   │
              └──────────────┘
```

### Why Two Backends?

- **FastAPI (Python)**: Handles ML model inference (scikit-learn, PyTorch, joblib)
- **Spring Boot (Java)**: Handles business logic, database, authentication, enterprise features

---

## 🧠 ML Modules

### Module 1: Track & Intensity Forecasting
- **Models**: Gradient Boosting Regressor, Random Forest, CLIPER
- **Output**: Multi-step track displacement, wind speed, pressure forecasts

### Module 2: IR Intensity Estimation
- **Model**: ResNet18IR (CNN for thermal infrared)
- **Output**: Maximum sustained wind speed from satellite imagery

### Module 3: Spatial Risk Assessment
- **Model**: Fuzzy-AHP + Spatial modeling
- **Output**: Risk maps, vulnerability assessment

### Module 4: Economic Loss Estimation
- **Model**: Holland Wind Profile + Monte Carlo simulation
- **Output**: P10/P50/P90 loss estimates by sector

### Module 5: Multilingual Alerts
- **Model**: Template-based generation
- **Output**: Emergency alerts in 7 Indian languages

---

## 📊 Tech Stack

### Frontend
- React 18.3
- Vite (build tool)
- Tailwind CSS
- Leaflet (maps)
- Axios

### Backend - FastAPI
- FastAPI 0.118
- Uvicorn (ASGI server)
- Scikit-learn 1.7
- NumPy, Pandas
- Joblib

### Backend - Spring Boot
- Java Spring Boot
- Maven
- JPA/Hibernate

### ML/Data Science
- Scikit-learn
- PyTorch
- XGBoost
- Pandas, NumPy
- Xarray, NetCDF4

---

## 🔧 Development

### Frontend Development

```bash
cd frontend
npm run dev     # Start dev server with HMR
npm run build   # Production build
npm run preview # Preview production build
```

### FastAPI Development

```bash
cd backend/fastapi
# Auto-reload on code changes
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Spring Boot Development

```bash
cd backend/spring
./mvnw spring-boot:run
# Or with Maven wrapper
./mvnw clean install
```

### Training ML Models

```bash
cd ml-models/notebooks
jupyter lab
# Open and run training notebooks
```

---

## 📦 Model Files

Place trained model files in `ml-models/models/`:

```
ml-models/models/
├── module1_state.joblib     # Track forecasting
├── module2_state.joblib     # IR intensity
├── module3_state.joblib     # Risk assessment
├── module4_state.joblib     # Economic loss
└── module5_alerts.joblib    # Alert generation
```

Models are automatically loaded by FastAPI on startup.

---

## 🌐 API Endpoints

### FastAPI (ML Inference)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check & loaded models |
| `/models` | GET | List available models |
| `/api/v1/predict` | POST | Single prediction |
| `/api/v1/batch-predict` | POST | Batch predictions |

### Example Request

```bash
curl -X POST "http://localhost:8000/api/v1/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "module1_state",
    "features": [34.5, 76.2, 1005, 45, 12.5]
  }'
```

---

## 📚 Data Sources

- **IBTrACS**: Historical cyclone track data  
  https://www.ncei.noaa.gov/products/international-best-track-archive

- **TCIR Dataset**: Tropical cyclone infrared satellite imagery

---

## 🐳 Docker (Optional)

```bash
# Coming soon: docker-compose.yml
docker-compose up --build
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## ⚠️ Disclaimer

CycloneSense is a research/prototype system. Predictions should **not replace official cyclone forecasts** from meteorological agencies.

---

## 📄 License

[Add license information]

---

## 👨‍💻 Author

**Manasvee Jain**

GitHub: https://github.com/Manasveejain/CycloneSense

---

## 🎯 Key Features

✅ Multi-step cyclone track forecasting  
✅ Satellite-based intensity estimation  
✅ ML-powered risk assessment  
✅ Economic loss modeling with uncertainty  
✅ Multilingual emergency alerts (7 languages)  
✅ Clean 3-folder architecture  
✅ Dual backend (FastAPI + Spring Boot)  
✅ Modern React frontend with interactive maps  
✅ RESTful API design  
✅ Auto-loading ML models  

---

**Built with ❤️ for cyclone disaster management**
