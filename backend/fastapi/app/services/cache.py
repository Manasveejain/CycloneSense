"""
Async Redis Caching Layer
==========================
Provides a unified cache interface for expensive geospatial computations:
  • Fuzzy-AHP multi-criteria risk weights
  • Monte Carlo damage loss simulations
  • Module inference results

Architecture:
  - Primary backend: Redis (aioredis/redis-py async)
  - Graceful fallback: in-process LRU dict when Redis is unavailable
  - All cache keys are namespaced under "cyclonesense:"
  - TTLs are configurable per computation type

Usage:
    from app.services.cache import cache, cached_computation

    @cached_computation("fuzzy_ahp", ttl=3600)
    async def compute_fuzzy_ahp(districts, wind_kt):
        ...  # expensive calculation
        return result
"""

from __future__ import annotations

import asyncio
import functools
import hashlib
import json
import logging
import math
import os
import random
import time
from collections import OrderedDict
from typing import Any, Callable

logger = logging.getLogger("cyclonesense.cache")

REDIS_URL    = os.getenv("REDIS_URL",    "redis://localhost:6379/0")
CACHE_PREFIX = os.getenv("CACHE_PREFIX", "cyclonesense:")
LRU_MAX_SIZE = int(os.getenv("LRU_MAX_SIZE", "256"))

# Default TTLs (seconds)
TTL_FUZZY_AHP   = int(os.getenv("TTL_FUZZY_AHP",   "3600"))   # 1 hour
TTL_MONTE_CARLO = int(os.getenv("TTL_MONTE_CARLO",  "1800"))   # 30 min
TTL_INFERENCE   = int(os.getenv("TTL_INFERENCE",    "900"))    # 15 min
TTL_INGESTION   = int(os.getenv("TTL_INGESTION",    "900"))    # 15 min


# ---------------------------------------------------------------------------
# In-process LRU fallback cache
# ---------------------------------------------------------------------------

class LRUCache:
    """Simple thread-safe LRU dict with per-entry TTL."""

    def __init__(self, max_size: int = 256) -> None:
        self._store: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._max = max_size
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            if key not in self._store:
                return None
            value, expires_at = self._store[key]
            if expires_at and time.monotonic() > expires_at:
                del self._store[key]
                return None
            self._store.move_to_end(key)
            return value

    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        async with self._lock:
            expires_at = time.monotonic() + ttl if ttl else 0.0
            self._store[key] = (value, expires_at)
            self._store.move_to_end(key)
            if len(self._store) > self._max:
                self._store.popitem(last=False)

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._store.pop(key, None)

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()

    def size(self) -> int:
        return len(self._store)


# ---------------------------------------------------------------------------
# Redis wrapper with automatic LRU fallback
# ---------------------------------------------------------------------------

class CacheService:
    """
    Async cache service.
    Tries Redis first; falls back to in-process LRU on any Redis error.
    Values are JSON-serialised before storage.
    """

    def __init__(self) -> None:
        self._redis: Any | None = None       # redis.asyncio.Redis
        self._lru   = LRUCache(LRU_MAX_SIZE)
        self._redis_ok = False

    async def connect(self) -> None:
        """Attempt to connect to Redis; silently fall back to LRU on failure."""
        try:
            import redis.asyncio as aioredis  # type: ignore
            self._redis = aioredis.from_url(
                REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=3,
            )
            await self._redis.ping()
            self._redis_ok = True
            logger.info("Redis connected: %s", REDIS_URL)
        except Exception as exc:
            logger.warning("Redis unavailable (%s) – using in-process LRU cache", exc)
            self._redis_ok = False

    async def disconnect(self) -> None:
        if self._redis_ok and self._redis:
            await self._redis.aclose()
            logger.info("Redis connection closed")

    # ── Public API ────────────────────────────────────────────────────────

    async def get(self, key: str) -> Any | None:
        full_key = CACHE_PREFIX + key
        try:
            if self._redis_ok:
                raw = await self._redis.get(full_key)
                if raw is not None:
                    return json.loads(raw)
            return await self._lru.get(full_key)
        except Exception as exc:
            logger.debug("Cache get error: %s", exc)
            return await self._lru.get(full_key)

    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        full_key = CACHE_PREFIX + key
        serialised = json.dumps(value, default=str)
        try:
            if self._redis_ok:
                await self._redis.setex(full_key, ttl, serialised)
        except Exception as exc:
            logger.debug("Redis set error: %s – falling back to LRU", exc)
            self._redis_ok = False
        await self._lru.set(full_key, value, ttl)

    async def set_raw(self, key: str, raw: str, ttl: int = 300) -> None:
        """Store a pre-serialised JSON string directly."""
        full_key = CACHE_PREFIX + key
        try:
            if self._redis_ok:
                await self._redis.setex(full_key, ttl, raw)
        except Exception:
            pass
        try:
            await self._lru.set(full_key, json.loads(raw), ttl)
        except Exception:
            pass

    async def delete(self, key: str) -> None:
        full_key = CACHE_PREFIX + key
        try:
            if self._redis_ok:
                await self._redis.delete(full_key)
        except Exception:
            pass
        await self._lru.delete(full_key)

    async def exists(self, key: str) -> bool:
        return (await self.get(key)) is not None

    def status(self) -> dict[str, Any]:
        return {
            "redis_connected": self._redis_ok,
            "redis_url":       REDIS_URL if self._redis_ok else None,
            "lru_size":        self._lru.size(),
            "lru_max":         LRU_MAX_SIZE,
            "backend":         "redis" if self._redis_ok else "lru",
        }


