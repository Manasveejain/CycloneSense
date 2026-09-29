"""
Emergency Alert Gateway
========================
Module 5 — Multi-channel emergency alert dispatch with:

  1. Common Alerting Protocol (CAP 1.2) XML generation
  2. Twilio SMS/Voice gateway (configurable via env vars)
  3. Webhook dispatcher (POST to any URL)
  4. Multilingual alert text in 7 Indian regional languages:
       Hindi, Bengali, Telugu, Tamil, Odia, Gujarati, Marathi

All alert dispatches are logged and cached in Redis to prevent
duplicate sends within the DEDUP_WINDOW_SECONDS window.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom

import httpx

logger = logging.getLogger("cyclonesense.alerts")

# ---------------------------------------------------------------------------
# Environment configuration
# ---------------------------------------------------------------------------
TWILIO_ACCOUNT_SID  = os.getenv("TWILIO_ACCOUNT_SID",  "")
TWILIO_AUTH_TOKEN   = os.getenv("TWILIO_AUTH_TOKEN",    "")
TWILIO_FROM_NUMBER  = os.getenv("TWILIO_FROM_NUMBER",   "+15005550006")   # Twilio test number
ALERT_WEBHOOK_URL   = os.getenv("ALERT_WEBHOOK_URL",    "")
DEDUP_WINDOW_SECONDS = int(os.getenv("DEDUP_WINDOW_SECONDS", "300"))       # 5-min dedup

# Alert recipient phone numbers (comma-separated in env)
ALERT_RECIPIENTS = [
    n.strip() for n in os.getenv("ALERT_RECIPIENTS", "").split(",") if n.strip()
]

# CAP sender info
CAP_SENDER        = os.getenv("CAP_SENDER",        "cyclonesense@imd.gov.in")
CAP_SENDER_NAME   = os.getenv("CAP_SENDER_NAME",   "CycloneSense Early Warning System")
CAP_WEB_URL       = os.getenv("CAP_WEB_URL",       "https://mausam.imd.gov.in")


# ---------------------------------------------------------------------------
# Multilingual alert templates  (7 Indian regional languages)
# ---------------------------------------------------------------------------

LANGUAGE_TEMPLATES: dict[str, dict[str, str]] = {
    "hi": {  # Hindi
        "name":    "हिन्दी",
        "urgent":  "⚠️ आपातकालीन चेतावनी",
        "template": (
            "🌀 {storm_name} चक्रवात चेतावनी | क्षेत्र: {district}, {state} | "
            "खतरा क्षेत्र: {zone} | हवा: {wind_kt} नॉट्स | "
            "अनुमानित क्षति: ₹{damage_inr_cr} करोड़ | "
            "तत्काल कार्रवाई: {action} | CycloneSense IMD"
        ),
    },
    "bn": {  # Bengali
        "name":    "বাংলা",
        "urgent":  "⚠️ জরুরি সতর্কতা",
        "template": (
            "🌀 {storm_name} ঘূর্ণিঝড় সতর্কতা | এলাকা: {district}, {state} | "
            "বিপদ অঞ্চল: {zone} | বায়ু: {wind_kt} নট | "
            "আনুমানিক ক্ষতি: ₹{damage_inr_cr} কোটি | "
            "তাৎক্ষণিক পদক্ষেপ: {action} | CycloneSense IMD"
        ),
    },
    "te": {  # Telugu
        "name":    "తెలుగు",
        "urgent":  "⚠️ అత్యవసర హెచ్చరిక",
        "template": (
            "🌀 {storm_name} తుఫాను హెచ్చరిక | ప్రాంతం: {district}, {state} | "
            "ప్రమాద జోన్: {zone} | గాలి: {wind_kt} నాట్లు | "
            "అంచనా నష్టం: ₹{damage_inr_cr} కోట్లు | "
            "తక్షణ చర్య: {action} | CycloneSense IMD"
        ),
    },
    "ta": {  # Tamil
        "name":    "தமிழ்",
        "urgent":  "⚠️ அவசர எச்சரிக்கை",
        "template": (
            "🌀 {storm_name} புயல் எச்சரிக்கை | பகுதி: {district}, {state} | "
            "ஆபத்து மண்டலம்: {zone} | காற்று: {wind_kt} நாட்டிகல் | "
            "மதிப்பிடப்பட்ட சேதம்: ₹{damage_inr_cr} கோடி | "
            "உடனடி நடவடிக்கை: {action} | CycloneSense IMD"
        ),
    },
    "or": {  # Odia
        "name":    "ଓଡ଼ିଆ",
        "urgent":  "⚠️ ଜରୁରୀ ସତର୍କତା",
        "template": (
            "🌀 {storm_name} ବାତ୍ୟା ସତର୍କତା | ଅଞ୍ଚଳ: {district}, {state} | "
            "ବିପଦ ଜୋନ: {zone} | ପବନ: {wind_kt} ନଟ | "
            "ଆକଳନ କ୍ଷତି: ₹{damage_inr_cr} କୋଟି | "
            "ତୁରନ୍ତ କାର୍ଯ୍ୟ: {action} | CycloneSense IMD"
        ),
    },
    "gu": {  # Gujarati
        "name":    "ગુજરાતી",
        "urgent":  "⚠️ કટોકટી ચેતવણી",
        "template": (
            "🌀 {storm_name} વાવાઝોડા ચેતવણી | વિસ્તાર: {district}, {state} | "
            "જોખમ ઝોન: {zone} | પવન: {wind_kt} નોટ્સ | "
            "અંદાજિત નુકસાન: ₹{damage_inr_cr} કરોડ | "
            "તાત્કાલિક પગલું: {action} | CycloneSense IMD"
        ),
    },
    "mr": {  # Marathi
        "name":    "मराठी",
        "urgent":  "⚠️ आपत्कालीन इशारा",
        "template": (
            "🌀 {storm_name} चक्रीवादळ इशारा | क्षेत्र: {district}, {state} | "
            "धोका क्षेत्र: {zone} | वारा: {wind_kt} नॉट्स | "
            "अंदाजित नुकसान: ₹{damage_inr_cr} कोटी | "
            "तत्काळ कारवाई: {action} | CycloneSense IMD"
        ),
    },
    "en": {  # English (always included)
        "name":    "English",
        "urgent":  "⚠️ EMERGENCY CYCLONE ALERT",
        "template": (
            "🌀 {storm_name} CYCLONE WARNING | Area: {district}, {state} | "
            "Hazard Zone: {zone} | Wind: {wind_kt} kt | "
            "Est. Damage: ₹{damage_inr_cr} Cr | "
            "Immediate Action: {action} | CycloneSense IMD"
        ),
    },
}

# Language mapping per Indian state
STATE_LANGUAGE_MAP: dict[str, list[str]] = {
    "Odisha":           ["or", "hi", "en"],
    "West Bengal":      ["bn", "hi", "en"],
    "Andhra Pradesh":   ["te", "hi", "en"],
    "Tamil Nadu":       ["ta", "en"],
    "Gujarat":          ["gu", "hi", "en"],
    "Maharashtra":      ["mr", "hi", "en"],
    "Kerala":           ["ta", "en"],
    "Karnataka":        ["te", "en"],
}


# ---------------------------------------------------------------------------
# CAP 1.2 XML builder
# ---------------------------------------------------------------------------

def build_cap_xml(
    storm_name: str,
    districts: list[dict],
    wind_kt: float,
    issued_at: datetime | None = None,
) -> str:
    """
    Build a CAP 1.2 compliant XML alert document covering all affected districts.
    Returns a pretty-printed UTF-8 XML string.
    """
    now = issued_at or datetime.now(timezone.utc)
    expires = now + timedelta(hours=24)

    # Root <alert> element
    alert = Element("alert")
    alert.set("xmlns", "urn:oasis:names:tc:emergency:cap:1.2")

    SubElement(alert, "identifier").text = f"cyclonesense-{uuid.uuid4().hex[:12]}"
    SubElement(alert, "sender").text     = CAP_SENDER
    SubElement(alert, "sent").text       = now.strftime("%Y-%m-%dT%H:%M:%S+00:00")
    SubElement(alert, "status").text     = "Actual"
    SubElement(alert, "msgType").text    = "Alert"
    SubElement(alert, "scope").text      = "Public"
    SubElement(alert, "source").text     = CAP_SENDER_NAME
    SubElement(alert, "note").text       = (
        f"Auto-generated by CycloneSense ML Pipeline | "
        f"Storm: {storm_name} | Wind: {wind_kt:.0f} kt"
    )

    # One <info> block per affected district
    for d in districts:
        zone     = d.get("zone", "Yellow")
        severity = {"Red": "Extreme", "Orange": "Severe", "Yellow": "Moderate"}.get(zone, "Minor")
        urgency  = {"Red": "Immediate", "Orange": "Expected", "Yellow": "Future"}.get(zone, "Future")
        cert     = {"Red": "Observed", "Orange": "Likely", "Yellow": "Possible"}.get(zone, "Possible")

        info = SubElement(alert, "info")
        SubElement(info, "language").text    = "en-IN"
        SubElement(info, "category").text    = "Met"
        SubElement(info, "event").text       = f"{storm_name} Cyclonic Storm"
        SubElement(info, "responseType").text = "Shelter" if zone == "Red" else "Prepare"
        SubElement(info, "urgency").text     = urgency
        SubElement(info, "severity").text    = severity
        SubElement(info, "certainty").text   = cert
        SubElement(info, "onset").text       = now.strftime("%Y-%m-%dT%H:%M:%S+00:00")
        SubElement(info, "expires").text     = expires.strftime("%Y-%m-%dT%H:%M:%S+00:00")
        SubElement(info, "senderName").text  = CAP_SENDER_NAME
        SubElement(info, "headline").text    = (
            f"Cyclone {storm_name}: {severity} Warning for {d.get('name')}, {d.get('state')}"
        )
        SubElement(info, "description").text = (
            f"Cyclone {storm_name} is approaching {d.get('name')}, {d.get('state')}. "
            f"Maximum sustained winds: {wind_kt:.0f} kt. "
            f"Risk Zone: {zone}. "
            f"Estimated damage: ₹{d.get('estimated_damage_inr_crores', 0):.0f} Crores. "
            f"Recommended action: {d.get('action', 'Follow local authority instructions')}."
        )
        SubElement(info, "instruction").text = d.get("action", "Follow local authority instructions")
        SubElement(info, "web").text         = CAP_WEB_URL

        # <parameter> for wind speed
        param = SubElement(info, "parameter")
        SubElement(param, "valueName").text  = "MaxWindSpeedKt"
        SubElement(param, "value").text      = str(int(wind_kt))

        # <area> block with polygon (bounding box ±0.5° around district centre)
        area = SubElement(info, "area")
        lat  = float(d.get("lat", 0))
        lon  = float(d.get("lon", 0))
        SubElement(area, "areaDesc").text = f"{d.get('name')}, {d.get('state')}, India"
        SubElement(area, "polygon").text  = (
            f"{lat+0.5},{lon-0.5} {lat+0.5},{lon+0.5} "
            f"{lat-0.5},{lon+0.5} {lat-0.5},{lon-0.5} {lat+0.5},{lon-0.5}"
        )
        SubElement(area, "geocode").text = ""   # placeholder for SAME code

    # Pretty-print
    raw_xml  = tostring(alert, encoding="unicode")
    dom      = minidom.parseString(raw_xml)
    return dom.toprettyxml(indent="  ", encoding=None)


# ---------------------------------------------------------------------------
# Multilingual text builder
# ---------------------------------------------------------------------------

def build_alert_texts(
    storm_name: str,
    district: dict,
    languages: list[str] | None = None,
) -> dict[str, str]:
    """
    Build alert text in relevant regional languages for a single district.
    Returns {lang_code: text}.
    """
    state    = district.get("state", "India")
    langs    = languages or STATE_LANGUAGE_MAP.get(state, ["hi", "en"])
    if "en" not in langs:
        langs = langs + ["en"]

    texts: dict[str, str] = {}
    params = {
        "storm_name":      storm_name,
        "district":        district.get("name", ""),
        "state":           state,
        "zone":            district.get("zone", "Yellow"),
        "wind_kt":         int(district.get("predicted_wind_kt", district.get("wind_kt", 0)) or 0),
        "damage_inr_cr":   int(district.get("estimated_damage_inr_crores",
                               district.get("estimated_damage_usd_m", 0) * 83 / 10) or 0),
        "action":          district.get("action", "Follow local authority instructions"),
    }

    for lang in langs:
        tmpl = LANGUAGE_TEMPLATES.get(lang, LANGUAGE_TEMPLATES["en"])
        texts[lang] = tmpl["template"].format(**params)

    return texts


# ---------------------------------------------------------------------------
# Dispatch channels
# ---------------------------------------------------------------------------

async def _send_twilio_sms(to: str, body: str) -> dict[str, Any]:
    """Send SMS via Twilio REST API."""
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        return {"status": "skipped", "reason": "Twilio credentials not configured"}

    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                url,
                data={"From": TWILIO_FROM_NUMBER, "To": to, "Body": body},
                auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
                timeout=15.0,
            )
            data = resp.json()
            logger.info("Twilio SMS → %s: SID=%s status=%s", to, data.get("sid"), data.get("status"))
            return {"status": "sent", "sid": data.get("sid"), "to": to}
        except Exception as exc:
            logger.error("Twilio error for %s: %s", to, exc)
            return {"status": "error", "reason": str(exc), "to": to}


async def _send_webhook(payload: dict) -> dict[str, Any]:
    """POST alert payload to configured webhook URL."""
    if not ALERT_WEBHOOK_URL:
        return {"status": "skipped", "reason": "ALERT_WEBHOOK_URL not configured"}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                ALERT_WEBHOOK_URL,
                json=payload,
                timeout=10.0,
                headers={"Content-Type": "application/json", "X-Source": "CycloneSense"},
            )
            logger.info("Webhook → %s: HTTP %d", ALERT_WEBHOOK_URL, resp.status_code)
            return {"status": "sent", "http_status": resp.status_code}
        except Exception as exc:
            logger.error("Webhook error: %s", exc)
            return {"status": "error", "reason": str(exc)}


# ---------------------------------------------------------------------------
# Main alert dispatcher
# ---------------------------------------------------------------------------

async def dispatch_alerts(
    storm_name: str,
    districts: list[dict],
    wind_kt: float,
    channels: list[str] | None = None,
) -> dict[str, Any]:
    """
    Dispatch emergency alerts through all configured channels.

    Parameters
    ----------
    storm_name  : e.g. "Cyclone Fani"
    districts   : list of district risk dicts (from Module 3)
    wind_kt     : peak wind speed in knots (from Module 1)
    channels    : ["sms", "webhook", "cap"] — defaults to all

    Returns
    -------
    Summary dict with per-channel results and CAP XML.
    """
    if channels is None:
        channels = ["sms", "webhook", "cap"]

    issued_at = datetime.now(timezone.utc)
    results: dict[str, Any] = {
        "storm_name":  storm_name,
        "issued_at":   issued_at.isoformat(),
        "wind_kt":     wind_kt,
        "districts":   len(districts),
        "channels":    {},
        "multilingual_alerts": {},
    }

    # ── Deduplication ────────────────────────────────────────────────────
    dedup_key = f"alert_dispatch:{hashlib.md5(storm_name.encode()).hexdigest()}"
    try:
        from app.services.cache import cache
        if await cache.exists(dedup_key):
            logger.info("Alert deduplication: skipping within %ds window", DEDUP_WINDOW_SECONDS)
            results["deduplication"] = "skipped – too recent"
            return results
        await cache.set(dedup_key, 1, ttl=DEDUP_WINDOW_SECONDS)
    except Exception:
        pass  # never block on cache errors

    # ── CAP XML ──────────────────────────────────────────────────────────
    if "cap" in channels:
        try:
            cap_xml = build_cap_xml(storm_name, districts, wind_kt, issued_at)
            results["channels"]["cap"] = {"status": "generated", "bytes": len(cap_xml)}
            results["cap_xml"] = cap_xml
            logger.info("CAP XML generated: %d bytes for %d districts", len(cap_xml), len(districts))
        except Exception as exc:
            results["channels"]["cap"] = {"status": "error", "reason": str(exc)}
            logger.error("CAP XML error: %s", exc)

    # ── Multilingual texts ────────────────────────────────────────────────
    ml_texts: dict[str, dict[str, str]] = {}
    for d in districts:
        name  = d.get("name", "unknown")
        texts = build_alert_texts(storm_name, d)
        ml_texts[name] = texts

    results["multilingual_alerts"] = ml_texts
    logger.info("Multilingual alerts built for %d districts", len(ml_texts))

    # ── Twilio SMS ────────────────────────────────────────────────────────
    if "sms" in channels and ALERT_RECIPIENTS:
        sms_results = []
        for district in districts:
            texts = ml_texts.get(district.get("name", ""), {})
            body  = texts.get("en", "")[:1600]  # Twilio 1600-char limit
            for recipient in ALERT_RECIPIENTS:
                res = await _send_twilio_sms(recipient, body)
                sms_results.append(res)
        results["channels"]["sms"] = sms_results
    elif "sms" in channels:
        results["channels"]["sms"] = {"status": "skipped", "reason": "No recipients configured"}

    # ── Webhook ───────────────────────────────────────────────────────────
    if "webhook" in channels:
        webhook_payload = {
            "event":       "cyclone_alert",
            "storm_name":  storm_name,
            "wind_kt":     wind_kt,
            "issued_at":   issued_at.isoformat(),
            "districts":   [
                {
                    "name":  d.get("name"),
                    "state": d.get("state"),
                    "zone":  d.get("zone"),
                    "alert": ml_texts.get(d.get("name", ""), {}).get("en", ""),
                }
                for d in districts
            ],
        }
        results["channels"]["webhook"] = await _send_webhook(webhook_payload)

    return results
