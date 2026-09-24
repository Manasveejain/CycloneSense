from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "joblib-inference-api"
    host: str = "0.0.0.0"
    port: int = 8000
    models_dir: Path = Path(__file__).resolve().parent.parent / "models"
    cors_origins: str = "*"


settings = Settings()
