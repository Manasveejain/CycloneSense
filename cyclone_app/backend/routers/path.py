"""
routers/path.py
GET  /path/storms          – list all storms from IMD data
GET  /path/storm/{sid}     – full track for one storm
POST /path/search          – search storms by name / year / basin
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd

from model_loader import get_imd_data

router = APIRouter(prefix="/path", tags=["Path / IMD Data"])


# ── Helper ─────────────────────────────────────────────────────────────────────

def _obs_to_list(obs_df: pd.DataFrame, storm_id: str) -> list:
    """Filter observations for one storm and return as a list of dicts."""
    if obs_df.empty:
        return []

    # Identify the storm-id column (imdtrack uses 'id' or 'storm_id')
    id_col = next((c for c in obs_df.columns if c.lower() in ("id", "storm_id", "stormid")), None)
    if id_col is None:
        return []

    sub = obs_df[obs_df[id_col] == storm_id]

    # Map common column names
    col_map = {
        "lat": next((c for c in sub.columns if c.lower() in ("lat", "latitude")),  None),
        "lon": next((c for c in sub.columns if c.lower() in ("lon", "long", "longitude")), None),
        "wind": next((c for c in sub.columns if "wind" in c.lower() or "vmax" in c.lower()), None),
        "pres": next((c for c in sub.columns if "pres" in c.lower() or "mslp" in c.lower()), None),
        "time": next((c for c in sub.columns if "time" in c.lower() or "date" in c.lower()), None),
    }

    records = []
    for _, row in sub.iterrows():
        rec = {"storm_id": storm_id}
        if col_map["lat"]:  rec["lat"]          = float(row[col_map["lat"]])
        if col_map["lon"]:  rec["lon"]           = float(row[col_map["lon"]])
        if col_map["wind"]: rec["wind_kt"]       = float(row[col_map["wind"]])
        if col_map["pres"]: rec["pressure_hpa"]  = float(row[col_map["pres"]])
        if col_map["time"]: rec["time"]          = str(row[col_map["time"]])
        records.append(rec)
    return records


def _storms_summary(storms) -> list:
    """Convert imdtrack storms list to a JSON-serialisable list of dicts."""
    out = []
    for s in storms:
        # imdtrack Storm objects expose .id, .name, .year, .basin etc.
        entry = {}
        for attr in ("id", "name", "year", "basin", "season"):
            val = getattr(s, attr, None)
            if val is not None:
                entry[attr] = val
        if entry:
            out.append(entry)
    return out


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/storms")
def list_storms(limit: int = Query(default=100, ge=1, le=5000)):
    """Return a paginated list of all storms in the IMD dataset."""
    data   = get_imd_data()
    storms = _storms_summary(data["storms"])
    return {"status": "success", "count": len(storms), "storms": storms[:limit]}


@router.get("/storm/{storm_id}")
def get_storm_track(storm_id: str):
    """Return the full best-track observations for a given storm ID."""
    data = get_imd_data()
    obs  = _obs_to_list(data["observations"], storm_id)
    if not obs:
        raise HTTPException(status_code=404, detail=f"Storm '{storm_id}' not found or has no observations.")
    return {"status": "success", "storm_id": storm_id, "track": obs}


class SearchRequest(BaseModel):
    name:   Optional[str] = None
    year:   Optional[int] = None
    basin:  Optional[str] = None


@router.post("/search")
def search_storms(req: SearchRequest):
    """Filter storms by name substring, year, or basin."""
    data   = get_imd_data()
    storms = data["storms"]

    filtered = []
    for s in storms:
        if req.name  and req.name.lower()  not in str(getattr(s, "name",  "")).lower(): continue
        if req.year  and req.year          != getattr(s, "year",  None): continue
        if req.basin and req.basin.upper() != str(getattr(s, "basin", "")).upper(): continue
        entry = {}
        for attr in ("id", "name", "year", "basin", "season"):
            val = getattr(s, attr, None)
            if val is not None:
                entry[attr] = val
        filtered.append(entry)

    return {"status": "success", "count": len(filtered), "storms": filtered}
