"""
model_loader.py
Loads all trained models once and exposes them as lazy singletons.
Resolves paths relative to this file so the server can be started from any CWD.
"""

import pathlib
import numpy as np

# ── Resolve paths ──────────────────────────────────────────────────────────────
BASE_DIR = pathlib.Path(__file__).parent          # …/cyclone_app/backend
ROOT_DIR = BASE_DIR.parent.parent                 # …/MY Model  (where .h5/.json files live)

TRACK_MODEL_PATH     = ROOT_DIR / "track_prediction_lstm_model.h5"
INTENSITY_MODEL_PATH = ROOT_DIR / "intensity_estimation_cnn_model.h5"
DAMAGE_MODEL_PATH    = ROOT_DIR / "damage_estimation_xgb_model.json"
TCIR_PATH            = ROOT_DIR / "TCIR-CPAC_IO_SH.h5"

# ── Lazy singletons ────────────────────────────────────────────────────────────
_track_model     = None
_intensity_model = None
_damage_model    = None
_tcir_data       = None
_imd_data        = None


def _keras_load(path):
    """Load a Keras .h5 model; tries tf_keras → keras → tf.keras in order."""
    try:
        import tf_keras
        return tf_keras.models.load_model(str(path))
    except ImportError:
        pass
    try:
        import keras
        return keras.models.load_model(str(path))
    except Exception:
        pass
    import tensorflow as tf
    return tf.keras.models.load_model(str(path))


def get_track_model():
    global _track_model
    if _track_model is None:
        print(f"[loader] Loading LSTM track model from {TRACK_MODEL_PATH}")
        _track_model = _keras_load(TRACK_MODEL_PATH)
    return _track_model


def get_intensity_model():
    global _intensity_model
    if _intensity_model is None:
        print(f"[loader] Loading CNN intensity model from {INTENSITY_MODEL_PATH}")
        _intensity_model = _keras_load(INTENSITY_MODEL_PATH)
    return _intensity_model


def get_damage_model():
    global _damage_model
    if _damage_model is None:
        import xgboost as xgb
        print(f"[loader] Loading XGBoost damage model from {DAMAGE_MODEL_PATH}")
        booster = xgb.Booster()
        booster.load_model(str(DAMAGE_MODEL_PATH))
        _damage_model = booster
    return _damage_model


def get_tcir_data():
    """
    Load TCIR HDF5 file (TCIR-CPAC_IO_SH.h5).
    Returns dict: {"images": ndarray (N,H,W,C), "winds": ndarray (N,), "keys": list}
    """
    global _tcir_data
    if _tcir_data is None:
        import h5py
        print(f"[loader] Loading TCIR data from {TCIR_PATH}")
        with h5py.File(str(TCIR_PATH), "r") as f:
            keys = list(f.keys())
            print(f"[loader] TCIR top-level keys: {keys}")

            img_key  = next((k for k in keys if any(x in k.lower() for x in ("ir", "image", "data"))), keys[0])
            wind_key = next((k for k in keys if any(x in k.lower() for x in ("wind", "vmax", "speed"))), None)

            images = np.array(f[img_key])
            winds  = np.array(f[wind_key]) if wind_key else np.zeros(images.shape[0])

        _tcir_data = {"images": images, "winds": winds, "keys": keys, "count": len(images)}
        print(f"[loader] TCIR loaded – {len(images)} samples, shape {images.shape}")
    return _tcir_data


def get_tcir_sample_count() -> int:
    """Return number of TCIR samples without loading the full array."""
    return get_tcir_data()["count"]


def get_imd_data():
    """Load IMD best-track data via imdtrack. Returns {"storms": list, "observations": DataFrame}."""
    global _imd_data
    if _imd_data is None:
        try:
            import imdtrack as imd
            print("[loader] Loading IMD best-track data…")
            bt = imd.load()
            _imd_data = {"storms": bt.storms, "observations": bt.observations}
            print(f"[loader] IMD loaded – {len(bt.storms)} storms")
        except Exception as exc:
            print(f"[loader] imdtrack unavailable ({exc}). Using empty fallback.")
            import pandas as pd
            _imd_data = {"storms": [], "observations": pd.DataFrame()}
    return _imd_data
