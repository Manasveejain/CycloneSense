import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, AlertTriangle, ShieldAlert, CloudRain } from 'lucide-react';

export default function CycloneMap({
  pastTrack = [],
  forecastTrack = [],
  landfall = null,
  districts = [],
  stormName = 'Cyclone',
  showTrack = true,
  showRiskZones = true
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Optional Global Live IR clouds toggle (default off for clean map)
  const [showGlobalClouds, setShowGlobalClouds] = useState(false);
  const globalTileLayerRef = useRef(null);

  const layersRef = useRef({
    pastLine: null,
    forecastLine: null,
    markersGroup: null,
    conesGroup: null,
    districtsGroup: null
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Center on Bay of Bengal / Indian Ocean
      const map = L.map(mapContainerRef.current, {
        center: [18.5, 83.5],
        zoom: 6,
        zoomControl: false,
        attributionControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Clean dark GIS base map
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd',
      }).addTo(map);

      mapInstanceRef.current = map;
      layersRef.current.markersGroup = L.layerGroup().addTo(map);
      layersRef.current.conesGroup = L.layerGroup().addTo(map);
      layersRef.current.districtsGroup = L.layerGroup().addTo(map);
    }
  }, []);

  // Global Real-Time Satellite Clouds (RainViewer) - optional toggle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (showGlobalClouds) {
      fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(res => res.json())
        .then(data => {
          if (data && data.satellite && data.satellite.infrared && data.satellite.infrared.length > 0) {
            const latest = data.satellite.infrared[data.satellite.infrared.length - 1];
            const host = data.host || 'https://tilecache.rainviewer.com';
            const tileUrl = `${host}${latest.path}`;

            if (globalTileLayerRef.current) {
              map.removeLayer(globalTileLayerRef.current);
            }

            globalTileLayerRef.current = L.tileLayer(tileUrl, {
              maxZoom: 12,
              opacity: 0.65,
              zIndex: 10
            }).addTo(map);
          }
        })
        .catch(err => {
          console.warn('Could not load satellite cloud tile:', err);
        });
    } else {
      if (globalTileLayerRef.current && map.hasLayer(globalTileLayerRef.current)) {
        map.removeLayer(globalTileLayerRef.current);
        globalTileLayerRef.current = null;
      }
    }
  }, [showGlobalClouds]);

  // Update Markers, Track, and Risk Zones
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const { markersGroup, conesGroup, districtsGroup } = layersRef.current;
    markersGroup.clearLayers();
    conesGroup.clearLayers();
    districtsGroup.clearLayers();

    if (layersRef.current.pastLine) {
      map.removeLayer(layersRef.current.pastLine);
      layersRef.current.pastLine = null;
    }
    if (layersRef.current.forecastLine) {
      map.removeLayer(layersRef.current.forecastLine);
      layersRef.current.forecastLine = null;
    }

    const allLatLons = [];

    // 1. Plot Past Track
    if (showTrack && pastTrack.length > 0) {
      const pastCoords = pastTrack.map(pt => [pt.lat, pt.lon]);
      allLatLons.push(...pastCoords);

      layersRef.current.pastLine = L.polyline(pastCoords, {
        color: '#06b6d4',
        weight: 3.5,
        opacity: 0.9,
        lineCap: 'round',
        zIndex: 30
      }).addTo(map);

      pastTrack.forEach((pt, idx) => {
        const isLatestPast = idx === pastTrack.length - 1;
        const iconHtml = isLatestPast
          ? `<div class="relative flex items-center justify-center">
              <div class="w-7 h-7 rounded-full bg-cyan-500/40 animate-ping absolute"></div>
              <div class="w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-xl flex items-center justify-center">
                <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
              </div>
            </div>`
          : `<div class="w-2.5 h-2.5 rounded-full bg-cyan-500 border border-slate-900 shadow"></div>`;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-track-marker',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const marker = L.marker([pt.lat, pt.lon], { icon: customIcon, zIndexOffset: 100 }).addTo(markersGroup);
        marker.bindPopup(`
          <div class="p-2 min-w-[160px] text-xs font-sans">
            <div class="font-bold text-cyan-400 uppercase tracking-wide">${isLatestPast ? 'Current Storm Center' : `Past Observation #${idx + 1}`}</div>
            <div class="mt-1 text-slate-200">Lat: <strong>${pt.lat.toFixed(2)}°N</strong>, Lon: <strong>${pt.lon.toFixed(2)}°E</strong></div>
            <div class="text-slate-300">Wind: <strong class="text-amber-400">${pt.wind_kt || 85} kt</strong></div>
            <div class="text-slate-300">Pressure: <strong>${pt.pressure_mb || 960} mb</strong></div>
          </div>
        `);
      });
    }

    // 2. Plot Forecast Track & Uncertainty Cones
    if (showTrack && forecastTrack.length > 0) {
      const forecastCoords = forecastTrack.map(pt => [pt.lat, pt.lon]);
      const connectCoords = pastTrack.length > 0 
        ? [[pastTrack[pastTrack.length - 1].lat, pastTrack[pastTrack.length - 1].lon], ...forecastCoords]
        : forecastCoords;

      allLatLons.push(...forecastCoords);

      layersRef.current.forecastLine = L.polyline(connectCoords, {
        color: '#ef4444',
        weight: 3.5,
        dashArray: '6, 8',
        opacity: 0.95,
        zIndex: 30
      }).addTo(map);

      forecastTrack.forEach((pt) => {
        L.circle([pt.lat, pt.lon], {
          radius: (pt.cone_radius_km || 40) * 1000,
          color: '#ef4444',
          weight: 1,
          dashArray: '4, 4',
          fillColor: '#ef4444',
          fillOpacity: 0.08,
          zIndex: 20
        }).addTo(conesGroup);

        const forecastIconHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-slate-900 shadow"></div>
            <span class="absolute -top-4 text-[9px] font-mono font-bold text-red-300 bg-slate-950/90 px-1 rounded border border-red-500/40">${pt.forecast_hour}</span>
          </div>
        `;

        const forecastIcon = L.divIcon({
          html: forecastIconHtml,
          className: 'custom-forecast-marker',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const marker = L.marker([pt.lat, pt.lon], { icon: forecastIcon, zIndexOffset: 80 }).addTo(markersGroup);
        marker.bindPopup(`
          <div class="p-2 min-w-[170px] text-xs font-sans">
            <div class="font-bold text-red-400 uppercase tracking-wide">LSTM Prediction ${pt.forecast_hour}</div>
            <div class="mt-1 text-slate-200">Lat: <strong>${pt.lat.toFixed(2)}°N</strong>, Lon: <strong>${pt.lon.toFixed(2)}°E</strong></div>
            <div class="text-slate-300">Wind: <strong class="text-amber-400">${pt.wind_kt} kt</strong></div>
            <div class="text-slate-300">Pressure: <strong>${pt.pressure_mb} mb</strong></div>
            <div class="text-slate-400 text-[10px] mt-1">Forecast Cone: ±${pt.cone_radius_km} km</div>
          </div>
        `);
      });
    }

    // 3. Landfall Target
    if (landfall && landfall.lat && landfall.lon) {
      const landfallHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-9 h-9 rounded-full bg-amber-500/30 animate-ping absolute"></div>
          <div class="w-5 h-5 rounded-full bg-amber-500 border-2 border-white shadow-xl flex items-center justify-center">
            <div class="w-2 h-2 bg-slate-950 rounded-full"></div>
          </div>
        </div>
      `;
      const landfallIcon = L.divIcon({
        html: landfallHtml,
        className: 'landfall-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const lfMarker = L.marker([landfall.lat, landfall.lon], { icon: landfallIcon, zIndexOffset: 120 }).addTo(markersGroup);
      lfMarker.bindPopup(`
        <div class="p-2 min-w-[180px] text-xs font-sans">
          <div class="font-bold text-amber-400 uppercase flex items-center gap-1">
            <span>Landfall Sector</span>
          </div>
          <div class="mt-1 text-slate-200">Region: <strong>${landfall.nearest_coastal_hub}</strong></div>
          <div class="text-slate-300">ETA: <strong>${landfall.estimated_time}</strong></div>
          <div class="text-slate-400">Coords: ${landfall.lat.toFixed(2)}°N, ${landfall.lon.toFixed(2)}°E</div>
        </div>
      `);
    }

    // 4. Coastal Districts Risk Zones
    if (showRiskZones && districts.length > 0) {
      districts.forEach(dist => {
        allLatLons.push([dist.lat, dist.lon]);

        const zone = dist.zone || 'Yellow';
        let zoneColor = '#eab308';
        let zoneFill = '#eab308';
        let badgeClass = 'text-yellow-400 bg-yellow-950/40 border-yellow-500/40';

        if (zone === 'Red') {
          zoneColor = '#ef4444';
          zoneFill = '#ef4444';
          badgeClass = 'text-red-400 bg-red-950/40 border-red-500/40';
        } else if (zone === 'Orange') {
          zoneColor = '#f97316';
          zoneFill = '#f97316';
          badgeClass = 'text-orange-400 bg-orange-950/40 border-orange-500/40';
        }

        L.circle([dist.lat, dist.lon], {
          radius: 28000,
          color: zoneColor,
          weight: zone === 'Red' ? 2.5 : 1.5,
          fillColor: zoneFill,
          fillOpacity: zone === 'Red' ? 0.35 : (zone === 'Orange' ? 0.25 : 0.15),
          zIndex: 25
        }).addTo(districtsGroup);

        const pinHtml = `
          <div class="w-3 h-3 rounded-full border border-slate-900 shadow flex items-center justify-center" style="background-color: ${zoneColor}">
          </div>
        `;
        const pinIcon = L.divIcon({
          html: pinHtml,
          className: 'district-pin',
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        });

        const pinMarker = L.marker([dist.lat, dist.lon], { icon: pinIcon, zIndexOffset: 50 }).addTo(districtsGroup);

        const popupContent = `
          <div class="p-2 min-w-[210px] text-xs font-sans">
            <div class="flex items-center justify-between pb-1 border-b border-slate-700">
              <span class="font-bold text-slate-100 text-sm">${dist.name}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeClass}">${zone} Zone</span>
            </div>
            <div class="mt-2 space-y-1 text-slate-300">
              <div>State: <strong class="text-slate-100">${dist.state}</strong></div>
              <div>Risk Score: <strong class="text-cyan-400 font-mono">${dist.risk_score} / 100</strong></div>
              <div>Distance to Eye: <strong class="text-slate-100 font-mono">${dist.distance_to_path_km} km</strong></div>
              <div>Wind at Impact: <strong class="text-amber-400 font-mono">${dist.predicted_wind_kt} kt</strong></div>
              <div>Vulnerability Index: <strong class="text-slate-200 font-mono">${dist.vulnerability_index}</strong></div>
              <div>Estimated Loss: <strong class="text-emerald-400 font-mono">$${dist.estimated_damage_usd_m}M (₹${dist.estimated_damage_inr_crores} Cr)</strong></div>
            </div>
            <div class="mt-2 pt-1 border-t border-slate-800 text-[11px] text-slate-400 italic">
              "${dist.action}"
            </div>
          </div>
        `;

        pinMarker.bindPopup(popupContent);
      });
    }

    if (allLatLons.length > 2) {
      map.fitBounds(L.latLngBounds(allLatLons), { padding: [40, 40], maxZoom: 8 });
    }
  }, [pastTrack, forecastTrack, landfall, districts, showTrack, showRiskZones]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Interactive Map Legend Overlay */}
      <div className="absolute top-3 left-3 z-[1000] bg-slate-900/95 backdrop-blur-md border border-slate-800 p-3 rounded-lg shadow-xl text-xs flex flex-col gap-2 max-w-[240px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-semibold text-slate-200 tracking-wide flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
            GIS Prediction Overlay
          </span>
        </div>

        {/* Global Live Weather Clouds (Optional) */}
        <div className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 text-[11px]">
            <input 
              type="checkbox" 
              checked={showGlobalClouds} 
              onChange={(e) => setShowGlobalClouds(e.target.checked)}
              className="rounded accent-cyan-500 cursor-pointer" 
            />
            <span className="flex items-center gap-1">
              <CloudRain className="w-3 h-3 text-blue-400" />
              Global Weather Clouds
            </span>
          </label>
        </div>

        {/* Legend items */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 bg-cyan-400 rounded-full"></span>
            <span className="text-slate-300">Observed Track (24h)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 bg-red-500 border-dashed border-b-2 rounded-full"></span>
            <span className="text-slate-300">LSTM Forecast Path (+48h)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/40 border border-red-500"></span>
            <span className="text-slate-300 font-medium">Red Zone (Evacuate)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500/40 border border-orange-500"></span>
            <span className="text-slate-300 font-medium">Orange Zone (Alert)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500/40 border border-yellow-500"></span>
            <span className="text-slate-300 font-medium">Yellow Zone (Watch)</span>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
          Click any district or waypoint for detailed forecast.
        </div>
      </div>
    </div>
  );
}
