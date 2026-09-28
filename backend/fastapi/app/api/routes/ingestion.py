"""
Live Data Ingestion Routes
===========================
Exposes the APScheduler ingestion worker status and latest fetched data.
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.services.ingestion import (
    live_store,
    job_poll_imd,
    job_poll_jtwc,
    job_fetch_satellite,
)

router = APIRouter()


@router.get("/ingestion/status")
async def ingestion_status():
    """Return current in-memory snapshot of all ingested live data."""
    snapshot = await live_store.snapshot()
    return {
        "status": "ok",
        "last_updated": snapshot.get("last_updated", {}),
        "imd_alerts_count":  len(snapshot.get("imd_alerts",  [])),
        "jtwc_points_count": len(snapshot.get("jtwc_tracks", [])),
        "satellite_source":  snapshot.get("satellite_meta", {}).get("source"),
        "satellite_cached_path": snapshot.get("satellite_meta", {}).get("local_path"),
    }


@router.get("/ingestion/live")
async def ingestion_live():
    """Return the full live data snapshot (alerts + tracks + satellite meta)."""
    return await live_store.snapshot()


@router.post("/ingestion/refresh")
async def ingestion_refresh(background_tasks: BackgroundTasks, source: str = "all"):
    """
    Manually trigger a data refresh outside the scheduler interval.
    source: 'imd' | 'jtwc' | 'satellite' | 'all'
    """
    jobs = {
        "imd":       job_poll_imd,
        "jtwc":      job_poll_jtwc,
        "satellite": job_fetch_satellite,
    }
    if source == "all":
        for fn in jobs.values():
            background_tasks.add_task(fn)
        return {"status": "queued", "sources": list(jobs.keys())}
    if source not in jobs:
        raise HTTPException(status_code=400, detail=f"Unknown source '{source}'. Use: {list(jobs)}")
    background_tasks.add_task(jobs[source])
    return {"status": "queued", "source": source}
