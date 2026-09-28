"""
Application configuration
"""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings"""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Application
    app_name: str = "CycloneSense ML API"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8001

    # Model paths
    models_dir: Path = Path(__file__).resolve().parent.parent.parent.parent.parent / "ml-models" / "models"

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080"

    # Logging
    log_level: str = "INFO"


settings = Settings()
