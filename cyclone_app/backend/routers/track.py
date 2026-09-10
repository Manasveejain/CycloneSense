"""
routers/track.py
POST /predict/track  – LSTM-based next-position prediction
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List
import numpy as np

from model_loader import get_track_model
from utils.preprocessing import build_track_input, denorm_track

router = APIRouter(prefix="/predict", tags=["Track Prediction"])


class Observation(BaseModel):
    lat:          float = Field(..., ge=-90,  le=90,   description="Latitude in degrees")
    lon:          float = Field(..., ge=-180, le=180,  description="Longitude in degrees")
    wind_kt:      float = Field(..., ge=0,   le=200,  description="Max sustained wind in knots")
    pressure_hpa: float = Field(..., ge=870, le=1020, description="Central pressure in hPa")


class TrackRequest(BaseModel):
    observations: List[Observation] = Field(
        ..., min_length=1, max_length=8,
        description="Past observations (1–8 records, 3-hourly). Oldest first."
    )
    steps: int = Field(default=1, ge=1, le=5, description="How many future steps to predict")


class TrackStep(BaseModel):
    step:          int
    predicted_lat: float
    predicted_lon: float


class TrackResponse(BaseModel):
    status:     str
    storm_path: List[TrackStep]


@router.post("/track", response_model=TrackResponse)
def predict_track(req: TrackRequest):
    try:
        model = get_track_model()
        obs   = [o.model_dump() for o in req.observations]
        path  = []

        for step in range(1, req.steps + 1):
            X   = build_track_input(obs)
            out = model.predict(X, verbose=0)
            nxt = denorm_track(out)
            path.append(TrackStep(step=step, **nxt))

            # Feed predicted position back for multi-step
            obs.append({
                "lat":          nxt["predicted_lat"],
                "lon":          nxt["predicted_lon"],
                "wind_kt":      obs[-1]["wind_kt"],
                "pressure_hpa": obs[-1]["pressure_hpa"],
            })

        return TrackResponse(status="success", storm_path=path)

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
