"""
Response models
"""
from typing import Any
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    models_loaded: int
    models: list[str]


class PredictResponse(BaseModel):
    """Prediction response"""
    model: str
    prediction: Any
    probabilities: Any | None = None
    metadata: dict[str, Any] | None = None


class ForecastResponse(BaseModel):
    """Forecast response"""
    model: str
    steps: int
    predictions: list[Any]
    timestamps: list[str] | None = None


class ErrorResponse(BaseModel):
    """Error response"""
    error: str
    detail: str | None = None
