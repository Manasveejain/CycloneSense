"""
routers/alerts.py
POST /alerts/generate  – Generate CAP-format alerts for a list of districts.
GET  /alerts/levels    – Explain alert levels.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime, timezone

router = APIRouter(prefix="/alerts", tags=["Alert Dispatch"])


class DistrictAlert(BaseModel):
    district_id:   str
    risk_zone:     str   = Field(..., pattern="^(Red|Orange|Yellow)$")
    wind_kt:       float
    damage_musd:   float = 0.0
    district_name: str   = ""


class CAPInfo(BaseModel):
    category:    str
    event:       str
    urgency:     str
    severity:    str
    certainty:   str
    description: str
    instruction: str
    color_code:  str


class CAPAlert(BaseModel):
    identifier:  str
    sender:      str
    sent:        str
    status:      str
    msg_type:    str
    scope:       str
    district_id: str
    info:        CAPInfo


class AlertResponse(BaseModel):
    status:    str
    generated: str
    alerts:    List[CAPAlert]


_ZONE_META = {
    "Red": {
        "urgency":     "Immediate",
        "certainty":   "Observed",
        "instruction": "Evacuation advisory in effect. Activate emergency shelters immediately. All residents must move to higher ground.",
        "color_code":  "#FF0000",
    },
    "Orange": {
        "urgency":     "Expected",
        "certainty":   "Likely",
        "instruction": "Prepare to evacuate. Secure coastal properties, stage rescue resources and open community shelters.",
        "color_code":  "#FF8C00",
    },
    "Yellow": {
        "urgency":     "Future",
        "certainty":   "Possible",
        "instruction": "Monitor local weather advisories. Keep emergency kits ready and follow official guidance.",
        "color_code":  "#FFD700",
    },
}


@router.post("/generate", response_model=AlertResponse)
def generate_alerts(districts: List[DistrictAlert]):
    now    = datetime.now(timezone.utc).isoformat()
    alerts = []

    for d in districts:
        meta = _ZONE_META.get(d.risk_zone, _ZONE_META["Yellow"])
        name = d.district_name or d.district_id

        alerts.append(CAPAlert(
            identifier  = f"CAP-{d.district_id.upper()}-{uuid.uuid4().hex[:8].upper()}",
            sender      = "CyclonePredictionSystem/IMD",
            sent        = now,
            status      = "Actual",
            msg_type    = "Alert",
            scope       = "Public",
            district_id = d.district_id,
            info        = CAPInfo(
                category    = "Met",
                event       = "Tropical Cyclone",
                urgency     = meta["urgency"],
                severity    = d.risk_zone,
                certainty   = meta["certainty"],
                description = (
                    f"District {name} faces predicted wind speeds up to "
                    f"{d.wind_kt:.1f} kt with an estimated economic impact of "
                    f"USD {d.damage_musd:.1f}M."
                ),
                instruction = meta["instruction"],
                color_code  = meta["color_code"],
            ),
        ))

    return AlertResponse(status="success", generated=now, alerts=alerts)


@router.get("/levels")
def alert_levels():
    return {
        "levels": [
            {
                "zone":        "Red",
                "description": "Extremely Severe / Super Cyclone – immediate threat to life and property.",
                "action":      "Evacuate NOW.",
                "color":       "#FF0000",
            },
            {
                "zone":        "Orange",
                "description": "Very Severe / Severe Cyclone – significant damage expected within 24 h.",
                "action":      "Prepare for evacuation. Stage resources.",
                "color":       "#FF8C00",
            },
            {
                "zone":        "Yellow",
                "description": "Tropical Storm / Depression – moderate threat; localised flooding possible.",
                "action":      "Stay alert. Monitor official updates.",
                "color":       "#FFD700",
            },
        ]
    }
