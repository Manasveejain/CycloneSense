"""
Inference service for ML predictions
"""
from typing import Any

import numpy as np
import pandas as pd


class InferenceService:
    """Service for running ML model inference"""

    def predict(self, model: Any, features: list[Any] | dict[str, Any]) -> tuple[Any, Any | None]:
        """
        Run prediction on a model

        Args:
            model: Trained ML model
            features: Feature vector, list of vectors, or feature dictionary

        Returns:
            Tuple of (prediction, probabilities)
        """
        # Convert features to appropriate format
        x = self._prepare_features(features)

        # Run prediction
        prediction = model.predict(x)

        # Get probabilities if available
        probabilities = None
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(x)

        # Convert to JSON-serializable format
        return self._to_jsonable(prediction), self._to_jsonable(probabilities)

    def _prepare_features(self, features: list[Any] | dict[str, Any]) -> np.ndarray | pd.DataFrame:
        """Convert features to model input format"""
        if isinstance(features, dict):
            return pd.DataFrame([features])

        if features and isinstance(features[0], dict):
            return pd.DataFrame(features)

        array = np.asarray(features)
        if array.ndim == 1:
            array = array.reshape(1, -1)

        return array

    def _to_jsonable(self, value: Any) -> Any:
        """Convert value to JSON-serializable format"""
        if value is None:
            return None

        if isinstance(value, pd.DataFrame):
            return value.to_dict(orient="records")

        if isinstance(value, np.ndarray):
            return value.tolist()

        if hasattr(value, "tolist"):
            return value.tolist()

        return value
