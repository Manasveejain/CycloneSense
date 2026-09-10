"""
main.py – Cyclone Prediction System – FastAPI entry point
Run (from the backend directory, with venv active):
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from routers import track, intensity, damage, path, alerts, satellite


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 60)
    print("  Cyclone Prediction System – starting up")
    print("  Models load lazily on first request.")
    print("=" * 60)
    yield
    print("  Shutting down.")


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Cyclone Prediction System API",
    description=(
        "Full-stack cyclone prediction backend.\n\n"
        "**Modules**\n"
        "- **Track Prediction** – LSTM next-position forecast\n"
        "- **Intensity Estimation** – CNN from TCIR / live satellite imagery\n"
        "- **Damage Estimation** – XGBoost per-district damage & risk zones\n"
        "- **Path / IMD Data** – Historical best-track records\n"
        "- **Alert Dispatch** – CAP-format emergency alerts\n"
        "- **Satellite Imagery** – NASA EONET events + GIBS / GOES real-time tiles\n"
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# Allow the React dev server (port 5173) and any localhost origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────

app.include_router(track.router)
app.include_router(intensity.router)
app.include_router(damage.router)
app.include_router(path.router)
app.include_router(alerts.router)
app.include_router(satellite.router)   # NEW – satellite imagery


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "status":  "ok",
        "service": "Cyclone Prediction System API v2.0",
        "docs":    "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}
