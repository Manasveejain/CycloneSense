"""
utils/preprocessing.py
Shared preprocessing helpers used by multiple routers.
"""

import numpy as np


# ── Track (LSTM) ───────────────────────────────────────────────────────────────

TRACK_TIMESTEPS = 8
TRACK_NORM      = np.array([90.0, 180.0, 200.0, 1020.0], dtype=np.float32)


def build_track_input(observations: list[dict]) -> np.ndarray:
    """
    Convert a list of up to 8 observation dicts into the LSTM input shape (1, 8, 4).
    Features: [lat, lon, wind_kt, pressure_hpa].  Pads front with zeros if < 8 rows.
    Normalises to [0,1] using approximate global ranges.
    """
    arr = np.array(
        [[o["lat"], o["lon"], o["wind_kt"], o["pressure_hpa"]] for o in observations],
        dtype=np.float32,
    )
    if len(arr) < TRACK_TIMESTEPS:
        pad = np.zeros((TRACK_TIMESTEPS - len(arr), 4), dtype=np.float32)
        arr = np.vstack([pad, arr])
    else:
        arr = arr[-TRACK_TIMESTEPS:]
    arr = np.clip(arr / TRACK_NORM, 0.0, 1.0)
    return arr[np.newaxis, ...]   # (1, 8, 4)


def denorm_track(pred: np.ndarray) -> dict:
    """Denormalise LSTM output [norm_lat, norm_lon] → real lat/lon."""
    return {
        "predicted_lat": round(float(pred[0, 0]) * 90.0,  4),
        "predicted_lon": round(float(pred[0, 1]) * 180.0, 4),
    }


# ── Intensity (CNN / TCIR) ─────────────────────────────────────────────────────

CNN_IMG_SIZE = 64


def prepare_tcir_sample(sample_index: int, tcir_data: dict) -> np.ndarray:
    """
    Pull one image from the TCIR cache, reshape to (1, 64, 64, 4) for the CNN.
    """
    images = tcir_data["images"]
    img    = images[sample_index % len(images)]   # (H, W) or (H, W, C)

    # ── resize to 64×64 if needed ──
    if img.shape[0] != CNN_IMG_SIZE or img.shape[1] != CNN_IMG_SIZE:
        from PIL import Image as PILImage
        src = img[:, :, 0] if img.ndim == 3 else img
        pil = PILImage.fromarray(src.astype(np.float32)).resize(
            (CNN_IMG_SIZE, CNN_IMG_SIZE), PILImage.BILINEAR
        )
        img = np.array(pil)

    # ── ensure exactly 4 channels ──
    if img.ndim == 2:
        img = np.stack([img] * 4, axis=-1)
    elif img.shape[-1] < 4:
        extra = np.zeros((*img.shape[:2], 4 - img.shape[-1]), dtype=np.float32)
        img   = np.concatenate([img, extra], axis=-1)
    elif img.shape[-1] > 4:
        img   = img[:, :, :4]

    img = img.astype(np.float32)
    mn, mx = img.min(), img.max()
    if mx > mn:
        img = (img - mn) / (mx - mn)
    return img[np.newaxis, ...]    # (1, 64, 64, 4)


def prepare_uploaded_image(raw_bytes: bytes) -> np.ndarray:
    """
    Convert an uploaded satellite image (any common format) to the (1,64,64,4)
    float32 tensor expected by the CNN.
    """
    import io
    from PIL import Image as PILImage

    pil = PILImage.open(io.BytesIO(raw_bytes)).convert("RGBA")
    pil = pil.resize((CNN_IMG_SIZE, CNN_IMG_SIZE), PILImage.BILINEAR)
    img = np.array(pil, dtype=np.float32)[:, :, :4]   # (64, 64, 4)

    mn, mx = img.min(), img.max()
    if mx > mn:
        img = (img - mn) / (mx - mn)
    return img[np.newaxis, ...]    # (1, 64, 64, 4)


def prepare_nasa_image(raw_bytes: bytes) -> np.ndarray:
    """
    Fetch a NASA Worldview / GOES PNG (RGB) and map it to (1,64,64,4).
    The 4th channel is synthesised as 0.5 (neutral PMW placeholder).
    """
    import io
    from PIL import Image as PILImage

    pil = PILImage.open(io.BytesIO(raw_bytes)).convert("RGB")
    pil = pil.resize((CNN_IMG_SIZE, CNN_IMG_SIZE), PILImage.BILINEAR)
    rgb = np.array(pil, dtype=np.float32) / 255.0           # (64, 64, 3)
    pmw = np.full((CNN_IMG_SIZE, CNN_IMG_SIZE, 1), 0.5, dtype=np.float32)
    img = np.concatenate([rgb, pmw], axis=-1)                # (64, 64, 4)
    return img[np.newaxis, ...]


# ── Damage (XGBoost) ──────────────────────────────────────────────────────────

def classify_risk_zone(wind_kt: float, dist_km: float, vuln: float) -> str:
    score = wind_kt * 0.5 - dist_km * 0.3 + vuln * 0.2
    if score > 60:
        return "Red"
    elif score > 30:
        return "Orange"
    return "Yellow"


def build_damage_dmatrix(wind_kt: float, dist_km: float, vuln: float):
    import xgboost as xgb
    X = np.array([[wind_kt, dist_km, vuln]], dtype=np.float32)
    return xgb.DMatrix(
        X,
        feature_names=["Predicted_Wind_kt", "Distance_to_Path_km", "Vulnerability_Index"],
    )
