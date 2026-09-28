"""
Automated Data Ingestion Engine
================================
Polls live meteorological sources on a schedule via APScheduler:
  • IMD  – India Meteorological Department RSS/JSON feed
  • JTWC – Joint Typhoon Warning Center best-track text files
  • INSAT-3D/GOES – Thermal infrared (10.3 µm) satellite tile CDN

All fetched data is normalised into a shared in-memory store
(``LiveDataStore``) that the prediction endpoints read from.
Redis is used to persist fetched payloads across restarts.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiofiles
import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger("cyclonesense.ingestion")

# ---------------------------------------------------------------------------
# Configuration (override via environment variables)
# ---------------------------------------------------------------------------
IMD_FEED_URL    = os.getenv("IMD_FEED_URL",    "https://internal.imd.gov.in/pages/cyclone_ftp_new.php")
JTWC_BASE_URL   = os.getenv("JTWC_BASE_URL",   "https://www.metoc.navy.mil/jtwc/products/")
INSAT_TILE_URL  = os.getenv("INSAT_TILE_URL",  "https://satellite.imd.gov.in/dynamic/Bh_IR1_M_latest.jpg")
# GOES-18 replaced GOES-17 in Jan 2023; GOES-16 East covers Indian Ocean supplements
GOES_IR_URL     = os.getenv("GOES_IR_URL",     "https://cdn.star.nesdis.noaa.gov/GOES18/ABI/SECTOR/ind/Band13/latest.jpg")

POLL_INTERVAL_MINUTES = int(os.getenv("POLL_INTERVAL_MINUTES", "15"))
SATELLITE_INTERVAL_MINUTES = int(os.getenv("SATELLITE_INTERVAL_MINUTES", "30"))

CACHE_DIR = Path(os.getenv("INGEST_CACHE_DIR", "/tmp/cyclonesense_cache"))

# ---------------------------------------------------------------------------
# In-memory live data store (singleton)
# ---------------------------------------------------------------------------

class LiveDataStore:
    """Thread-safe in-memory store for the latest ingested data."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._data: dict[str, Any] = {
            "imd_alerts":       [],
            "jtwc_tracks":      [],
            "satellite_meta":   {},
            "last_updated":     {},
        }

    async def update(self, key: str, value: Any) -> None:
        async with self._lock:
            self._data[key] = value
            self._data["last_updated"][key] = datetime.now(timezone.utc).isoformat()
            logger.info("LiveDataStore updated: %s", key)

    async def get(self, key: str) -> Any:
        async with self._lock:
            return self._data.get(key)

    async def snapshot(self) -> dict[str, Any]:
        async with self._lock:
            return dict(self._data)


# Global singleton
live_store = LiveDataStore()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _fetch_with_retry(
    client: httpx.AsyncClient,
    url: str,
    retries: int = 3,
    timeout: float = 20.0,
) -> httpx.Response | None:
    """GET with exponential-backoff retry."""
    for attempt in range(retries):
        try:
            resp = await client.get(url, timeout=timeout)
            resp.raise_for_status()
            return resp
        except Exception as exc:
            wait = 2 ** attempt
            logger.warning("Fetch attempt %d/%d failed for %s: %s – retrying in %ds",
                           attempt + 1, retries, url, exc, wait)
            if attempt < retries - 1:
                await asyncio.sleep(wait)
    logger.error("All %d fetch attempts failed for %s", retries, url)
    return None


