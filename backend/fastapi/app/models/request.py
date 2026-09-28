"""
Request models
"""
from typing import Any
from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    """Prediction request"""
    model: str = Field(..., description="Model name (e.g., 'module1_state')")
    features: list[Any] | dict[str, Any] = Field(
        ...,
        description="Feature vector or dictionary",
        examples=[
            [34.5, 76.2, 1005, 45, 12.5],
            {"lat": 34.5, "lon": 76.2, "pressure": 1005}
        ]
    )


class ForecastRequest(BaseModel):
    """Multi-step forecast request"""
    model: str = Field(..., description="Model name")
    features: list[Any] | dict[str, Any]
    steps: int = Field(5, ge=1, le=30, description="Number of forecast steps")


class RiskAssessmentRequest(BaseModel):
    """Risk assessment request"""
    cyclone_center: tuple[float, float] = Field(..., description="(lat, lon) of cyclone center")
    max_wind_speed: float = Field(..., description="Maximum sustained wind speed (knots)")
    forecast_hours: int = Field(..., description="Forecast time horizon")
