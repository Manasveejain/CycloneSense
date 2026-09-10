"""
routers/damage.py
POST /predict/damage  – XGBoost-based damage & risk-zone estimation per district.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List
import numpy as np

from model_loader import get_damage_model
from utils.preprocessing import classify_risk_zone, build_damage_dmatrix

router = APIRouter(prefix="/predict", tags=["Damage Estimation"])


class DistrictInput(BaseModel):
    district_id:        str   = Field(..., description="Name or ID of the district")
    distance_to_path_km: float = Field(..., ge=0, le=2000, description="Distance to predicted cyclone path (km)")
    predicted_wind_kt:  float = Field(..., ge=0, le=200,  description="Predicted max wind at district (knots)")
    vulnerability_index: float = Field(..., ge=0, le=100,  description="Composite vulnerability score 0–100")


class DistrictResult(BaseModel):
    district_id:           str
    risk_zone:             str
    estimated_damage_musd: float   # Million USD
    urgency:               str
    instruction:           str


class DamageRequest(BaseModel):
    districts: List[DistrictInput] = Field(..., min_length=1, max_length=500)


class DamageResponse(BaseModel):
    status:  str
    results: List[DistrictResult]
    summary: dict


_URGENCY = {"Red": "Immediate", "Orange": "Expected", "Yellow": "Future"}
_INSTRUCTIONS = {
    "Red":    "Evacuation advisory in effect. Activate emergency shelters immediately.",
    "Orange": "Prepare to evacuate. Secure coastal properties and stage resources.",
    "Yellow": "Monitor local weather stations for precautionary advisories.",
}


@router.post("/damage", response_model=DamageResponse)
def predict_damage(req: DamageRequest):
    try:
        model   = get_damage_model()
        results = []

        for d in req.districts:
            zone   = classify_risk_zone(d.predicted_wind_kt, d.distance_to_path_km, d.vulnerability_index)
            dmat   = build_damage_dmatrix(d.predicted_wind_kt, d.distance_to_path_km, d.vulnerability_index)
            damage = float(np.clip(model.predict(dmat)[0], 0, None))

            results.append(DistrictResult(
                district_id=d.district_id,
                risk_zone=zone,
                estimated_damage_musd=round(damage, 2),
                urgency=_URGENCY[zone],
                instruction=_INSTRUCTIONS[zone],
            ))

        total_damage   = round(sum(r.estimated_damage_musd for r in results), 2)
        zone_counts    = {z: sum(1 for r in results if r.risk_zone == z) for z in ("Red", "Orange", "Yellow")}

        return DamageResponse(
            status="success",
            results=results,
            summary={
                "total_districts": len(results),
                "total_estimated_damage_musd": total_damage,
                "zone_counts": zone_counts,
            },
        )

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