async def _cache_bytes(key: str, data: bytes) -> Path:
    """Save raw bytes to the local cache directory and return the path."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    safe = hashlib.md5(key.encode()).hexdigest()
    path = CACHE_DIR / safe
    async with aiofiles.open(path, "wb") as f:
        await f.write(data)
    return path


# ---------------------------------------------------------------------------
# IMD Feed Parser
# ---------------------------------------------------------------------------

def _parse_imd_html(html: str) -> list[dict]:
    """
    Extracts active cyclone bulletins from IMD's cyclone page HTML.
    Falls back gracefully if the page structure changes.
    """
    alerts = []
    # Look for patterns like: "Cyclone Name", Wind, Pressure
    storm_pattern = re.compile(
        r"(?P<name>Cyclone\s+\w+|Deep\s+Depression|Low\s+Pressure)[^<]*"
        r"(?P<lat>\d+\.\d+)[°\s]*N[^<]*(?P<lon>\d+\.\d+)[°\s]*E",
        re.IGNORECASE,
    )
    wind_pattern  = re.compile(r"(\d+)\s*(?:knots?|kt)", re.IGNORECASE)
    press_pattern = re.compile(r"(\d{3,4})\s*hPa", re.IGNORECASE)

    for m in storm_pattern.finditer(html):
        entry: dict[str, Any] = {
            "source":    "IMD",
            "name":      m.group("name").strip(),
            "lat":       float(m.group("lat")),
            "lon":       float(m.group("lon")),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        wm = wind_pattern.search(html[m.start():m.start() + 400])
        pm = press_pattern.search(html[m.start():m.start() + 400])
        if wm:
            entry["wind_kt"] = int(wm.group(1))
        if pm:
            entry["pressure_hpa"] = int(pm.group(1))
        alerts.append(entry)

    # If no storms parsed, return a status-only entry
    if not alerts:
        alerts.append({
            "source":    "IMD",
            "name":      "No active systems",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "raw_size":  len(html),
        })
    return alerts


# ---------------------------------------------------------------------------
# JTWC Best-Track Parser
# ---------------------------------------------------------------------------

def _parse_jtwc_track(text: str, basin: str = "IO") -> list[dict]:
    """
    Parse JTWC best-track / warning text files (fixed-width ATCF format).
    Returns a list of track point dicts.
    """
    points = []
    for line in text.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 8:
            continue
        try:
            # ATCF columns: BASIN, CY, YYYYMMDDHH, TECHNUM, TECH, TAU, LatN, LonE, VMAX, MSLP ...
            lat_str = parts[6]
            lon_str = parts[7]
            lat = float(lat_str.replace("N", "").replace("S", "")) * (
                -1 if "S" in lat_str else 1
            ) / 10.0
            lon = float(lon_str.replace("E", "").replace("W", "")) * (
                -1 if "W" in lon_str else 1
            ) / 10.0
            vmax = int(parts[8]) if parts[8].isdigit() else None
            mslp = int(parts[9]) if len(parts) > 9 and parts[9].isdigit() else None
            dtg  = parts[2]
            points.append({
                "source":  "JTWC",
                "basin":   basin,
                "dtg":     dtg,
                "lat":     lat,
                "lon":     lon,
                "wind_kt": vmax,
                "pressure_hpa": mslp,
            })
        except (ValueError, IndexError):
            continue
    return points


# ---------------------------------------------------------------------------
# Scheduled Jobs
# ---------------------------------------------------------------------------

async def job_poll_imd() -> None:
    """Poll IMD cyclone advisory page every POLL_INTERVAL_MINUTES minutes."""
    logger.info("[IMD] Polling feed: %s", IMD_FEED_URL)
    async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
        resp = await _fetch_with_retry(client, IMD_FEED_URL)
    if resp is None:
        logger.warning("[IMD] Skipping update – fetch failed")
        return

    alerts = _parse_imd_html(resp.text)
    await live_store.update("imd_alerts", alerts)

    # Persist to Redis if available
    try:
        from app.services.cache import cache
        await cache.set_raw("ingestion:imd_alerts", json.dumps(alerts), ttl=3600)
    except Exception:
        pass

    logger.info("[IMD] Stored %d alert(s)", len(alerts))


async def job_poll_jtwc() -> None:
    """Poll JTWC latest warning files for the Indian Ocean (IO) basin."""
    # JTWC publishes individual storm files named e.g. bsh022024.dat
    index_url = f"{JTWC_BASE_URL}bwp/index.html"
    io_url    = f"{JTWC_BASE_URL}bio/index.html"

    logger.info("[JTWC] Polling index: %s", io_url)
    all_tracks: list[dict] = []

    async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
        resp = await _fetch_with_retry(client, io_url)
        if resp:
            # Find linked .dat or .txt files
            dat_files = re.findall(r'href="([^"]+\.(?:dat|txt))"', resp.text, re.IGNORECASE)
            for fname in dat_files[:5]:  # limit to 5 most recent
                file_url = f"{JTWC_BASE_URL}bio/{fname}"
                fr = await _fetch_with_retry(client, file_url)
                if fr:
                    pts = _parse_jtwc_track(fr.text, basin="IO")
                    all_tracks.extend(pts)

    await live_store.update("jtwc_tracks", all_tracks)
    try:
        from app.services.cache import cache
        await cache.set_raw("ingestion:jtwc_tracks", json.dumps(all_tracks), ttl=3600)
    except Exception:
        pass

    logger.info("[JTWC] Stored %d track point(s)", len(all_tracks))


async def job_fetch_satellite() -> None:
    """
    Download the latest INSAT-3D thermal infrared composite (10.3 µm).
    Falls back to GOES-17 Indian Ocean sector if INSAT is unavailable.
    """
    urls = [
        ("INSAT-3D", INSAT_TILE_URL),
        ("GOES-IR",  GOES_IR_URL),
    ]
    meta: dict[str, Any] = {"fetched_at": datetime.now(timezone.utc).isoformat()}

    async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
        for source_name, url in urls:
            resp = await _fetch_with_retry(client, url)
            if resp and resp.headers.get("content-type", "").startswith("image"):
                path = await _cache_bytes(f"satellite_{source_name}", resp.content)
                meta.update({
                    "source":        source_name,
                    "url":           url,
                    "local_path":    str(path),
                    "size_bytes":    len(resp.content),
                    "content_type":  resp.headers.get("content-type"),
                })
                logger.info("[Satellite] %s cached: %d bytes → %s", source_name, len(resp.content), path)
                break  # use first successful source
        else:
            logger.warning("[Satellite] All sources failed – using last cached image")
            meta["source"] = "none"

    await live_store.update("satellite_meta", meta)
    try:
        from app.services.cache import cache
        await cache.set_raw("ingestion:satellite_meta", json.dumps(meta), ttl=1800)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Scheduler lifecycle
# ---------------------------------------------------------------------------

_scheduler: AsyncIOScheduler | None = None


def create_scheduler() -> AsyncIOScheduler:
    """Create and configure the APScheduler instance."""
    global _scheduler
    scheduler = AsyncIOScheduler(timezone="UTC")

    scheduler.add_job(
        job_poll_imd,
        trigger=IntervalTrigger(minutes=POLL_INTERVAL_MINUTES),
        id="imd_poll",
        name="IMD Advisory Poll",
        replace_existing=True,
        misfire_grace_time=120,
    )
    scheduler.add_job(
        job_poll_jtwc,
        trigger=IntervalTrigger(minutes=POLL_INTERVAL_MINUTES),
        id="jtwc_poll",
        name="JTWC Track Poll",
        replace_existing=True,
        misfire_grace_time=120,
    )
    scheduler.add_job(
        job_fetch_satellite,
        trigger=IntervalTrigger(minutes=SATELLITE_INTERVAL_MINUTES),
        id="satellite_fetch",
        name="Satellite IR Fetch",
        replace_existing=True,
        misfire_grace_time=300,
    )

    _scheduler = scheduler
    return scheduler


async def start_scheduler() -> None:
    """Start scheduler and run all jobs immediately on first boot."""
    scheduler = create_scheduler()
    scheduler.start()
    logger.info("APScheduler started — poll interval: %d min", POLL_INTERVAL_MINUTES)

    # Prime data immediately without waiting for first interval
    await asyncio.gather(
        job_poll_imd(),
        job_poll_jtwc(),
        job_fetch_satellite(),
        return_exceptions=True,
    )


async def stop_scheduler() -> None:
    """Gracefully shut down the scheduler."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
