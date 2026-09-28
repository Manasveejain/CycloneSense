"""
Alert Gateway Routes
=====================
Endpoints for CAP XML generation, multilingual text, and full alert dispatch.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.services.alert_gateway import (
    build_cap_xml,
    build_alert_texts,
    dispatch_alerts,
    LANGUAGE_TEMPLATES,
    STATE_LANGUAGE_MAP,
)
from app.services.cache import cache, run_monte_carlo_damage, compute_fuzzy_ahp_risk

router = APIRouter()


# ── Request / Response models ─────────────────────────────────────────────

class DistrictInput(BaseModel):
    name:                      str
    state:                     str
    lat:                       float
    lon:                       float
    zone:                      str = "Yellow"
    risk_score:                float = 5.0
    distance_to_path_km:       float = 50.0
    estimated_damage_usd_m:    float = 100.0
    estimated_damage_inr_crores: float | None = None
    population_affected:       int   = 500_000
    action:                    str   = "Follow local authority instructions"
    predicted_wind_kt:         float | None = None


class AlertDispatchRequest(BaseModel):
    storm_name: str = Field(..., example="Cyclone Fani")
    wind_kt:    float = Field(..., ge=34, le=200, example=120.0)
    districts:  list[DistrictInput]
    channels:   list[str] = Field(
        default=["cap", "webhook", "sms"],
        example=["cap", "webhook"],
    )


class RiskRequest(BaseModel):
    storm_name:   str
    wind_kt:      float
    track_lat:    float
    track_lon:    float
    districts:    list[DistrictInput]
    n_simulations: int = Field(default=5000, ge=100, le=50_000)


# ── Routes ────────────────────────────────────────────────────────────────

@router.get("/alerts/languages")
def list_languages():
    """List all supported alert languages and their state mappings."""
    return {
        "languages": {
            code: {"name": tmpl["name"], "urgent_prefix": tmpl["urgent"]}
            for code, tmpl in LANGUAGE_TEMPLATES.items()
        },
        "state_language_map": STATE_LANGUAGE_MAP,
    }


@router.post("/alerts/multilingual")
def multilingual_alert(district: DistrictInput, storm_name: str = "Cyclone"):
    """
    Generate alert text for a single district in all applicable regional languages.
    Returns a dict of {lang_code: alert_text}.
    """
    texts = build_alert_texts(storm_name, district.model_dump())
    return {
        "district": district.name,
        "state":    district.state,
        "languages_generated": list(texts.keys()),
        "alerts":   texts,
    }


@router.post("/alerts/cap-xml", response_class=Response)
def generate_cap_xml(req: AlertDispatchRequest):
    """
    Generate a CAP 1.2 XML alert document and return it as application/xml.
    """
    try:
        xml = build_cap_xml(
            storm_name=req.storm_name,
            districts=[d.model_dump() for d in req.districts],
            wind_kt=req.wind_kt,
        )
        return Response(content=xml, media_type="application/xml")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/alerts/dispatch")
async def dispatch_alert(req: AlertDispatchRequest):
    """
    Full alert dispatch: CAP XML + multilingual SMS via Twilio + Webhook POST.
    Includes built-in 5-minute deduplication per storm.
    """
    result = await dispatch_alerts(
        storm_name=req.storm_name,
        districts=[d.model_dump() for d in req.districts],
        wind_kt=req.wind_kt,
        channels=req.channels,
    )
    return result


@router.post("/alerts/fuzzy-ahp-risk")
async def fuzzy_ahp_risk(req: RiskRequest):
    """
    Compute Fuzzy-AHP composite risk scores for all districts.
    Results are Redis-cached for 1 hour — subsequent identical requests
    return instantly from cache.
    """
    enriched = await compute_fuzzy_ahp_risk(
        districts=[d.model_dump() for d in req.districts],
        wind_kt=req.wind_kt,
        track_lat=req.track_lat,
        track_lon=req.track_lon,
    )
    return {
        "storm_name":       req.storm_name,
        "wind_kt":          req.wind_kt,
        "districts_scored": len(enriched),
        "results":          enriched,
        "weights_used":     {
            "wind_speed": 0.312, "distance_to_track": 0.248,
            "surge_exposure": 0.187, "population_density": 0.143,
            "infrastructure": 0.068, "historical_damage": 0.042,
        },
    }


@router.post("/alerts/monte-carlo-damage")
async def monte_carlo_damage(req: RiskRequest):
    """
    Run Monte Carlo damage simulation (N=5000 by default).
    Returns P10/P50/P90 loss estimates in USD millions and INR Crores.
    Results are Redis-cached for 30 minutes.
    """
    simulation = await run_monte_carlo_damage(
        wind_kt=req.wind_kt,
        affected_districts=[d.model_dump() for d in req.districts],
        n_simulations=req.n_simulations,
    )
    return {
        "storm_name":   req.storm_name,
        "simulation":   simulation,
        "cache_ttl_s":  1800,
    }


@router.get("/alerts/cache-status")
async def cache_status():
    """Return current cache backend status (Redis vs LRU fallback)."""
    return cache.status()
