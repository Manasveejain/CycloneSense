/**
 * GISMap.jsx — Full WebGL/Leaflet GIS Layer Stack
 * ================================================
 * Layers (bottom → top):
 *   1. MapLibre GL dark base map (WebGL rendered)
 *   2. 160×200 spatial risk heatmap  (WebGL canvas, CPU-generated grid)
 *   3. District risk zone circles    (MapLibre circle layer)
 *   4. Animated uncertainty cone     (pulsing fill + dashed border, CSS animation)
 *   5. Observed track                (cyan polyline)
 *   6. Forecast track                (amber dashed polyline)
 *   7. Cyclone GIF marker            (DOM element at last pastTrack point)
 *   8. Forecast waypoint markers     (numbered dots along forecast track)
 *
 * Props
 * -----
 *   pastTrack     [[lat,lon], ...]
 *   forecastTrack [[lat,lon], ...]
 *   districts     [{name,state,lat,lon,zone,risk_score,distance_to_path_km,
 *                   estimated_damage_usd_m,population_affected,action}, ...]
 *   stormName     string
 *   windKt        number (from Module 1)
 *   onMapReady    (mapInstance) => void  (optional)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ─── helpers ────────────────────────────────────────────────────────────────

const rad = d => (d * Math.PI) / 180;

function lngLatToPixel(lng, lat, bounds, canvasW, canvasH) {
  const [w, s, e, n] = bounds;
  const x = ((lng - w) / (e - w)) * canvasW;
  const y = ((n - lat) / (n - s)) * canvasH;
  return [x, y];
}

/** Gaussian kernel heat weight for a single grid cell */
function heatWeight(cellLng, cellLat, points, sigma = 0.8) {
  let total = 0;
  for (const { lng, lat, weight = 1 } of points) {
    const dx = (cellLng - lng) * 111 * Math.cos(rad(cellLat));
    const dy = (cellLat - lat) * 111;
    const d2 = dx * dx + dy * dy;
    total += weight * Math.exp(-d2 / (2 * sigma * sigma));
  }
  return total;
}

/**
 * Build a 160×200 risk heatmap ImageData from district + track data.
 * Uses a Gaussian kernel centred on each risk point.
 */
