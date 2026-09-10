"""
routers/satellite.py
Satellite image endpoints – fetch real-time and historical imagery for cyclone analysis.

Sources used
------------
1. NASA EONET  – active natural event list (cyclones/storms): https://eonet.gsfc.nasa.gov/api/v3
2. NASA Worldview WMTS – near real-time MODIS / VIIRS imagery tiles (no key needed)
3. NOAA/NASA GOES-East WMS – geostationary IR imagery over Indian Ocean region
4. RAMMB SLIDER – tropical cyclone satellite archive imagery (public)

All external fetches use httpx with a 20 s timeout and return the raw bytes or
structured JSON so the frontend can display or post to /predict/intensity.
"""

from __future__ import annotations

import io
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import numpy as np
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

router = APIRouter(prefix="/satellite", tags=["Satellite Imagery"])

# ── Constants ──────────────────────────────────────────────────────────────────

TIMEOUT = httpx.Timeout(20.0)

# NASA EONET events API (no key needed)
EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"

# NASA Worldview WMTS endpoint (no key needed, open tile access)
# Returns a 256×256 PNG tile at the requested time/zoom/row/col
WORLDVIEW_WMTS = (
    "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/"
    "{layer}/default/{date}/250m/{zoom}/{row}/{col}.jpg"
)

# GOES-East ABI true-colour / IR product (NOAA STAR, open access)
GOES_EAST_URL = (
    "https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/taw/"
    "{band}/latest.jpg"
)

# RAMMB SLIDER satellite archive (open, no key)
RAMMB_URL = (
    "https://rammb-slider.cira.colostate.edu/data/imagery/"
    "{date}/{satellite}---{sector}/{product}/{date_time}/{filename}.png"
)

# NASA GIBS layers useful for cyclone monitoring
GIBS_LAYERS = {
    "modis_terra_truecolor":   "MODIS_Terra_CorrectedReflectance_TrueColor",
    "modis_aqua_truecolor":    "MODIS_Aqua_CorrectedReflectance_TrueColor",
    "viirs_noaa20_truecolor":  "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
    "viirs_suomi_truecolor":   "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    "goes_east_ir":            "GOES-East_ABI_Band13_Clean_Infrared",
}


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _fetch_bytes(url: str, params: dict | None = None) -> bytes:
    """Async HTTP GET returning raw bytes. Raises HTTPException on failure."""
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        r = await client.get(url, params=params)
    if r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Upstream request failed: {r.status_code} {url}"
        )
    return r.content


