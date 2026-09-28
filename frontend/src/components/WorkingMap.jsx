import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ---------------------------------------------------------------------------
// HEADING CONE (directional convex hull)
//
// Builds a cone that fans out from the last observed position in the direction
// the cyclone is heading.  The cone is constructed by:
//   1. Computing the mean heading vector from the forecast track sequence
//   2. Placing N perp-offset points along each forecast step (±halfWidthKm)
//   3. Running Graham-scan convex hull over all those points so the result is
//      always a valid, non-self-intersecting polygon
//
// All coordinates are in MapLibre order: [lng, lat]
// ---------------------------------------------------------------------------

/** Degrees → radians */
const rad = d => (d * Math.PI) / 180;
/** Radians → degrees */
const deg = r => (r * 180) / Math.PI;

/** Move a point [lng,lat] by (dxKm, dyKm) in km — flat-earth approx */
function offsetKm(lng, lat, dxKm, dyKm) {
  const dLat = dyKm / 111;
  const dLng = dxKm / (111 * Math.cos(rad(lat)));
  return [lng + dLng, lat + dLat];
}

/**
 * Build the directional cone polygon from forecast track.
 *
 * @param {number[]} originLngLat  - [lng, lat] of last detected position
 * @param {Array}    forecastPts   - [[lat,lon],...] forecast track points
 * @param {number}   halfWidthKm  - half-width of the cone at the tip (km)
 * @param {number}   growthKmPerKm - how fast the cone widens per km of travel
 * @returns {number[][]}  closed ring [[lng,lat],...]
 */
function buildDirectionalCone(originLngLat, forecastPts, halfWidthKm = 60, growthKmPerKm = 0.35) {
  if (!forecastPts || forecastPts.length === 0) return [];

  // Normalise forecast to [lng, lat] order
  const fcast = forecastPts.map(pt =>
    Array.isArray(pt) ? [pt[1], pt[0]] : [pt.lon, pt.lat]
  ).filter(([ln, la]) => !isNaN(ln) && !isNaN(la));

  if (fcast.length === 0) return [];

  // Build a chain: origin → forecast pts
  const chain = [originLngLat, ...fcast];

  // Collect left + right edge points for each segment
  const leftEdge  = [];
  const rightEdge = [];

  let distSoFar = 0;

  for (let i = 0; i < chain.length - 1; i++) {
    const [lng0, lat0] = chain[i];
    const [lng1, lat1] = chain[i + 1];

    // Segment vector in degrees
    const dLng = lng1 - lng0;
    const dLat = lat1 - lat0;

    // Segment length in km (approximate)
    const dxKm = dLng * 111 * Math.cos(rad(lat0));
    const dyKm = dLat * 111;
    const segLen = Math.sqrt(dxKm * dxKm + dyKm * dyKm) || 1e-9;

    // Perpendicular unit vector (rotate 90°)
    const perpX = -dyKm / segLen;
    const perpY =  dxKm / segLen;

    // Width at the END of this segment
    distSoFar += segLen;
    const halfW = halfWidthKm + distSoFar * growthKmPerKm;

    // Push end-point offset left and right
    const [lLng, lLat] = offsetKm(lng1, lat1, perpX * halfW,  perpY * halfW);
    const [rLng, rLat] = offsetKm(lng1, lat1, -perpX * halfW, -perpY * halfW);

    leftEdge.push([lLng, lLat]);
    rightEdge.push([rLng, rLat]);
  }

  // The tip of the cone is the origin itself (point, zero width)
  // Ring: origin → right edge forward → left edge backward → close
  const ring = [
    originLngLat,
    ...rightEdge,
    ...leftEdge.slice().reverse(),
    originLngLat,  // close
  ];

  return ring;
}