function buildHeatmapCanvas(districts, forecastTrack, pastTrack, bounds) {
  const W = 160, H = 200;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);

  const [west, south, east, north] = bounds;
  const lngStep = (east - west) / W;
  const latStep = (north - south) / H;

  // Build weighted heat source list
  const heatPoints = [];
  const zoneWeights = { Red: 3.0, Orange: 1.8, Yellow: 0.9 };
  districts.forEach(d => heatPoints.push({
    lng: parseFloat(d.lon), lat: parseFloat(d.lat),
    weight: zoneWeights[d.zone] || 1,
  }));
  // Forecast track adds lighter heat along the path
  forecastTrack.forEach(pt => {
    const lat = Array.isArray(pt) ? pt[0] : pt.lat;
    const lng = Array.isArray(pt) ? pt[1] : pt.lon;
    if (!isNaN(lat) && !isNaN(lng)) heatPoints.push({ lng, lat, weight: 1.2 });
  });

  // Find max for normalisation
  let maxV = 0;
  const grid = new Float32Array(W * H);
  for (let gy = 0; gy < H; gy++) {
    const cellLat = north - gy * latStep;
    for (let gx = 0; gx < W; gx++) {
      const cellLng = west + gx * lngStep;
      const v = heatWeight(cellLng, cellLat, heatPoints, 0.7);
      grid[gy * W + gx] = v;
      if (v > maxV) maxV = v;
    }
  }

  if (maxV === 0) return canvas;

  // Colour map: transparent → yellow → orange → red (alpha max 180/255)
  for (let i = 0; i < grid.length; i++) {
    const t = grid[i] / maxV;
    if (t < 0.05) { img.data[i * 4 + 3] = 0; continue; }
    // interpolate yellow(255,240,0) → orange(255,120,0) → red(220,20,20)
    let r, g, b;
    if (t < 0.5) {
      const s = t / 0.5;
      r = 255; g = Math.round(240 - s * 120); b = 0;
    } else {
      const s = (t - 0.5) / 0.5;
      r = Math.round(255 - s * 35); g = Math.round(120 - s * 100); b = Math.round(s * 20);
    }
    const a = Math.round(30 + t * 150);
    img.data[i * 4]     = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ─── directional cone builder (same logic as WorkingMap) ────────────────────

function offsetKm(lng, lat, dxKm, dyKm) {
  return [lng + dxKm / (111 * Math.cos(rad(lat))), lat + dyKm / 111];
}

function buildConeRing(originLngLat, forecastPts, halfW, growth) {
  const fcast = forecastPts
    .map(pt => Array.isArray(pt) ? [pt[1], pt[0]] : [pt.lon, pt.lat])
    .filter(([ln, la]) => !isNaN(ln) && !isNaN(la));
  if (!fcast.length) return [];

  const chain = [originLngLat, ...fcast];
  const left = [], right = [];
  let dist = 0;

  for (let i = 0; i < chain.length - 1; i++) {
    const [lng0, lat0] = chain[i], [lng1, lat1] = chain[i + 1];
    const dxKm = (lng1 - lng0) * 111 * Math.cos(rad(lat0));
    const dyKm = (lat1 - lat0) * 111;
    const len  = Math.sqrt(dxKm * dxKm + dyKm * dyKm) || 1e-9;
    dist += len;
    const w = halfW + dist * growth;
    const px = -dyKm / len, py = dxKm / len;
    left.push(offsetKm(lng1, lat1,  px * w,  py * w));
    right.push(offsetKm(lng1, lat1, -px * w, -py * w));
  }
  return [originLngLat, ...right, ...left.reverse(), originLngLat];
}

function convexHull(pts) {
  if (pts.length < 3) return pts.length ? [...pts, pts[0]] : [];
  const cross = (O, A, B) => (A[0]-O[0])*(B[1]-O[1]) - (A[1]-O[1])*(B[0]-O[0]);
  const sorted = [...pts].sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  const lower = [], upper = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = sorted.length-1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  const hull = [...lower, ...upper];
  if (hull.length) hull.push(hull[0]);
  return hull;
}

// ─── layer IDs we manage ─────────────────────────────────────────────────────
const LAYER_IDS = [
  'heatmap-img',
  'district-circles', 'district-labels',
  'cone-fill', 'cone-outline',
  'past-track', 'past-track-points',
  'forecast-track', 'forecast-points',
];
const SOURCE_IDS = [
  'heatmap', 'districts', 'cone', 'past-track', 'forecast-track',
];

function safeRemove(map, ids, type) {
  ids.forEach(id => {
    try { if (map[`get${type}`](id)) map[`remove${type}`](id); } catch (_) {}
  });
}

/**
 * Find a base-map layer to insert our custom layers before.
 * We want the heatmap to sit underneath roads/labels, so we look for
 * the first layer whose id contains 'road', 'tunnel', 'bridge', or 'label'.
 * If nothing matches we return undefined — MapLibre then appends the layer on top.
 */
function findFirstRoadOrLabelLayer(map) {
  const candidates = ['road', 'tunnel', 'bridge', 'label', 'place', 'boundary', 'admin'];
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    for (const keyword of candidates) {
      if (layer.id.toLowerCase().includes(keyword)) return layer.id;
    }
  }
  return undefined; // append on top of base map, below our own layers
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GISMap({
  pastTrack    = [],
  forecastTrack = [],
  districts    = [],
  stormName    = 'Cyclone',
  windKt       = null,
  onMapReady   = null,
}) {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const markersRef     = useRef([]);
  const cycloneRef     = useRef(null);
  const heatCanvasRef  = useRef(null);
  const animFrameRef   = useRef(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(null);

  // ── init map ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [86.0, 20.0],
        zoom: 5.5,
        antialias: true,        // WebGL MSAA
        preserveDrawingBuffer: true,
      });
      map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

      map.on('style.load', () => {
        mapRef.current = map;
        setReady(true);
        onMapReady?.(map);
      });
      map.on('error', e => {
        const msg = e.error?.message ?? '';
        // Only surface fatal errors — skip "layer not found" / "source already exists" warnings
        if (msg.includes('non-existing layer') || msg.includes('already exists') || msg.includes('does not exist')) {
          console.warn('[GISMap] non-fatal layer warning:', msg);
          return;
        }
        console.error('MapLibre:', e);
        setMapError(msg);
      });
    } catch (e) {
      setMapError(e.message);
    }
    return () => {};
  }, []);

  // ── compute shared bounds from all data ─────────────────────────────────
  const getBounds = useCallback(() => {
    const all = [
      ...pastTrack.map(p => Array.isArray(p) ? [p[1], p[0]] : [p.lon, p.lat]),
      ...forecastTrack.map(p => Array.isArray(p) ? [p[1], p[0]] : [p.lon, p.lat]),
      ...districts.map(d => [parseFloat(d.lon), parseFloat(d.lat)]),
    ].filter(([ln, la]) => !isNaN(ln) && !isNaN(la));
    if (!all.length) return [83, 17, 92, 24];
    const lngs = all.map(p => p[0]), lats = all.map(p => p[1]);
    const pad = 1.5;
    return [
      Math.min(...lngs) - pad, Math.min(...lats) - pad,
      Math.max(...lngs) + pad, Math.max(...lats) + pad,
    ];
  }, [pastTrack, forecastTrack, districts]);

  // ── heatmap layer ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    safeRemove(map, ['heatmap-img'], 'Layer');
    safeRemove(map, ['heatmap'], 'Source');
    if (heatCanvasRef.current) {
      URL.revokeObjectURL(heatCanvasRef.current);
      heatCanvasRef.current = null;
    }

    if (!districts.length && !forecastTrack.length) return;

    const bounds = getBounds();
    const hCanvas = buildHeatmapCanvas(districts, forecastTrack, pastTrack, bounds);

    hCanvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      heatCanvasRef.current = url;

      map.addSource('heatmap', {
        type: 'image',
        url,
        coordinates: [
          [bounds[0], bounds[3]], // top-left  [lng, lat]
          [bounds[2], bounds[3]], // top-right
          [bounds[2], bounds[1]], // bottom-right
          [bounds[0], bounds[1]], // bottom-left
        ],
      });
      // Insert below the first road/label layer so heatmap sits under roads
      const beforeId = findFirstRoadOrLabelLayer(map);
      map.addLayer({
        id: 'heatmap-img', type: 'raster', source: 'heatmap',
        paint: { 'raster-opacity': 0.75, 'raster-resampling': 'linear' },
      }, beforeId);
    }, 'image/png');
  }, [districts, forecastTrack, pastTrack, ready]);

  // ── district circles ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Clear DOM markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    safeRemove(map, ['district-circles', 'district-labels'], 'Layer');
    safeRemove(map, ['districts'], 'Source');

    if (!districts.length) return;

    const features = districts.map(d => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [parseFloat(d.lon), parseFloat(d.lat)] },
      properties: {
        name:       d.name,
        state:      d.state,
        zone:       d.zone,
        risk_score: d.risk_score,
        damage:     (d.estimated_damage_usd_m || 0).toFixed(0),
        population: (d.population_affected  || 0).toLocaleString(),
        action:     d.action || '',
        color:      d.zone === 'Red' ? '#dc2626' : d.zone === 'Orange' ? '#ea580c' : '#eab308',
      },
    }));

    map.addSource('districts', { type: 'geojson', data: { type: 'FeatureCollection', features } });

    // WebGL circle layer — data-driven radius and colour
    map.addLayer({
      id: 'district-circles', type: 'circle', source: 'districts',
      paint: {
        'circle-radius':       ['interpolate', ['linear'], ['zoom'], 5, 10, 10, 22],
        'circle-color':        ['get', 'color'],
        'circle-opacity':      0.85,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-blur':         0.15,
      },
    });

    // Label layer
    map.addLayer({
      id: 'district-labels', type: 'symbol', source: 'districts',
      layout: {
        'text-field':  ['get', 'name'],
        'text-size':   11,
        'text-offset': [0, 1.8],
        'text-anchor': 'top',
      },
      paint: { 'text-color': '#e2e8f0', 'text-halo-color': '#0f172a', 'text-halo-width': 1.5 },
    });

    // Click popup
    map.on('click', 'district-circles', e => {
      const p = e.features[0].properties;
      const color = p.color;
      new maplibregl.Popup({ offset: 12 })
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(`
          <div style="font-family:Arial;padding:12px;min-width:210px;">
            <div style="font-size:13px;font-weight:bold;color:${color};margin-bottom:6px;">
              ${p.zone} ZONE — ${p.name}, ${p.state}
            </div>
            <div style="font-size:12px;line-height:1.7;">
              <div>🎯 Risk Score: <b>${p.risk_score}/10</b></div>
              <div>💰 Damage Est: <b>$${p.damage}M</b></div>
              <div>👥 Population: <b>${p.population}</b></div>
              <div style="margin-top:7px;padding:6px;background:${color}22;
                border-left:3px solid ${color};border-radius:3px;font-weight:bold;">
                ${p.action}
              </div>
            </div>
          </div>`)
        .addTo(map);
    });
    map.on('mouseenter', 'district-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'district-circles', () => { map.getCanvas().style.cursor = ''; });

    // Fit view
    const lngLats = features.map(f => f.geometry.coordinates);
    if (lngLats.length) {
      const bounds = lngLats.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(lngLats[0], lngLats[0])
      );
      map.fitBounds(bounds, { padding: 80, maxZoom: 9, duration: 900 });
    }
  }, [districts, ready]);

  // ── animated uncertainty cone ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !pastTrack.length || !forecastTrack.length) return;

    safeRemove(map, ['cone-fill', 'cone-outline'], 'Layer');
    safeRemove(map, ['cone'], 'Source');

    const last = pastTrack[pastTrack.length - 1];
    const originLat = Array.isArray(last) ? last[0] : last.lat;
    const originLng = Array.isArray(last) ? last[1] : last.lon;
    if (isNaN(originLat) || isNaN(originLng)) return;

    const kt   = Math.max(34, Math.min(185, windKt || 100));
    const halfW = 45 + ((kt - 34) / 151) * 65;
    const growth = 0.25 + ((kt - 34) / 151) * 0.25;

    const ring  = buildConeRing([originLng, originLat], forecastTrack, halfW, growth);
    if (ring.length < 4) return;
    const hull  = convexHull(ring.slice(0, -1));

    map.addSource('cone', {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [hull] } },
    });
    map.addLayer({ id: 'cone-fill', type: 'fill', source: 'cone',
      paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.08 },
    }, 'district-circles');
    map.addLayer({ id: 'cone-outline', type: 'line', source: 'cone',
      paint: { 'line-color': '#ef4444', 'line-width': 2,
               'line-opacity': 0.9, 'line-dasharray': [6, 4] },
    }, 'district-circles');

    // CSS-driven pulse animation on the fill opacity
    let frame = 0;
    const animate = () => {
      frame++;
      const opacity = 0.05 + 0.06 * Math.abs(Math.sin(frame * 0.03));
      try { map.setPaintProperty('cone-fill', 'fill-opacity', opacity); } catch (_) {}
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [pastTrack, forecastTrack, windKt, ready]);

  // ── track lines ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    safeRemove(map, ['past-track', 'past-track-points', 'forecast-track', 'forecast-points'], 'Layer');
    safeRemove(map, ['past-track', 'forecast-track'], 'Source');

    const toCoords = arr => arr
      .map(p => Array.isArray(p) ? [p[1], p[0]] : [p.lon, p.lat])
      .filter(([ln, la]) => !isNaN(ln) && !isNaN(la));

    const pastCoords = toCoords(pastTrack);
    if (pastCoords.length > 1) {
      map.addSource('past-track', {
        type: 'geojson',
        lineMetrics: true,   // required for line-gradient
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: pastCoords } },
      });
      map.addLayer({ id: 'past-track', type: 'line', source: 'past-track',
        paint: { 'line-color': '#06b6d4', 'line-width': 3.5,
                 'line-gradient': ['interpolate', ['linear'], ['line-progress'],
                   0, '#0e7490', 1, '#06b6d4'],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
    }

    const fcastCoords = toCoords(forecastTrack);
    if (fcastCoords.length > 1) {
      // Build point features for waypoint markers
      const wayptFeatures = fcastCoords.map((c, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: c },
        properties: { hour: (i + 1) * 6, index: i + 1 },
      }));

      map.addSource('forecast-track', { type: 'geojson', data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'LineString', coordinates: fcastCoords } },
          ...wayptFeatures,
        ],
      }});
      map.addLayer({ id: 'forecast-track', type: 'line', source: 'forecast-track',
        filter: ['==', '$type', 'LineString'],
        paint: { 'line-color': '#f59e0b', 'line-width': 2.5,
                 'line-dasharray': [5, 5], 'line-opacity': 0.9 },
        layout: { 'line-cap': 'round' },
      });
      // Numbered waypoint circles
      map.addLayer({ id: 'forecast-points', type: 'circle', source: 'forecast-track',
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 6, 'circle-color': '#f59e0b',
                 'circle-stroke-width': 2, 'circle-stroke-color': '#1e293b' },
      });
    }
  }, [pastTrack, forecastTrack, ready]);

  // ── cyclone GIF marker at last pastTrack point ────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !pastTrack.length) return;

    if (cycloneRef.current) { cycloneRef.current.remove(); cycloneRef.current = null; }

    const last = pastTrack[pastTrack.length - 1];
    const lat = Array.isArray(last) ? last[0] : last.lat;
    const lon = Array.isArray(last) ? last[1] : last.lon;
    if (isNaN(lat) || isNaN(lon)) return;

    const el = document.createElement('div');
    Object.assign(el.style, { width:'88px', height:'88px', cursor:'pointer', position:'relative' });
    el.innerHTML = `
      <img src="/cyclone.gif" alt="Cyclone" style="
        width:88px;height:88px;border-radius:50%;
        filter:drop-shadow(0 0 14px rgba(239,68,68,0.9)) drop-shadow(0 0 28px rgba(239,68,68,0.5));"/>
      <div style="position:absolute;bottom:-22px;left:50%;transform:translateX(-50%);
        background:rgba(239,68,68,0.88);color:#fff;font-size:10px;font-weight:bold;
        white-space:nowrap;padding:2px 7px;border-radius:10px;font-family:Arial;">
        ${stormName}
      </div>`;

    const ktLabel  = windKt ? `${Math.round(windKt)} kt` : '—';
    const popup = new maplibregl.Popup({ offset: 52 }).setHTML(`
      <div style="font-family:Arial;padding:14px;min-width:230px;
        background:linear-gradient(135deg,#1e293b,#0f172a);color:#e2e8f0;border-radius:8px;">
        <div style="text-align:center;margin-bottom:10px;">
          <img src="/cyclone.gif" style="width:56px;height:56px;border-radius:50%;
            filter:drop-shadow(0 0 8px rgba(239,68,68,0.8));"/>
        </div>
        <div style="text-align:center;color:#ef4444;font-size:15px;font-weight:bold;margin-bottom:8px;">
          ${stormName} — Last Detected Position
        </div>
        <hr style="border:none;border-top:1px solid #334155;margin:6px 0;">
        <div style="font-size:12px;line-height:1.9;">
          <div>📍 <b>Lat:</b> ${lat.toFixed(4)}°N &nbsp; <b>Lon:</b> ${lon.toFixed(4)}°E</div>
          <div>💨 <b>Wind:</b> ${ktLabel}</div>
          <div style="margin-top:8px;padding:7px;background:rgba(239,68,68,0.12);
            border-left:3px solid #ef4444;border-radius:4px;">
            ⚠️ Red cone = heading uncertainty zone
          </div>
        </div>
      </div>`);

    cycloneRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lon, lat]).setPopup(popup).addTo(map);

    setTimeout(() => {
      cycloneRef.current?.togglePopup();
      setTimeout(() => { if (cycloneRef.current?.getPopup().isOpen()) cycloneRef.current.togglePopup(); }, 4000);
    }, 800);

    return () => { cycloneRef.current?.remove(); cycloneRef.current = null; };
  }, [pastTrack, windKt, stormName, ready]);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-700/60 shadow-2xl bg-slate-950">
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-950/90 text-red-400 text-sm p-6">
          Map error: {mapError}
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />

      {/* Layer legend */}
      <div className="absolute top-3 left-3 z-10 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg p-3 text-xs space-y-1.5 max-w-[185px]">
        <div className="font-semibold text-cyan-400 flex items-center gap-1.5 mb-2">
          <img src="/cyclone.gif" style={{width:16,height:16,borderRadius:'50%'}} alt=""/>
          {stormName}
        </div>
        {[
          { color:'#06b6d4', label:'Observed track',   dash:false },
          { color:'#f59e0b', label:'Forecast track',   dash:true  },
          { color:'#ef4444', label:'Uncertainty cone', dash:true, fill:true },
        ].map(({color,label,dash,fill}) => (
          <div key={label} className="flex items-center gap-2">
            <span style={{
              display:'inline-block', width:22, height: fill ? 14 : 3,
              background: fill ? `${color}22` : color,
              border: fill ? `2px dashed ${color}` : 'none',
              borderRadius: fill ? 3 : 2,
            }}/>
            <span className="text-slate-300">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-700">
          <span style={{
            display:'inline-block',width:22,height:10,
            background:'linear-gradient(to right,rgba(234,179,8,0.4),rgba(239,68,68,0.7))',
            borderRadius:2,
          }}/>
          <span className="text-slate-300">Risk heatmap</span>
        </div>
        {districts.length > 0 && (
          <div className="pt-1 border-t border-slate-700 space-y-1">
            {['Red','Orange','Yellow'].map(z => {
              const c = districts.filter(d => d.zone === z).length;
              return c > 0 ? <div key={z}>{z==='Red'?'🔴':z==='Orange'?'🟠':'🟡'} {z}: {c}</div> : null;
            })}
          </div>
        )}
      </div>

      {/* WebGL badge */}
      <div className="absolute bottom-12 right-3 z-10 bg-slate-900/80 backdrop-blur
        border border-slate-700/50 rounded-md px-2 py-1 text-[10px] text-slate-400 font-mono">
        WebGL · MapLibre GL {maplibregl.version ?? ''}
      </div>
    </div>
  );
}
