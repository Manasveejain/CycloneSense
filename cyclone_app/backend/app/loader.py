from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from app.config import settings


class ModelRegistry:
    def __init__(self, models_dir: Path) -> None:
        self.models_dir = models_dir
        self._models: dict[str, Any] = {}

    def load(self) -> None:
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self._models.clear()
        for path in sorted(self.models_dir.iterdir()):
            if path.suffix.lower() in {".joblib", ".pkl"} and path.is_file():
                self._models[path.stem] = joblib.load(path)

    def names(self) -> list[str]:
        return sorted(self._models)

    def get(self, name: str) -> Any:
        if name not in self._models:
            raise KeyError(name)
        return self._models[name]


registry = ModelRegistry(settings.models_dir)


def features_to_array(features: list[Any] | dict[str, Any]) -> np.ndarray | pd.DataFrame:
    if isinstance(features, dict):
        return pd.DataFrame([features])
    if features and isinstance(features[0], dict):
        return pd.DataFrame(features)
    array = np.asarray(features)
    if array.ndim == 1:
        array = array.reshape(1, -1)
    return array


def run_predict(model: Any, features: list[Any] | dict[str, Any]) -> tuple[Any, Any | None]:
    x = features_to_array(features)
    prediction = model.predict(x)
    probabilities = None
    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(x)
    return _to_jsonable(prediction), _to_jsonable(probabilities)


def _to_jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, pd.DataFrame):
        return value.to_dict(orient="records")
    if isinstance(value, np.ndarray):
        return value.tolist()
    if hasattr(value, "tolist"):
        return value.tolist()
    return value
