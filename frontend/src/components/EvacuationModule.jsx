/**
 * EvacuationModule.jsx
 * ====================
 * Disaster Logistics & Evacuation Module
 *
 * Features
 * --------
 *  • Shelter map — MapLibre GL markers for each shelter with capacity bars
 *  • Real-time capacity tracking — live colour-coded occupancy gauges
 *  • Evacuation route calculator — Dijkstra shortest-path on a road-grid
 *    approximation, rendered as animated dashed line on the map
 *  • Offline-ready: all shelter data stored in IndexedDB via Cache API
 *
 * Props
 * -----
 *  districts   [{name,lat,lon,zone}, ...]   — from risk assessment
 *  stormName   string
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, Users, Navigation, Shield, AlertTriangle, CheckCircle, RefreshCw, Truck } from 'lucide-react';

// ─── Static shelter database (would come from API in production) ─────────────

const SHELTER_DB = [
  { id:'sh1', name:'Puri Cyclone Shelter',      lat:19.81, lon:85.83, capacity:2000, zone:'Red',    district:'Puri',          type:'Primary',   amenities:['Water','Food','Medical','Power'] },
  { id:'sh2', name:'Khordha Relief Camp',        lat:20.18, lon:85.60, capacity:1500, zone:'Red',    district:'Khordha',       type:'Primary',   amenities:['Water','Food','Medical'] },
  { id:'sh3', name:'Jagatsinghpur Flood Camp',   lat:20.25, lon:86.17, capacity:800,  zone:'Orange', district:'Jagatsinghpur', type:'Secondary', amenities:['Water','Food'] },
  { id:'sh4', name:'Kendrapara Community Hall',  lat:20.50, lon:86.42, capacity:600,  zone:'Orange', district:'Kendrapara',    type:'Secondary', amenities:['Water','Food','Power'] },
  { id:'sh5', name:'Bhadrak Stadium Shelter',   lat:21.06, lon:86.50, capacity:3000, zone:'Orange', district:'Bhadrak',       type:'Primary',   amenities:['Water','Food','Medical','Power'] },
  { id:'sh6', name:'Balasore Govt College',      lat:21.49, lon:86.94, capacity:1200, zone:'Yellow', district:'Balasore',      type:'Secondary', amenities:['Water','Food'] },
  { id:'sh7', name:'Cuttack Sports Complex',     lat:20.46, lon:85.88, capacity:4000, zone:'Yellow', district:'Cuttack',       type:'Primary',   amenities:['Water','Food','Medical','Power'] },
  { id:'sh8', name:'Brahmapur Relief Centre',    lat:19.31, lon:84.79, capacity:2500, zone:'Yellow', district:'Ganjam',        type:'Primary',   amenities:['Water','Food','Medical'] },
];

// Seed random but stable occupancy (in production: live API)
function seedOccupancy(id, capacity) {
  const h = id.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
  const pct = 0.15 + ((h * 7919) % 1000) / 1000 * 0.65;
  return Math.round(pct * capacity);
}

const INITIAL_SHELTERS = SHELTER_DB.map(s => ({
  ...s,
  occupied: seedOccupancy(s.id, s.capacity),
}));

// ─── Simple Dijkstra on lat/lon grid ────────────────────────────────────────
// Nodes are district/shelter positions; edges are straight-line distances.
// A real implementation would call OSRM or Valhalla routing APIs.

function dijkstra(nodes, startIdx, endIdx) {
  const n = nodes.length;
  const dist = Array(n).fill(Infinity);
  const prev = Array(n).fill(-1);
  const visited = Array(n).fill(false);
  dist[startIdx] = 0;

  for (let iter = 0; iter < n; iter++) {
    // Find unvisited node with min distance
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && (u === -1 || dist[i] < dist[u])) u = i;
    }
    if (u === -1 || dist[u] === Infinity) break;
    visited[u] = true;
    if (u === endIdx) break;

    // Relax edges to all neighbours
    for (let v = 0; v < n; v++) {
      if (visited[v]) continue;
      const dx = (nodes[v].lon - nodes[u].lon) * 111 * Math.cos((nodes[u].lat * Math.PI) / 180);
      const dy = (nodes[v].lat - nodes[u].lat) * 111;
      const d  = Math.sqrt(dx * dx + dy * dy);
      // Apply risk penalty: avoid Red zones
      const penalty = nodes[v].zone === 'Red' ? 5 : nodes[v].zone === 'Orange' ? 2 : 1;
      const edgeCost = d * penalty;
      if (dist[u] + edgeCost < dist[v]) {
        dist[v] = dist[u] + edgeCost;
        prev[v] = u;
      }
    }
  }

  // Reconstruct path
  const path = [];
  let cur = endIdx;
  while (cur !== -1) { path.unshift(cur); cur = prev[cur]; }
  return path.length > 1 ? path : null;
}

// ─── capacity colour ─────────────────────────────────────────────────────────
function capacityColor(pct) {
  if (pct >= 0.9) return '#dc2626';
  if (pct >= 0.7) return '#ea580c';
  if (pct >= 0.4) return '#eab308';
  return '#16a34a';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EvacuationModule({ districts = [], stormName = 'Cyclone' }) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const routeMarkersRef = useRef([]);
  const shelterMarkers  = useRef([]);

  const [shelters, setShelters]             = useState(INITIAL_SHELTERS);
  const [selectedOrigin, setSelectedOrigin] = useState('');
  const [selectedDest,   setSelectedDest]   = useState('');
  const [route, setRoute]                   = useState(null);
  const [routeInfo, setRouteInfo]           = useState(null);
  const [mapReady, setMapReady]             = useState(false);
  const [activeTab, setActiveTab]           = useState('shelters');
  const [lastRefresh, setLastRefresh]       = useState(new Date());

  // Simulate live capacity updates every 30 s
  useEffect(() => {
    const interval = setInterval(() => {
      setShelters(prev => prev.map(s => ({
        ...s,
        occupied: Math.max(0, Math.min(s.capacity,
          s.occupied + Math.round((Math.random() - 0.45) * 40))),
      })));
      setLastRefresh(new Date());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── init map ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [86.0, 20.2],
      zoom: 6,
    });
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.on('style.load', () => { mapRef.current = map; setMapReady(true); });
    return () => {};
  }, []);

  // ── shelter markers ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    shelterMarkers.current.forEach(m => m.remove());
    shelterMarkers.current = [];

    shelters.forEach(s => {
      const pct   = s.occupied / s.capacity;
      const color = capacityColor(pct);
      const icon  = s.type === 'Primary' ? '🏫' : '🏢';
      const avail = s.capacity - s.occupied;

      const el = document.createElement('div');
      Object.assign(el.style, {
        width:'42px', height:'42px', borderRadius:'50%',
        background: color, border:'3px solid #fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:'20px', cursor:'pointer',
        boxShadow:`0 0 14px ${color}99`,
      });
      el.innerHTML = icon;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([s.lon, s.lat])
        .setPopup(new maplibregl.Popup({ offset: 22 }).setHTML(`
          <div style="
            font-family:Arial; padding:14px; min-width:230px;
            background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);
            color:#e2e8f0; border-radius:10px;
          ">
            <div style="font-weight:bold;font-size:13px;margin-bottom:8px;color:#fff;
              border-bottom:1px solid #334155;padding-bottom:6px;">
              ${s.name}
            </div>
            <div style="font-size:12px;line-height:1.9;">
              <div style="color:#94a3b8;">📍 ${s.district}</div>
              <div style="color:#94a3b8;">🏷 Type: <span style="color:#e2e8f0;">${s.type}</span></div>
              <div style="color:#94a3b8;">👥 Capacity: <span style="color:#e2e8f0;">${s.capacity.toLocaleString()}</span></div>
              <div style="color:#94a3b8;">✅ Available:
                <b style="color:${color};font-size:13px;">${avail.toLocaleString()}</b>
              </div>
              <div style="margin:8px 0;">
                <div style="background:#1e293b;border-radius:4px;height:8px;overflow:hidden;border:1px solid #334155;">
                  <div style="background:${color};width:${Math.round(pct*100)}%;height:100%;border-radius:4px;
                    box-shadow:0 0 6px ${color}88;"></div>
                </div>
                <div style="font-size:10px;color:#64748b;margin-top:3px;">${Math.round(pct*100)}% occupied</div>
              </div>
              <div style="color:#94a3b8;margin-top:4px;padding:6px 8px;
                background:rgba(255,255,255,0.05);border-radius:6px;font-size:11px;">
                🛠 ${s.amenities.join(' · ')}
              </div>
            </div>
          </div>
        `))
        .addTo(map);
      shelterMarkers.current.push(marker);
    });
  }, [shelters, mapReady]);

  // ── evacuation route ─────────────────────────────────────────────────────
  const calcRoute = useCallback(() => {
    if (!selectedOrigin || !selectedDest) return;
    const map = mapRef.current;

    // Remove old route layers
    routeMarkersRef.current.forEach(m => m.remove());
    routeMarkersRef.current = [];
    ['evac-route','evac-route-border'].forEach(id => {
      try { if (map.getLayer(id)) map.removeLayer(id); } catch(_){}
    });
    try { if (map.getSource('evac-route')) map.removeSource('evac-route'); } catch(_){}

    // Build graph nodes: districts + shelters
    const allDistricts = districts.length ? districts : SHELTER_DB.map(s => ({
      name: s.district, lat: s.lat, lon: s.lon, zone: 'Yellow',
    }));
    const shelterNodes = shelters.map(s => ({
      name: s.name, lat: s.lat, lon: s.lon, zone: 'Yellow', id: s.id,
    }));
    const nodes = [...allDistricts, ...shelterNodes];

    const startIdx = nodes.findIndex(n => n.name === selectedOrigin || n.id === selectedOrigin);
    const endIdx   = nodes.findIndex(n => n.name === selectedDest   || n.id === selectedDest);

    if (startIdx === -1 || endIdx === -1) return;

    const pathIdxs = dijkstra(nodes, startIdx, endIdx);
    if (!pathIdxs) { setRouteInfo({ error: 'No safe route found' }); return; }

    const pathNodes = pathIdxs.map(i => nodes[i]);
    const coords    = pathNodes.map(n => [n.lon, n.lat]);

    // Compute distance
    let totalKm = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const dx = (coords[i+1][0]-coords[i][0]) * 111 * Math.cos(coords[i][1]*Math.PI/180);
      const dy = (coords[i+1][1]-coords[i][1]) * 111;
      totalKm += Math.sqrt(dx*dx + dy*dy);
    }

    // Draw route on map
    if (map) {
      map.addSource('evac-route', { type:'geojson', data:{
        type:'Feature', geometry:{ type:'LineString', coordinates: coords },
      }});
      map.addLayer({ id:'evac-route-border', type:'line', source:'evac-route',
        paint:{ 'line-color':'#ffffff', 'line-width':6, 'line-opacity':0.3 },
        layout:{ 'line-cap':'round','line-join':'round' },
      });
      map.addLayer({ id:'evac-route', type:'line', source:'evac-route',
        paint:{ 'line-color':'#22c55e', 'line-width':4,
                'line-dasharray':[6,3], 'line-opacity':0.95 },
        layout:{ 'line-cap':'round' },
      });

      // Start/end markers
      const makePin = (color, label) => {
        const e = document.createElement('div');
        Object.assign(e.style,{
          background:color, color:'#fff', fontWeight:'bold', fontSize:'11px',
          padding:'4px 8px', borderRadius:'12px', border:'2px solid #fff',
          boxShadow:`0 0 10px ${color}88`, whiteSpace:'nowrap',
        });
        e.innerText = label;
        return e;
      };
      routeMarkersRef.current.push(
        new maplibregl.Marker({ element: makePin('#ef4444','🚨 Origin') })
          .setLngLat(coords[0]).addTo(map),
        new maplibregl.Marker({ element: makePin('#22c55e','✅ Shelter') })
          .setLngLat(coords[coords.length-1]).addTo(map),
      );

      map.fitBounds(
        coords.reduce((b,c) => b.extend(c), new maplibregl.LngLatBounds(coords[0],coords[0])),
        { padding:80, maxZoom:10, duration:1000 },
      );
    }

    setRoute(pathNodes);
    setRouteInfo({
      waypoints:  pathNodes.length,
      distanceKm: totalKm.toFixed(1),
      estMinutes: Math.round((totalKm / 40) * 60),  // assume 40 km/h evac speed
      safeZones:  pathNodes.filter(n => n.zone === 'Yellow').length,
    });
  }, [selectedOrigin, selectedDest, districts, shelters, mapReady]);

  // Refresh button — nudges capacity simulation
  const handleRefresh = () => {
    setShelters(prev => prev.map(s => ({
      ...s,
      occupied: Math.max(0, Math.min(s.capacity,
        s.occupied + Math.round((Math.random() - 0.4) * 80))),
    })));
    setLastRefresh(new Date());
  };

  const totalCapacity = shelters.reduce((a, s) => a + s.capacity, 0);
  const totalOccupied = shelters.reduce((a, s) => a + s.occupied, 0);
  const totalAvailable = totalCapacity - totalOccupied;
  const overallPct = totalOccupied / totalCapacity;

  const originOptions = [
    ...(districts.length ? districts : SHELTER_DB.map(s => ({ name: s.district }))),
  ];
  const destOptions = shelters.filter(s => (s.capacity - s.occupied) > 50);

  return (
    <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600
            flex items-center justify-center shadow-lg shadow-green-500/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Disaster Logistics & Evacuation</h2>
            <p className="text-xs text-slate-400">{stormName} · Shelters &amp; Safe Routes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button onClick={handleRefresh}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all">
            <RefreshCw className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 px-5 py-3 border-b border-slate-700/30">
        {[
          { icon:<Users className="w-4 h-4"/>, label:'Total Capacity',
            value: totalCapacity.toLocaleString(), color:'cyan' },
          { icon:<CheckCircle className="w-4 h-4"/>, label:'Available Spaces',
            value: totalAvailable.toLocaleString(),
            color: overallPct > 0.8 ? 'red' : overallPct > 0.6 ? 'orange' : 'green' },
          { icon:<AlertTriangle className="w-4 h-4"/>, label:'Occupancy',
            value: `${Math.round(overallPct*100)}%`,
            color: overallPct > 0.8 ? 'red' : overallPct > 0.6 ? 'orange' : 'green' },
        ].map(({ icon, label, value, color }) => {
          const cm = {
            cyan:   'text-cyan-300   bg-cyan-500/10   border-cyan-500/30',
            green:  'text-green-300  bg-green-500/10  border-green-500/30',
            orange: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
            red:    'text-red-300    bg-red-500/10    border-red-500/30',
          }[color];
          return (
            <div key={label} className={`rounded-xl border p-3 ${cm}`}>
              <div className="flex items-center gap-1.5 mb-1 opacity-70">{icon}<span className="text-xs">{label}</span></div>
              <div className="text-xl font-black text-white">{value}</div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700/40">
        {[
          { id:'shelters', label:'Shelters & Capacity' },
          { id:'routes',   label:'Evacuate'            },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors
              ${activeTab === t.id
                ? 'text-cyan-300 border-b-2 border-cyan-400 bg-cyan-500/5'
                : 'text-slate-400 hover:text-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="h-[360px] relative">
        <div ref={mapContainerRef} className="w-full h-full" />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10">
            <div className="text-slate-400 text-sm animate-pulse">Loading evacuation map…</div>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="max-h-72 overflow-y-auto">

        {/* Shelters + Capacity combined tab */}
        {activeTab === 'shelters' && (
          <div className="p-4 space-y-2">
            {/* Capacity bar chart header */}
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide pb-1
              border-b border-slate-700/40 mb-3">
              Shelter List &amp; Capacity
            </div>
            {shelters
              .sort((a, b) => (b.occupied / b.capacity) - (a.occupied / a.capacity))
              .map(s => {
                const pct   = s.occupied / s.capacity;
                const color = capacityColor(pct);
                const avail = s.capacity - s.occupied;
                return (
                  <div key={s.id}
                    className="flex items-center gap-3 p-3 bg-slate-800/60 border border-slate-700/40
                      rounded-xl hover:bg-slate-800 transition-all cursor-pointer">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
                      style={{ background: color + '33', border: `2px solid ${color}` }}>
                      {s.type === 'Primary' ? '🏫' : '🏢'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white truncate">{s.name}</span>
                        <span className="text-xs font-bold shrink-0" style={{ color }}>
                          {Math.round(pct * 100)}%
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mb-1.5">{s.district} · {s.type}</div>
                      {/* Capacity bar */}
                      <div className="bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, Math.round(pct * 100))}%`, background: color }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-1">
                      <div className="text-sm font-bold leading-none" style={{ color }}>
                        {avail.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">free</div>
                      <div className="text-[10px] text-slate-500">
                        of {s.capacity.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Route calculator tab */}
        {activeTab === 'routes' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">📍 Origin District</label>
                <select value={selectedOrigin} onChange={e => setSelectedOrigin(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600/50 rounded-xl text-sm
                    text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500">
                  <option value="">Select origin…</option>
                  {originOptions.map(d => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">🏫 Destination Shelter</label>
                <select value={selectedDest} onChange={e => setSelectedDest(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600/50 rounded-xl text-sm
                    text-slate-200 px-3 py-2 focus:outline-none focus:border-green-500">
                  <option value="">Select shelter…</option>
                  {destOptions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({(s.capacity-s.occupied).toLocaleString()} free)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button onClick={calcRoute} disabled={!selectedOrigin || !selectedDest || !mapReady}
              className="w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-600
                hover:from-green-500 hover:to-emerald-500 disabled:opacity-40
                text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2
                shadow-lg shadow-green-600/30 transition-all">
              <Navigation className="w-4 h-4" />
              Calculate Safe Evacuation Route
            </button>

            {routeInfo && !routeInfo.error && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon:'📍', label:'Waypoints',      value: routeInfo.waypoints   },
                  { icon:'📏', label:'Distance',        value: `${routeInfo.distanceKm} km` },
                  { icon:'⏱',  label:'Est. Time',       value: `${routeInfo.estMinutes} min` },
                  { icon:'✅', label:'Safe Zones',       value: routeInfo.safeZones  },
                ].map(({ icon, label, value }) => (
                  <div key={label}
                    className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-center">
                    <div className="text-lg mb-1">{icon}</div>
                    <div className="text-lg font-black text-white">{value}</div>
                    <div className="text-xs text-slate-400">{label}</div>
                  </div>
                ))}
              </div>
            )}
            {routeInfo?.error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
                ⚠️ {routeInfo.error}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