# Global singleton
cache = CacheService()


# ---------------------------------------------------------------------------
# Decorator: @cached_computation
# ---------------------------------------------------------------------------

def _make_cache_key(func_name: str, *args: Any, **kwargs: Any) -> str:
    """Deterministic cache key from function name + serialised args."""
    payload = json.dumps({"a": args, "k": kwargs}, sort_keys=True, default=str)
    digest  = hashlib.sha256(payload.encode()).hexdigest()[:16]
    return f"{func_name}:{digest}"


def cached_computation(namespace: str, ttl: int = 600):
    """
    Decorator that caches the return value of an async function.

    Usage::

        @cached_computation("fuzzy_ahp", ttl=3600)
        async def compute_fuzzy_ahp(districts, wind_kt):
            ...
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            key = _make_cache_key(f"{namespace}:{func.__name__}", *args, **kwargs)
            cached = await cache.get(key)
            if cached is not None:
                logger.debug("Cache HIT: %s", key)
                return cached
            logger.debug("Cache MISS: %s – computing", key)
            result = await func(*args, **kwargs)
            await cache.set(key, result, ttl=ttl)
            return result
        return wrapper
    return decorator


# ---------------------------------------------------------------------------
# Fuzzy-AHP multi-criteria risk weighting  (heavy geospatial computation)
# ---------------------------------------------------------------------------

# Criteria weights derived from Fuzzy-AHP pairwise comparison matrix
# (Saaty scale, triangular fuzzy numbers normalised to crisp weights)
FUZZY_AHP_WEIGHTS = {
    "wind_speed":         0.312,
    "distance_to_track":  0.248,
    "surge_exposure":     0.187,
    "population_density": 0.143,
    "infrastructure":     0.068,
    "historical_damage":  0.042,
}


@cached_computation("fuzzy_ahp", ttl=TTL_FUZZY_AHP)
async def compute_fuzzy_ahp_risk(
    districts: list[dict],
    wind_kt: float,
    track_lat: float,
    track_lon: float,
) -> list[dict]:
    """
    Compute Fuzzy-AHP composite risk score for each district.
    Result is cached for TTL_FUZZY_AHP seconds.

    Returns districts enriched with:
      - fuzzy_risk_score  (0–10)
      - risk_components   (per-criterion contributions)
      - revised_zone      (Red/Orange/Yellow based on AHP score)
    """
    # Simulate CPU-bound work; in production replace with real grid calculations
    await asyncio.sleep(0)   # yield to event loop

    result = []
    for d in districts:
        lat = float(d.get("lat", 0))
        lon = float(d.get("lon", 0))

        # Distance to cyclone centre (flat-earth km)
        dist_km = math.sqrt(
            ((lat - track_lat) * 111) ** 2
            + ((lon - track_lon) * 111 * math.cos(math.radians(track_lat))) ** 2
        )

        # Normalised component scores (0–1)
        wind_score   = min(1.0, wind_kt / 185.0)
        dist_score   = max(0.0, 1.0 - dist_km / 400.0)
        surge_score  = dist_score * 0.9 if lon > 80 else dist_score * 0.6  # coastal proxy
        pop_score    = min(1.0, d.get("population_affected", 500_000) / 5_000_000)
        infra_score  = 0.6   # placeholder – would come from GIS layer
        hist_score   = 0.5   # placeholder – would come from IBTrACS historical lookup

        composite = (
            FUZZY_AHP_WEIGHTS["wind_speed"]         * wind_score
            + FUZZY_AHP_WEIGHTS["distance_to_track"] * dist_score
            + FUZZY_AHP_WEIGHTS["surge_exposure"]    * surge_score
            + FUZZY_AHP_WEIGHTS["population_density"]* pop_score
            + FUZZY_AHP_WEIGHTS["infrastructure"]    * infra_score
            + FUZZY_AHP_WEIGHTS["historical_damage"] * hist_score
        )
        fuzzy_score = round(composite * 10, 2)

        revised_zone = (
            "Red"    if fuzzy_score >= 6.5 else
            "Orange" if fuzzy_score >= 4.0 else
            "Yellow"
        )

        result.append({
            **d,
            "fuzzy_risk_score":  fuzzy_score,
            "revised_zone":      revised_zone,
            "risk_components": {
                "wind":        round(wind_score  * FUZZY_AHP_WEIGHTS["wind_speed"],         3),
                "distance":    round(dist_score  * FUZZY_AHP_WEIGHTS["distance_to_track"],  3),
                "surge":       round(surge_score * FUZZY_AHP_WEIGHTS["surge_exposure"],     3),
                "population":  round(pop_score   * FUZZY_AHP_WEIGHTS["population_density"], 3),
                "infra":       round(infra_score * FUZZY_AHP_WEIGHTS["infrastructure"],     3),
                "historical":  round(hist_score  * FUZZY_AHP_WEIGHTS["historical_damage"],  3),
            },
        })

    return result


# ---------------------------------------------------------------------------
# Monte Carlo damage loss simulation  (heavy stochastic computation)
# ---------------------------------------------------------------------------

@cached_computation("monte_carlo", ttl=TTL_MONTE_CARLO)
async def run_monte_carlo_damage(
    wind_kt: float,
    affected_districts: list[dict],
    n_simulations: int = 5000,
) -> dict[str, Any]:
    """
    Run Monte Carlo simulation for economic damage estimation.
    Models uncertainty in:
      - Wind speed attenuation (±15 kt std dev)
      - Vulnerability factor (Beta distribution)
      - Asset exposure (LogNormal distribution)

    Returns P10 / P50 (median) / P90 damage estimates in USD millions.
    Result is cached for TTL_MONTE_CARLO seconds.
    """
    await asyncio.sleep(0)   # yield to event loop

    rng = random.Random(42)   # seeded for reproducibility within the same inputs

    total_damages: list[float] = []

    for _ in range(n_simulations):
        # Stochastic wind speed (±15 kt)
        sim_wind = max(34.0, wind_kt + rng.gauss(0, 15))

        sim_total = 0.0
        for d in affected_districts:
            base_damage = d.get("estimated_damage_usd_m", 0.0)

            # Vulnerability factor ~ Beta(2, 5) scaled to [0.5, 1.5]
            v_raw = rng.betavariate(2, 5)
            vuln  = 0.5 + v_raw

            # Wind scaling: damage ∝ wind^3 (standard wind-damage relationship)
            wind_scale = (sim_wind / max(wind_kt, 1)) ** 3

            # Asset exposure multiplier ~ LogNormal(0, 0.3)
            log_rand = rng.gauss(0, 0.3)
            exposure = math.exp(log_rand)

            sim_damage = base_damage * vuln * wind_scale * exposure
            sim_total += max(0.0, sim_damage)

        total_damages.append(sim_total)

    total_damages.sort()
    n = len(total_damages)

    def percentile(p: float) -> float:
        idx = int(p / 100 * n)
        return round(total_damages[min(idx, n - 1)], 2)

    return {
        "n_simulations": n_simulations,
        "wind_kt_input": wind_kt,
        "damage_usd_m": {
            "p10":    percentile(10),
            "p50":    percentile(50),   # median
            "p90":    percentile(90),
            "mean":   round(sum(total_damages) / n, 2),
            "min":    round(total_damages[0], 2),
            "max":    round(total_damages[-1], 2),
        },
        "damage_inr_crores": {
            "p10":    round(percentile(10)  * 83 / 10, 2),
            "p50":    round(percentile(50)  * 83 / 10, 2),
            "p90":    round(percentile(90)  * 83 / 10, 2),
            "mean":   round(sum(total_damages) / n * 83 / 10, 2),
        },
        "confidence_interval_95": [percentile(2.5), percentile(97.5)],
    }