/** Graham-scan convex hull — used as a fallback if the cone ring is jagged */
function convexHull(points) {
  if (points.length < 3) return points.length ? [...points, points[0]] : [];
  const cross = (O, A, B) =>
    (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  const hull = [...lower, ...upper];
  if (hull.length > 0) hull.push(hull[0]);
  return hull;
}

// ---------------------------------------------------------------------------
// WorkingMap component
// ---------------------------------------------------------------------------
export default function WorkingMap({
  pastTrack = [],
  forecastTrack = [],
  districts = [],
  stormName = 'Cyclone',
  windKt = null,          // optional: wind speed from module1 for cone width
}) {
  const mapRef          = useRef(null);
  const mapInstanceRef  = useRef(null);
  const markersRef      = useRef([]);
  const cycloneMarkerRef = useRef(null);
  const [styleLoaded, setStyleLoaded] = useState(false);

  // ── 1. Initialise map (once) ──────────────────────────────────────────────
  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [85.5, 19.5],
      zoom: 6,
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    map.on('style.load', () => {
      mapInstanceRef.current = map;
      setStyleLoaded(true);
    });

    map.on('error', e => console.error('Map error:', e));

    return () => {};
  }, []);

  // ── 2. District risk zone markers ────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !styleLoaded) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (districts.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    let count = 0;

    districts.forEach(dist => {
      const lat = parseFloat(dist.lat);
      const lon = parseFloat(dist.lon);
      if (isNaN(lat) || isNaN(lon)) return;

      const zone   = dist.zone || 'Yellow';
      const colors = { Red: '#dc2626', Orange: '#ea580c', Yellow: '#eab308' };
      const color  = colors[zone] || '#eab308';
      const emoji  = zone === 'Red' ? '🔴' : zone === 'Orange' ? '🟠' : '🟡';

      const el = document.createElement('div');
      Object.assign(el.style, {
        width: '44px', height: '44px',
        backgroundColor: color,
        border: '3px solid white',
        borderRadius: '50%',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '22px',
        boxShadow: `0 0 16px ${color}cc`,
      });
      el.innerHTML = emoji;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lon, lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div style="font-family:Arial;padding:12px;min-width:200px;">
              <strong style="color:${color};">${zone} ZONE</strong>
              <hr style="margin:5px 0;border:none;border-top:1px solid #ddd;">
              <div style="font-size:12px;">
                <div><strong>${dist.name}</strong>, ${dist.state}</div>
                <div>Risk: ${dist.risk_score}/10</div>
                <div>Distance: ${(dist.distance_to_path_km||0).toFixed(1)} km</div>
                <div>Damage: $${(dist.estimated_damage_usd_m||0).toFixed(0)}M</div>
                <div style="margin-top:6px;padding:6px;background:${color}22;border-left:3px solid ${color};border-radius:3px;">
                  ${dist.action || ''}
                </div>
              </div>
            </div>
          `)
        )
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([lon, lat]);
      count++;
    });

    if (count > 0) {
      try { map.fitBounds(bounds, { padding: 60, maxZoom: 9, duration: 800 }); }
      catch (e) { console.warn('fitBounds:', e.message); }
    }
  }, [districts, styleLoaded]);

  // ── 3. Track lines ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !styleLoaded) return;

    ['past-track', 'forecast-track'].forEach(id => {
      if (map.getLayer(id))   map.removeLayer(id);
      if (map.getSource(id))  map.removeSource(id);
    });

    const toCoords = arr =>
      arr.map(pt => Array.isArray(pt) ? [pt[1], pt[0]] : [pt.lon, pt.lat])
         .filter(([ln, la]) => ln && la && !isNaN(ln) && !isNaN(la));

    // Observed track — cyan solid
    const pastCoords = toCoords(pastTrack);
    if (pastCoords.length > 0) {
      map.addSource('past-track', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: pastCoords } },
      });
      map.addLayer({
        id: 'past-track', type: 'line', source: 'past-track',
        paint: { 'line-color': '#06b6d4', 'line-width': 3.5 },
      });
    }

    // Forecast track — amber dashed
    const fcastCoords = toCoords(forecastTrack);
    if (fcastCoords.length > 0) {
      map.addSource('forecast-track', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: fcastCoords } },
      });
      map.addLayer({
        id: 'forecast-track', type: 'line', source: 'forecast-track',
        paint: { 'line-color': '#f59e0b', 'line-width': 2.5, 'line-dasharray': [5, 5] },
      });
    }
  }, [pastTrack, forecastTrack, styleLoaded]);

  // ── 4. Directional Cone Hull (heading direction) ──────────────────────────
  //
  //  • Origin    : last point of pastTrack  (most recently detected location)
  //  • Direction : derived from forecastTrack sequence
  //  • Width     : grows with distance; scaled by module1 wind speed if provided
  //    (stronger storm → wider uncertainty cone)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !styleLoaded) return;

    // Remove old cone layers
    ['cone-fill', 'cone-outline', 'cone-outline-inner'].forEach(id => {
      if (map.getLayer(id))  map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });

    if (!pastTrack.length || !forecastTrack.length) return;

    // Last detected position
    const lastPt = pastTrack[pastTrack.length - 1];
    const originLat = Array.isArray(lastPt) ? lastPt[0] : lastPt.lat;
    const originLng = Array.isArray(lastPt) ? lastPt[1] : lastPt.lon;
    if (isNaN(originLat) || isNaN(originLng)) return;

    // Scale cone half-width by wind speed (module1): 34kt→50km, 185kt→110km
    const kt = windKt && !isNaN(windKt) ? Math.max(34, Math.min(185, windKt)) : 100;
    const halfW = 45 + ((kt - 34) / (185 - 34)) * 65;   // 45–110 km at tip
    const growth = 0.25 + ((kt - 34) / (185 - 34)) * 0.25; // 0.25–0.50 km/km

    const coneRing = buildDirectionalCone(
      [originLng, originLat],
      forecastTrack,
      halfW,
      growth
    );

    if (coneRing.length < 4) return;

    // Use convex hull of the raw cone to guarantee no self-intersections
    const hullRing = convexHull(coneRing.slice(0, -1)); // drop pre-existing closing pt

    const geojson = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [hullRing] },
    };

    map.addSource('cone-fill', { type: 'geojson', data: geojson });

    // Outer gradient-like fill — red near origin, transparent further out
    map.addLayer({
      id: 'cone-fill', type: 'fill', source: 'cone-fill',
      paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.10 },
    }, 'past-track');

    // Solid red outer border
    map.addLayer({
      id: 'cone-outline', type: 'line', source: 'cone-fill',
      paint: { 'line-color': '#ef4444', 'line-width': 2, 'line-opacity': 0.85, 'line-dasharray': [6, 4] },
    }, 'past-track');

    console.log(`✅ Directional cone drawn | halfW=${halfW.toFixed(0)}km | wind=${kt}kt`);
  }, [pastTrack, forecastTrack, windKt, styleLoaded]);

  // ── 5. Cyclone GIF marker at LAST DETECTED position ──────────────────────
  //
  //  Shows the actual cyclone.gif at pastTrack[last] — the most recently
  //  observed location.  Clicking opens an info popup.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !styleLoaded) return;

    if (cycloneMarkerRef.current) {
      cycloneMarkerRef.current.remove();
      cycloneMarkerRef.current = null;
    }

    if (!pastTrack || pastTrack.length === 0) return;

    // Last point = most recently detected position
    const lastPt = pastTrack[pastTrack.length - 1];
    const lat = Array.isArray(lastPt) ? lastPt[0] : lastPt.lat;
    const lon = Array.isArray(lastPt) ? lastPt[1] : lastPt.lon;
    if (isNaN(lat) || isNaN(lon)) return;

    const ktLabel = windKt ? `${Math.round(windKt)} kt` : '—';
    const kmhLabel = windKt ? `${Math.round(windKt * 1.852)} km/h` : '—';

    // Marker element — shows the animated GIF
    const el = document.createElement('div');
    Object.assign(el.style, {
      width: '90px', height: '90px',
      cursor: 'pointer',
      position: 'relative',
    });
    el.innerHTML = `
      <img
        src="/cyclone.gif"
        alt="Cyclone"
        style="
          width:90px; height:90px;
          filter: drop-shadow(0 0 12px rgba(239,68,68,0.9))
                  drop-shadow(0 0 24px rgba(239,68,68,0.6));
          border-radius:50%;
        "
      />
      <div style="
        position:absolute; bottom:-20px; left:50%; transform:translateX(-50%);
        background:rgba(239,68,68,0.85); color:white;
        font-size:10px; font-weight:bold; white-space:nowrap;
        padding:2px 6px; border-radius:10px;
        font-family:Arial,sans-serif;
        box-shadow:0 0 8px rgba(239,68,68,0.7);
      ">${stormName}</div>
    `;

    const popup = new maplibregl.Popup({ offset: 50, closeButton: true, closeOnClick: false })
      .setHTML(`
        <div style="
          font-family:Arial; padding:16px; min-width:240px;
          background:linear-gradient(135deg,#1e293b,#0f172a); color:#e2e8f0;
          border-radius:8px;
        ">
          <div style="text-align:center; margin-bottom:10px;">
            <img src="/cyclone.gif" style="width:64px;height:64px;border-radius:50%;
              filter:drop-shadow(0 0 8px rgba(239,68,68,0.8));"/>
          </div>
          <div style="text-align:center; margin-bottom:10px;">
            <span style="color:#ef4444; font-size:16px; font-weight:bold;">
              ${stormName} — Last Detected Position
            </span>
          </div>
          <hr style="border:none;border-top:1px solid #334155;margin:8px 0;">
          <div style="font-size:12px; line-height:1.8;">
            <div>📍 <b>Lat:</b> ${lat.toFixed(4)}°N &nbsp; <b>Lon:</b> ${lon.toFixed(4)}°E</div>
            <div>💨 <b>Wind:</b> ${ktLabel} &nbsp; (${kmhLabel})</div>
            <div style="margin-top:8px; padding:8px;
              background:rgba(239,68,68,0.12); border-left:3px solid #ef4444; border-radius:4px;">
              ⚠️ Red cone = forecast heading uncertainty zone
            </div>
          </div>
        </div>
      `);

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lon, lat])
      .setPopup(popup)
      .addTo(map);

    cycloneMarkerRef.current = marker;

    // Auto-show popup for 4 s on load
    setTimeout(() => {
      marker.togglePopup();
      setTimeout(() => {
        if (marker.getPopup().isOpen()) marker.togglePopup();
      }, 4000);
    }, 800);

    return () => {
      if (cycloneMarkerRef.current) {
        cycloneMarkerRef.current.remove();
        cycloneMarkerRef.current = null;
      }
    };
  }, [pastTrack, styleLoaded, stormName, windKt]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
      <div ref={mapRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg p-3 text-xs max-w-[180px]">
        <div className="font-semibold text-cyan-400 mb-2 flex items-center gap-1">
          <img src="/cyclone.gif" style={{width:18,height:18,borderRadius:'50%'}} alt="" />
          {stormName}
        </div>
        <div className="text-slate-300 space-y-1.5">
          <div className="flex items-center gap-2">
            <span style={{display:'inline-block', width:22, height:3, background:'#06b6d4', borderRadius:2}}/>
            <span>Observed track</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{display:'inline-block', width:22, height:3, background:'#f59e0b', borderRadius:2}}/>
            <span>Forecast track</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-700">
            <span style={{display:'inline-block', width:22, height:14,
              border:'2px dashed #ef4444', borderRadius:3,
              background:'rgba(239,68,68,0.15)'}}/>
            <span className="text-red-300">Heading cone</span>
          </div>
          {districts.length > 0 && (
            <div className="pt-1 border-t border-slate-700 space-y-1">
              {['Red','Orange','Yellow'].map(z => {
                const c = districts.filter(d => d.zone === z).length;
                return c > 0 ? (
                  <div key={z}>
                    {z==='Red'?'🔴':z==='Orange'?'🟠':'🟡'} {z}: {c}
                  </div>
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
