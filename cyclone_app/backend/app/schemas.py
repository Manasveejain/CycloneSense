from typing import Any

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    models: list[str]


class PredictRequest(BaseModel):
    model: str = Field(..., description="Filename stem of the .joblib / .pkl file, e.g. credit_risk")
    features: list[Any] | dict[str, Any] = Field(
        ...,
        description="A feature vector, a list of vectors, or a feature map Spring Boot can serialize as JSON",
    )


class PredictResponse(BaseModel):
    model: str
    prediction: Any
    probabilities: Any | None = None
