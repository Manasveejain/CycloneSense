from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.loader import registry, run_predict
from app.schemas import HealthResponse, PredictRequest, PredictResponse


@asynccontextmanager
async def lifespan(_: FastAPI):
    registry.load()
    yield


app = FastAPI(
    title=settings.app_name,
    description="Loads joblib models and serves predictions over HTTP for Java Spring Boot.",
    lifespan=lifespan,
)

origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", models=registry.names())


@app.get("/models", response_model=list[str])
def list_models() -> list[str]:
    return registry.names()


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest) -> PredictResponse:
    try:
        model = registry.get(body.model)
    except KeyError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown model '{body.model}'. Loaded: {registry.names()}",
        ) from exc

    try:
        prediction, probabilities = run_predict(model, body.features)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Inference failed: {exc}") from exc

    return PredictResponse(model=body.model, prediction=prediction, probabilities=probabilities)
