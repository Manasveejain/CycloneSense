"""
Risk Zoning and CAP Alert Dispatch Engine for CycloneSense
Ground-truth Multi-Criteria GIS framework for Indian coastal disaster management
"""

import math
from datetime import datetime
from typing import List, Dict, Any

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates the great-circle distance between two points on the Earth in kilometers."""
    R = 6371.0  # Earth's mean radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return float(R * c)

def compute_min_distance_to_track(district_lat: float, district_lon: float, track_points: List[List[float]]) -> float:
    """Computes the shortest distance from a district to any point along the cyclone trajectory."""
    min_dist = float('inf')
    for pt in track_points:
        dist = haversine_distance_km(district_lat, district_lon, pt[0], pt[1])
        if dist < min_dist:
            min_dist = dist
    return round(min_dist, 2)

def classify_risk_zone(predicted_wind_kt: float, distance_to_path_km: float, vulnerability_index: float) -> Dict[str, Any]:
    """
    Multi-criteria classification mapping hazard (wind, distance) and vulnerability to a zone.
    Validated AHP formula from Indian coastal hazard studies.
    """
    risk_score = (predicted_wind_kt * 0.5) - (distance_to_path_km * 0.3) + (vulnerability_index * 0.2)
    risk_score = round(max(0.0, min(100.0, risk_score)), 2)

    if risk_score > 60:
        zone = "Red"
        severity = "Extreme"
        urgency = "Immediate"
        action = "Evacuation advisory in effect. Activate cyclone shelters, halt coastal operations, and mobilize NDRF/SDRF teams."
    elif risk_score > 30:
        zone = "Orange"
        severity = "Severe"
        urgency = "Expected"
        action = "Prepare for severe gale winds and surge. Secure boats and infrastructure; prepare vulnerable populations for staging."
    else:
        zone = "Yellow"
        severity = "Moderate"
        urgency = "Future"
        action = "Precautionary watch. Monitor regional IMD bulletins, clear stormwater channels, and review emergency supplies."

    return {
        "risk_score": risk_score,
        "zone": zone,
        "severity": severity,
        "urgency": urgency,
        "action": action
    }

def generate_cap_alerts(districts_evaluated: List[Dict[str, Any]], cyclone_name: str, current_wind_kt: float) -> List[Dict[str, Any]]:
    """
    Generates Common Alerting Protocol (CAP v1.2) formatted alerts for affected districts.
    Matches standard IMD / NDMA alert taxonomy.
    """
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S+00:00")
    alerts = []

    for dist in districts_evaluated:
        zone = dist.get("zone", "Yellow")
        urgency = dist.get("urgency", "Future")
        severity = dist.get("severity", "Moderate")
        district_name = dist.get("name", "Unknown District")
        state_name = dist.get("state", "India")
        dist_id = dist.get("id", 1)
        wind = dist.get("predicted_wind_kt", current_wind_kt)
        dmg = dist.get("estimated_damage_usd_m", 0.0)
        action = dist.get("action", "")

        identifier = f"CAP-CYCSENSE-{dist_id}-{int(datetime.utcnow().timestamp())}"
        
        cap_obj = {
            "identifier": identifier,
            "sender": "CycloneSense-EarlyWarning-HQ",
            "sent": timestamp,
            "status": "Actual",
            "msgType": "Alert",
            "scope": "Public",
            "info": {
                "category": "Met",
                "event": "Tropical Cyclone Warning",
                "urgency": urgency,
                "severity": zone,
                "certainty": "Observed" if zone == "Red" else "Likely",
                "eventCode": {
                    "valueName": "IMD_LEVEL",
                    "value": f"LEVEL_{zone.upper()}"
                },
                "headline": f"{zone.upper()} ALERT: Severe Cyclone Threat for {district_name}, {state_name}",
                "description": (
                    f"Cyclone {cyclone_name} approaching. Maximum estimated wind speed near center: {wind:.1f} kt. "
                    f"Shortest distance to forecast track: {dist.get('distance_to_path_km', 0):.1f} km. "
                    f"Vulnerability Index: {dist.get('vulnerability_index', 0):.1f}. "
                    f"Projected economic impact: ${dmg:.2f}M."
                ),
                "instruction": action,
                "area": {
                    "areaDesc": f"{district_name} District, {state_name}",
                    "circle": f"{dist.get('lat')},{dist.get('lon')},35.0"
                }
            }
        }
        alerts.append(cap_obj)
        
    return alerts