async def _fetch_json(url: str, params: dict | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        r = await client.get(url, params=params)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Upstream: {r.status_code}")
    return r.json()


def _today_str(offset_days: int = 0) -> str:
    d = datetime.now(timezone.utc) - timedelta(days=offset_days)
    return d.strftime("%Y-%m-%d")


def _img_to_flat(raw_bytes: bytes) -> list[float]:
    """Convert any image bytes to flat 64×64×4 list for /predict/intensity."""
    from PIL import Image
    pil = Image.open(io.BytesIO(raw_bytes)).convert("RGBA")
    pil = pil.resize((64, 64))
    arr = np.array(pil, dtype=np.float32) / 255.0
    return arr.flatten().tolist()


# ── Endpoints ──────────────────────────────────────────────────────────────────

# 1. Active cyclone events from NASA EONET
@router.get("/events")
async def get_active_cyclone_events(
    days: int = Query(default=20, ge=1, le=90, description="Look-back window in days"),
    status: str = Query(default="open", description="open | closed | all"),
):
    """
    Fetch active tropical cyclone / severe storm events from NASA EONET v3.
    Returns GeoJSON-style list of events with geometry (lat/lon tracks).
    """
    params = {
        "category": "severeStorms",
        "status":   status,
        "days":     days,
        "limit":    50,
    }
    data = await _fetch_json(EONET_URL, params=params)
    events = data.get("events", [])

    # Enrich with parsed track points
    result = []
    for ev in events:
        geom = ev.get("geometry", [])
        track = [
            {
                "date": g.get("date"),
                "lat":  g["coordinates"][1] if g.get("coordinates") else None,
                "lon":  g["coordinates"][0] if g.get("coordinates") else None,
            }
            for g in geom
            if g.get("type") == "Point"
        ]
        result.append({
            "id":          ev.get("id"),
            "title":       ev.get("title"),
            "description": ev.get("description"),
            "link":        ev.get("link"),
            "closed":      ev.get("closed"),
            "categories":  [c.get("title") for c in ev.get("categories", [])],
            "track":       track,
            "latest_lat":  track[-1]["lat"] if track else None,
            "latest_lon":  track[-1]["lon"] if track else None,
        })

    return {
        "status":    "success",
        "count":     len(result),
        "source":    "NASA EONET v3",
        "retrieved": datetime.now(timezone.utc).isoformat(),
        "events":    result,
    }


# 2. NASA GIBS – Fetch a single tile for a layer/date/zoom
@router.get("/tile")
async def get_worldview_tile(
    layer: str = Query(default="modis_terra_truecolor", description=str(list(GIBS_LAYERS.keys()))),
    date:  str = Query(default="", description="YYYY-MM-DD. Defaults to today."),
    zoom:  int = Query(default=4, ge=0, le=8),
    row:   int = Query(default=4, ge=0, le=255),
    col:   int = Query(default=10, ge=0, le=511),
):
    """
    Proxy a 256×256 imagery tile from NASA GIBS (WMTS).
    Default tile covers the Bay of Bengal / Indian Ocean at zoom 4.
    """
    layer_id = GIBS_LAYERS.get(layer, GIBS_LAYERS["modis_terra_truecolor"])
    tile_date = date if date else _today_str(1)  # yesterday to ensure availability
    url = WORLDVIEW_WMTS.format(
        layer=layer_id, date=tile_date, zoom=zoom, row=row, col=col
    )
    try:
        raw = await _fetch_bytes(url)
        return Response(content=raw, media_type="image/jpeg")
    except HTTPException:
        # Try previous day if today's tile isn't rendered yet
        tile_date = _today_str(2)
        url = WORLDVIEW_WMTS.format(
            layer=layer_id, date=tile_date, zoom=zoom, row=row, col=col
        )
        raw = await _fetch_bytes(url)
        return Response(content=raw, media_type="image/jpeg")


# 3. GOES-East latest sector image
@router.get("/goes")
async def get_goes_latest(
    band: str = Query(
        default="13",
        description="ABI band: 02=visible, 13=IR clean window, 09=water vapour",
    ),
):
    """
    Fetch the latest GOES-East ABI full-disc / TAW sector image.
    Band 13 = 10.3 µm Clean IR window (best for cyclone cloud-top temp).
    """
    url = GOES_EAST_URL.format(band=band.zfill(2))
    try:
        raw = await _fetch_bytes(url)
        return Response(content=raw, media_type="image/jpeg")
    except HTTPException:
        raise HTTPException(
            status_code=502,
            detail="GOES-East image unavailable. Try again in a few minutes.",
        )


# 4. Fetch a GIBS image and return as flat array for the CNN
@router.get("/intensity-input")
async def get_intensity_input(
    layer: str = Query(default="modis_terra_truecolor"),
    date:  str = Query(default=""),
    zoom:  int = Query(default=4, ge=0, le=8),
    row:   int = Query(default=4, ge=0, le=255),
    col:   int = Query(default=10, ge=0, le=511),
):
    """
    Fetch a satellite tile and return it as a flat 16384-element float list
    (64×64×4 normalised to 0–1) ready to POST to /predict/intensity as image_flat.
    """
    layer_id  = GIBS_LAYERS.get(layer, GIBS_LAYERS["modis_terra_truecolor"])
    tile_date = date if date else _today_str(1)
    url = WORLDVIEW_WMTS.format(
        layer=layer_id, date=tile_date, zoom=zoom, row=row, col=col
    )
    try:
        raw = await _fetch_bytes(url)
    except HTTPException:
        tile_date = _today_str(2)
        url = WORLDVIEW_WMTS.format(
            layer=layer_id, date=tile_date, zoom=zoom, row=row, col=col
        )
        raw = await _fetch_bytes(url)

    flat = _img_to_flat(raw)
    return {
        "status":      "success",
        "layer":       layer,
        "date":        tile_date,
        "zoom":        zoom,
        "row":         row,
        "col":         col,
        "image_flat":  flat,
        "shape":       [1, 64, 64, 4],
        "source":      "NASA GIBS / Worldview",
    }


# 5. Available layers list
@router.get("/layers")
def list_layers():
    """List all available satellite layers and their descriptions."""
    return {
        "status": "success",
        "layers": [
            {
                "id":          k,
                "gibs_id":     v,
                "description": _layer_desc(k),
            }
            for k, v in GIBS_LAYERS.items()
        ],
        "sources": [
            {"name": "NASA EONET",       "url": "https://eonet.gsfc.nasa.gov/"},
            {"name": "NASA GIBS",        "url": "https://earthdata.nasa.gov/esdis/esco/standards-and-practices/api-for-bulk-downloading-imagery/wmts"},
            {"name": "NOAA GOES-East",   "url": "https://www.star.nesdis.noaa.gov/GOES/"},
            {"name": "RAMMB SLIDER",     "url": "https://rammb-slider.cira.colostate.edu/"},
        ],
    }


def _layer_desc(key: str) -> str:
    descs = {
        "modis_terra_truecolor":  "MODIS Terra – True Colour (250 m, 1–2 day delay)",
        "modis_aqua_truecolor":   "MODIS Aqua  – True Colour (250 m, 1–2 day delay)",
        "viirs_noaa20_truecolor": "VIIRS NOAA-20 – True Colour (375 m, ~12 h delay)",
        "viirs_suomi_truecolor":  "VIIRS Suomi NPP – True Colour (375 m, ~12 h delay)",
        "goes_east_ir":           "GOES-East ABI Band-13 IR (2 km, ~10 min refresh)",
    }
    return descs.get(key, key)


# 6. Thumbnail strip for a storm centre (convenience endpoint)
class StormImageRequest(BaseModel):
    lat:   float
    lon:   float
    date:  Optional[str] = None   # YYYY-MM-DD; defaults to today
    layer: str = "modis_terra_truecolor"


@router.post("/storm-image")
async def get_storm_image(req: StormImageRequest):
    """
    Given a storm centre lat/lon, compute the correct WMTS tile index and
    return the tile image bytes AND the flat array for intensity prediction.
    Uses EPSG:4326 250m grid (zoom 4 = 16 tiles wide, 8 tiles tall).
    """
    # EPSG:4326 WMTS tile calculation at zoom 4
    zoom = 5
    n_tiles_x = 2 ** (zoom + 1)   # 64 cols
    n_tiles_y = 2 ** zoom          # 32 rows
    col = int((req.lon + 180.0) / 360.0 * n_tiles_x)
    row = int((90.0  - req.lat)  / 180.0 * n_tiles_y)
    col = max(0, min(col, n_tiles_x - 1))
    row = max(0, min(row, n_tiles_y - 1))

    layer_id  = GIBS_LAYERS.get(req.layer, GIBS_LAYERS["modis_terra_truecolor"])
    tile_date = req.date if req.date else _today_str(1)

    url = WORLDVIEW_WMTS.format(
        layer=layer_id, date=tile_date, zoom=zoom, row=row, col=col
    )
    try:
        raw = await _fetch_bytes(url)
    except HTTPException:
        tile_date = _today_str(2)
        url = WORLDVIEW_WMTS.format(
            layer=layer_id, date=tile_date, zoom=zoom, row=row, col=col
        )
        raw = await _fetch_bytes(url)

    flat = _img_to_flat(raw)

    import base64
    img_b64 = base64.b64encode(raw).decode()

    return {
        "status":     "success",
        "layer":      req.layer,
        "date":       tile_date,
        "zoom":       zoom,
        "row":        row,
        "col":        col,
        "lat":        req.lat,
        "lon":        req.lon,
        "image_b64":  img_b64,
        "image_flat": flat,
        "source":     "NASA GIBS / Worldview",
    }
