"""
Health check endpoints
"""
from fastapi import APIRouter

from app.core.registry import model_registry
from app.models.response import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """
    Check API health and list loaded models
    """
    models = model_registry.names()
    return HealthResponse(
        status="ok" if models else "no_models",
        models_loaded=len(models),
        models=models
    )


@router.get("/models", response_model=list[str])
def list_models() -> list[str]:
    """
    List all available models
    """
    return model_registry.names()
