"""
routers/intensity.py
POST /predict/intensity         – CNN wind-speed estimation from TCIR / satellite imagery
POST /predict/intensity/upload  – Upload a satellite image file directly
GET  /predict/intensity/tcir-info – Metadata about loaded TCIR dataset
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, List
import numpy as np

from model_loader import get_intensity_model, get_tcir_data, get_tcir_sample_count
from utils.preprocessing import prepare_tcir_sample, prepare_uploaded_image

router = APIRouter(prefix="/predict", tags=["Intensity Estimation"])


# ── Category helpers ────────────────────────────────────────────────────────────

def _wind_to_category(wind_kt: float) -> tuple[str, str]:
    """Map max sustained wind speed to IMD category and Saffir-Simpson equivalent."""
    if wind_kt < 34:
        return "Tropical Depression",                   "TD"
    elif wind_kt < 48:
        return "Tropical Storm",                        "TS"
    elif wind_kt < 64:
        return "Severe Cyclonic Storm",                 "SCS"
    elif wind_kt < 90:
        return "Very Severe Cyclonic Storm (Cat 1-2)",  "SS1-2"
    elif wind_kt < 120:
        return "Extremely Severe (Cat 3)",              "SS3"
    elif wind_kt < 150:
        return "Super Cyclonic Storm (Cat 4)",          "SS4"
    else:
        return "Super Cyclonic Storm (Cat 5)",          "SS5"


# ── Schemas ─────────────────────────────────────────────────────────────────────

class IntensityRequest(BaseModel):
    tcir_sample_index: Optional[int] = Field(
        default=None,
        description="Index into the loaded TCIR HDF5 file (0-based). Use for demo/testing.",
    )
    image_flat: Optional[List[float]] = Field(
        default=None,
        description=(
            "Flat array of 64×64×4 = 16 384 floats (row-major, normalised 0–1). "
            "Use the /satellite/intensity-input or /satellite/storm-image endpoints "
            "to generate this from a real satellite tile."
        ),
    )


class IntensityResponse(BaseModel):
    status:               str
    estimated_wind_kt:    float
    intensity_category:   str
    saffir_simpson_scale: str
    wind_kmh:             float
    wind_ms:              float
    source:               str    # "tcir_dataset" | "uploaded_image" | "satellite_tile"


# ── Endpoints ────────────────────────────────────────────────────────────────────

@router.post("/intensity", response_model=IntensityResponse)
def predict_intensity(req: IntensityRequest):
    """
    Estimate cyclone intensity from a satellite image.

    Priority:
      1. image_flat  – 16 384-float array from a live satellite tile
      2. tcir_sample_index – sample from the TCIR archive dataset
    If neither is supplied, defaults to TCIR index 0.
    """
    try:
        model  = get_intensity_model()
        source = "tcir_dataset"

        if req.image_flat is not None:
            arr = np.array(req.image_flat, dtype=np.float32)
            if arr.size != 64 * 64 * 4:
                raise HTTPException(
                    status_code=422,
                    detail=f"image_flat must have 16 384 elements, got {arr.size}.",
                )
            X      = arr.reshape(1, 64, 64, 4)
            source = "satellite_tile"
        else:
            idx   = req.tcir_sample_index if req.tcir_sample_index is not None else 0
            tcir  = get_tcir_data()
            X     = prepare_tcir_sample(idx, tcir)
            source = "tcir_dataset"

        pred    = model.predict(X, verbose=0)
        wind_kt = float(np.clip(pred[0, 0], 0, 200))
        cat, ss = _wind_to_category(wind_kt)

        return IntensityResponse(
            status               = "success",
            estimated_wind_kt    = round(wind_kt, 2),
            intensity_category   = cat,
            saffir_simpson_scale = ss,
            wind_kmh             = round(wind_kt * 1.852, 2),
            wind_ms              = round(wind_kt * 0.5144, 2),
            source               = source,
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/intensity/upload", response_model=IntensityResponse)
async def predict_intensity_upload(file: UploadFile = File(...)):
    """
    Upload a satellite image file (PNG/JPEG/TIFF) and get intensity estimation.
    The image is resized to 64×64 and converted to a 4-channel tensor internally.
    """
    try:
        raw_bytes = await file.read()
        if not raw_bytes:
            raise HTTPException(status_code=422, detail="Uploaded file is empty.")

        model  = get_intensity_model()
        X      = prepare_uploaded_image(raw_bytes)
        pred   = model.predict(X, verbose=0)
        wind_kt = float(np.clip(pred[0, 0], 0, 200))
        cat, ss = _wind_to_category(wind_kt)

        return IntensityResponse(
            status               = "success",
            estimated_wind_kt    = round(wind_kt, 2),
            intensity_category   = cat,
            saffir_simpson_scale = ss,
            wind_kmh             = round(wind_kt * 1.852, 2),
            wind_ms              = round(wind_kt * 0.5144, 2),
            source               = "uploaded_image",
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/intensity/tcir-info")
def tcir_info():
    """Return metadata about the loaded TCIR satellite dataset."""
    try:
        tcir = get_tcir_data()
        return {
            "status":        "success",
            "sample_count":  tcir["count"],
            "image_shape":   list(tcir["images"].shape),
            "wind_range_kt": [float(tcir["winds"].min()), float(tcir["winds"].max())],
            "dataset_keys":  tcir["keys"],
            "file":          "TCIR-CPAC_IO_SH.h5",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
