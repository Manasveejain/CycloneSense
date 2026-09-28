"""
Prediction endpoints
"""
from fastapi import APIRouter, HTTPException

from app.core.registry import model_registry
from app.models.request import PredictRequest
from app.models.response import PredictResponse
from app.services.inference_service import InferenceService

router = APIRouter()
inference_service = InferenceService()


@router.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest) -> PredictResponse:
    """
    Make a prediction using a trained model

    - **model**: Name of the model to use (e.g., 'module1_state')
    - **features**: Feature vector or dictionary with feature values
    """
    # Check if model exists
    if not model_registry.has(request.model):
        raise HTTPException(
            status_code=404,
            detail=f"Model '{request.model}' not found. Available: {model_registry.names()}"
        )

    # Get model
    try:
        model = model_registry.get(request.model)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Run inference
    try:
        prediction, probabilities = inference_service.predict(model, request.features)
        return PredictResponse(
            model=request.model,
            prediction=prediction,
            probabilities=probabilities,
            metadata={"features_shape": str(getattr(request.features, "shape", len(request.features)))}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Inference failed: {str(e)}"
        )


@router.post("/batch-predict")
def batch_predict(requests: list[PredictRequest]) -> list[PredictResponse]:
    """
    Make predictions for multiple requests
    """
    results = []
    for req in requests:
        try:
            model = model_registry.get(req.model)
            prediction, probabilities = inference_service.predict(model, req.features)
            results.append(PredictResponse(
                model=req.model,
                prediction=prediction,
                probabilities=probabilities
            ))
        except Exception as e:
            results.append(PredictResponse(
                model=req.model,
                prediction=None,
                probabilities=None,
                metadata={"error": str(e)}
            ))
    return results
