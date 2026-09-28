"""
Model Registry - Loads and manages ML models
"""
from pathlib import Path
from typing import Any

import joblib

from app.core.config import settings


class ModelRegistry:
    """Registry for loading and accessing ML models"""

    def __init__(self, models_dir: Path) -> None:
        self.models_dir = models_dir
        self._models: dict[str, Any] = {}

    def load(self) -> None:
        """Load all .joblib and .pkl files from models directory"""
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self._models.clear()

        for path in sorted(self.models_dir.iterdir()):
            if path.suffix.lower() in {".joblib", ".pkl"} and path.is_file():
                try:
                    self._models[path.stem] = joblib.load(path)
                    print(f"  ✓ Loaded: {path.stem}")
                except Exception as e:
                    print(f"  ✗ Failed to load {path.stem}: {e}")

    def names(self) -> list[str]:
        """Get list of loaded model names"""
        return sorted(self._models.keys())

    def get(self, name: str) -> Any:
        """Get model by name"""
        if name not in self._models:
            raise KeyError(f"Model '{name}' not found. Available: {self.names()}")
        return self._models[name]

    def has(self, name: str) -> bool:
        """Check if model exists"""
        return name in self._models


# Global registry instance
model_registry = ModelRegistry(settings.models_dir)
