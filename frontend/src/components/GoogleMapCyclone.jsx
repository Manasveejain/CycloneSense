import React, { useEffect, useRef } from 'react';
import { Navigation, CloudRain } from 'lucide-react';

export default function GoogleMapCyclone({
  pastTrack = [],
  forecastTrack = [],
  landfall = null,
  districts = [],
  stormName = 'Cyclone',
  showTrack = true,
  showRiskZones = true
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const circlesRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    if (!mapInstanceRef.current) {
      // Initialize Google Map centered on Bay of Bengal
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 18.5, lng: 83.5 },
        zoom: 6,
        mapTypeId: 'hybrid', // Satellite view with labels
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: window.google.maps.ControlPosition.TOP_RIGHT,
          mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain']
        },
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_BOTTOM
        },
        styles: [
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#0a1929' }]
          },
          {
            featureType: 'landscape',
            elementType: 'geometry',
            stylers: [{ color: '#1e3a5f' }]
          }
        ]
      });
    }
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google) return;

    // Clear previous markers and overlays
    markersRef.current.forEach(marker => marker.setMap(null));
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    circlesRef.current.forEach(circle => circle.setMap(null));
    markersRef.current = [];
    polylinesRef.current = [];
    circlesRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();

    // 1. Plot Past Track (Observed)
    if (showTrack && pastTrack.length > 0) {
      const pastPath = pastTrack.map(pt => ({ lat: pt.lat, lng: pt.lon }));
      
      const pastPolyline = new window.google.maps.Polyline({
        path: pastPath,
        geodesic: true,
        strokeColor: '#06b6d4',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map: map
      });
      polylinesRef.current.push(pastPolyline);

      pastTrack.forEach((pt, idx) => {
        const isLatest = idx === pastTrack.length - 1;
        
        const marker = new window.google.maps.Marker({
          position: { lat: pt.lat, lng: pt.lon },
          map: map,
          title: isLatest ? 'Current Storm Center' : `Past Observation #${idx + 1}`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: isLatest ? '#06b6d4' : '#22d3ee',
            fillOpacity: isLatest ? 1 : 0.7,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: isLatest ? 10 : 6
          }
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; font-family: sans-serif; color: #1e293b;">
              <div style="font-weight: bold; color: #06b6d4; margin-bottom: 4px;">
                ${isLatest ? 'Current Storm Center' : `Past Observation #${idx + 1}`}
              </div>
              <div>Lat: <strong>${pt.lat.toFixed(2)}°N</strong>, Lon: <strong>${pt.lon.toFixed(2)}°E</strong></div>
              <div>Wind: <strong style="color: #f59e0b;">${pt.wind_kt || 85} kt</strong></div>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        markersRef.current.push(marker);
        bounds.extend({ lat: pt.lat, lng: pt.lon });
      });
    }

    // 2. Plot Forecast Track (Predicted)
    if (showTrack && forecastTrack.length > 0) {
      const forecastPath = forecastTrack.map(pt => ({ lat: pt.lat, lng: pt.lon }));
      
      // Connect from last observed to forecast
      if (pastTrack.length > 0) {
        const lastPast = pastTrack[pastTrack.length - 1];
        forecastPath.unshift({ lat: lastPast.lat, lng: lastPast.lon });
      }

      const forecastPolyline = new window.google.maps.Polyline({
        path: forecastPath,
        geodesic: true,
        strokeColor: '#ef4444',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        icons: [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 1,
            scale: 3
          },
          offset: '0',
          repeat: '15px'
        }],
        map: map
      });
      polylinesRef.current.push(forecastPolyline);

      forecastTrack.forEach((pt, idx) => {
        // Uncertainty cone
        const coneRadius = (pt.cone_radius_km || 40) * 1000; // meters
        const cone = new window.google.maps.Circle({
          strokeColor: '#ef4444',
          strokeOpacity: 0.4,
          strokeWeight: 1,
          fillColor: '#ef4444',
          fillOpacity: 0.08,
          map: map,
          center: { lat: pt.lat, lng: pt.lon },
          radius: coneRadius
        });
        circlesRef.current.push(cone);

        const marker = new window.google.maps.Marker({
          position: { lat: pt.lat, lng: pt.lon },
          map: map,
          title: `Forecast ${pt.forecast_hour || `+${(idx + 1) * 6}h`}`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#ef4444',
            fillOpacity: 0.8,
            strokeColor: '#7f1d1d',
            strokeWeight: 2,
            scale: 7
          },
          label: {
            text: `+${(idx + 1) * 6}h`,
            color: '#ffffff',
            fontSize: '10px',
            fontWeight: 'bold'
          }
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; font-family: sans-serif; color: #1e293b;">
              <div style="font-weight: bold; color: #ef4444; margin-bottom: 4px;">
                LSTM Prediction +${(idx + 1) * 6}h
              </div>
              <div>Lat: <strong>${pt.lat.toFixed(2)}°N</strong>, Lon: <strong>${pt.lon.toFixed(2)}°E</strong></div>
              <div>Wind: <strong style="color: #f59e0b;">${Math.round(pt.wind_kt || 120)} kt</strong></div>
              <div style="font-size: 11px; color: #64748b;">Forecast Cone: ±${pt.cone_radius_km || 40} km</div>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        markersRef.current.push(marker);
        bounds.extend({ lat: pt.lat, lng: pt.lon });
      });
    }

    // 3. Landfall Marker
    if (landfall && landfall.lat && landfall.lon) {
      const landfallMarker = new window.google.maps.Marker({
        position: { lat: landfall.lat, lng: landfall.lon },
        map: map,
        title: 'Predicted Landfall',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#f59e0b',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
          scale: 12
        },
        animation: window.google.maps.Animation.BOUNCE
      });

      const landfallInfo = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: sans-serif; color: #1e293b;">
            <div style="font-weight: bold; color: #f59e0b; margin-bottom: 4px;">Landfall Sector</div>
            <div>Region: <strong>${landfall.nearest_coastal_hub}</strong></div>
            <div>ETA: <strong>${landfall.estimated_time}</strong></div>
            <div>Coords: ${landfall.lat.toFixed(2)}°N, ${landfall.lon.toFixed(2)}°E</div>
          </div>
        `
      });

      landfallMarker.addListener('click', () => {
        landfallInfo.open(map, landfallMarker);
      });

      markersRef.current.push(landfallMarker);
      bounds.extend({ lat: landfall.lat, lng: landfall.lon });
    }

    // 4. District Risk Zones
    if (showRiskZones && districts.length > 0) {
      districts.forEach(dist => {
        if (!dist.lat || !dist.lon) return;

        const zone = dist.zone || 'Yellow';
        let zoneColor = '#eab308';
        let fillOpacity = 0.15;

        if (zone === 'Red') {
          zoneColor = '#ef4444';
          fillOpacity = 0.25;
        } else if (zone === 'Orange') {
          zoneColor = '#f97316';
          fillOpacity = 0.20;
        }

        const circle = new window.google.maps.Circle({
          strokeColor: zoneColor,
          strokeOpacity: 0.6,
          strokeWeight: zone === 'Red' ? 2.5 : 1.5,
          fillColor: zoneColor,
          fillOpacity: fillOpacity,
          map: map,
          center: { lat: dist.lat, lng: dist.lon },
          radius: 28000
        });
        circlesRef.current.push(circle);

        const distMarker = new window.google.maps.Marker({
          position: { lat: dist.lat, lng: dist.lon },
          map: map,
          title: `${dist.name} - ${zone} Zone`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: zoneColor,
            fillOpacity: 1,
            strokeColor: '#0f172a',
            strokeWeight: 2,
            scale: 8
          }
        });

        const distInfo = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 10px; font-family: sans-serif; color: #1e293b; min-width: 220px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0;">
                <span style="font-weight: bold; font-size: 14px;">${dist.name}</span>
                <span style="background: ${zoneColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">${zone}</span>
              </div>
              <div style="font-size: 12px; color: #475569;">
                <div><strong>State:</strong> ${dist.state}</div>
                <div><strong>Risk Score:</strong> <span style="color: #06b6d4; font-family: monospace;">${dist.risk_score}/10</span></div>
                <div><strong>Distance to Eye:</strong> ${dist.distance_to_path_km} km</div>
                <div><strong>Estimated Loss:</strong> <span style="color: #10b981;">$${dist.estimated_damage_usd_m}M</span></div>
              </div>
              <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 11px; font-style: italic; color: #64748b;">
                "${dist.action}"
              </div>
            </div>
          `
        });

        distMarker.addListener('click', () => {
          distInfo.open(map, distMarker);
        });

        markersRef.current.push(distMarker);
        bounds.extend({ lat: dist.lat, lng: dist.lon });
      });
    }

    // Fit map to show all markers
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds);
      const listener = window.google.maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom() > 8) map.setZoom(8);
      });
    }
  }, [pastTrack, forecastTrack, landfall, districts, showTrack, showRiskZones]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
      <div ref={mapRef} className="w-full h-full" />

      {/* Map Legend */}
      <div className="absolute top-3 left-3 z-10 bg-slate-900/95 backdrop-blur-md border border-slate-800 p-3 rounded-lg shadow-xl text-xs flex flex-col gap-2 max-w-[240px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-semibold text-slate-200 tracking-wide flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
            Google Earth View
          </span>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 bg-cyan-400 rounded-full"></span>
            <span className="text-slate-300">Observed Track (24h)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 bg-red-500 border-dashed border-b-2 rounded-full"></span>
            <span className="text-slate-300">LSTM Forecast (+48h)</span>
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
          Click any marker for detailed forecast info
        </div>
      </div>
    </div>
  );
}
