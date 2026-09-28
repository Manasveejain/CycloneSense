import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function WorkingMap({
  pastTrack = [],
  forecastTrack = [],
  districts = [],
  stormName = 'Cyclone'
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [styleLoaded, setStyleLoaded] = useState(false);

  // Initialize map ONCE
  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return;

    console.log('🗺️ Initializing map...');
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [85.5, 19.5],
      zoom: 6
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    // Wait for style to load
    map.on('style.load', () => {
      console.log('✅ Map style loaded');
      mapInstanceRef.current = map;
      setStyleLoaded(true);
    });

    map.on('error', (e) => {
      console.error('Map error:', e);
    });

    return () => {
      // Don't remove map on unmount
    };
  }, []);

  // Add/update zone markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !styleLoaded) {
      console.log('⏳ Waiting... map:', !!map, 'styleLoaded:', styleLoaded);
      return;
    }

    console.log('🎯 Updating markers - districts:', districts.length);

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (districts.length === 0) {
      console.log('⏸️ No districts');
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    let count = 0;

    districts.forEach((dist) => {
      const lat = parseFloat(dist.lat);
      const lon = parseFloat(dist.lon);

      if (isNaN(lat) || isNaN(lon)) {
        console.warn(`❌ Invalid coords for ${dist.name}:`, lat, lon);
        return;
      }

      const zone = dist.zone || 'Yellow';
      const colors = { Red: '#dc2626', Orange: '#ea580c', Yellow: '#eab308' };
      const color = colors[zone] || '#eab308';
      const emoji = zone === 'Red' ? '🔴' : zone === 'Orange' ? '🟠' : '🟡';

      // Create marker
      const el = document.createElement('div');
      el.style.width = '50px';
      el.style.height = '50px';
      el.style.backgroundColor = color;
      el.style.border = '3px solid white';
      el.style.borderRadius = '50%';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '24px';
      el.style.boxShadow = `0 0 20px ${color}cc`;
      el.innerHTML = emoji;

      // Create marker
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lon, lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div style="font-family: Arial; padding: 12px; min-width: 200px;">
              <strong style="color: ${color};">${zone} ZONE</strong>
              <hr style="margin: 5px 0; border: none; border-top: 1px solid #ddd;">
              <div style="font-size: 12px;">
                <div><strong>${dist.name}</strong>, ${dist.state}</div>
                <div>Risk: ${dist.risk_score}/10</div>
                <div>Distance: ${dist.distance_to_path_km.toFixed(1)} km</div>
                <div>Damage: $${dist.estimated_damage_usd_m.toFixed(0)}M</div>
              </div>
            </div>
          `)
        )
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([lon, lat]);
      count++;

      console.log(`✅ ${zone} marker: ${dist.name} at [${lat}, ${lon}]`);
    });

    // Fit bounds
    if (count > 0) {
      try {
        map.fitBounds(bounds, { padding: 50, maxZoom: 9, duration: 800 });
        console.log(`✅ Fitted ${count} markers`);
      } catch (e) {
        console.warn('Fit bounds warning:', e.message);
      }
    }
  }, [districts, styleLoaded]);

  // Add track lines
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !styleLoaded) return;

    console.log('🛣️ Updating tracks...');

    // Remove old layers
    ['past-track', 'forecast-track'].forEach(id => {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    });

    // Past track
    if (pastTrack && pastTrack.length > 0) {
      const coords = pastTrack
        .map(pt => (Array.isArray(pt) ? [pt[1], pt[0]] : [pt.lon, pt.lat]))
        .filter(c => c[0] && c[1] && !isNaN(c[0]) && !isNaN(c[1]));

      if (coords.length > 0) {
        map.addSource('past-track', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
        });
        map.addLayer({
          id: 'past-track',
          type: 'line',
          source: 'past-track',
          paint: { 'line-color': '#06b6d4', 'line-width': 3 }
        });
        console.log('✅ Past track added:', coords.length, 'points');
      }
    }

    // Forecast track
    if (forecastTrack && forecastTrack.length > 0) {
      const coords = forecastTrack
        .map(pt => (Array.isArray(pt) ? [pt[1], pt[0]] : [pt.lon, pt.lat]))
        .filter(c => c[0] && c[1] && !isNaN(c[0]) && !isNaN(c[1]));

      if (coords.length > 0) {
        map.addSource('forecast-track', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
        });
        map.addLayer({
          id: 'forecast-track',
          type: 'line',
          source: 'forecast-track',
          paint: { 'line-color': '#f59e0b', 'line-width': 2.5, 'line-dasharray': [5, 5] }
        });
        console.log('✅ Forecast track added:', coords.length, 'points');
      }
    }
  }, [pastTrack, forecastTrack, styleLoaded]);

  // Add animated cyclone marker at last forecast position
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !styleLoaded) return;

    // Remove old cyclone marker if exists
    if (window.cycloneMarker) {
      window.cycloneMarker.remove();
      window.cycloneMarker = null;
    }

    // Get first past track position (where cyclone started)
    if (pastTrack && pastTrack.length > 0) {
      const lastPoint = pastTrack[0]; // First point of past track - cyclone origin
      const lat = Array.isArray(lastPoint) ? lastPoint[0] : lastPoint.lat;
      const lon = Array.isArray(lastPoint) ? lastPoint[1] : lastPoint.lon;

      if (!isNaN(lat) && !isNaN(lon)) {
        console.log('🌀 Adding animated cyclone at BLUE LINE START:', [lat, lon]);

        // Create animated cyclone element
        const el = document.createElement('div');
        el.style.width = '80px';
        el.style.height = '80px';
        el.style.position = 'relative';
        el.style.cursor = 'pointer';

        // Add spinning cyclone icon with pulsing glow
        el.innerHTML = `
          <style>
            @keyframes spin-cyclone {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes pulse-glow {
              0%, 100% { 
                filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.8)) 
                        drop-shadow(0 0 20px rgba(239, 68, 68, 0.6))
                        drop-shadow(0 0 30px rgba(239, 68, 68, 0.4));
              }
              50% { 
                filter: drop-shadow(0 0 20px rgba(239, 68, 68, 1)) 
                        drop-shadow(0 0 40px rgba(239, 68, 68, 0.8))
                        drop-shadow(0 0 60px rgba(239, 68, 68, 0.6));
              }
            }
            @keyframes bounce {
              0%, 100% { transform: translateY(0) rotate(0deg); }
              25% { transform: translateY(-5px) rotate(90deg); }
              50% { transform: translateY(0) rotate(180deg); }
              75% { transform: translateY(-5px) rotate(270deg); }
            }
            .cyclone-icon {
              font-size: 64px;
              animation: spin-cyclone 3s linear infinite, pulse-glow 2s ease-in-out infinite;
              display: inline-block;
            }
            .cyclone-container {
              animation: bounce 4s ease-in-out infinite;
            }
          </style>
          <div class="cyclone-container" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
            <div class="cyclone-icon">🌀</div>
          </div>
        `;

        // Create popup with cyclone info
        const popup = new maplibregl.Popup({ 
          offset: 40,
          closeButton: true,
          closeOnClick: false 
        }).setHTML(`
          <div style="font-family: Arial; padding: 16px; min-width: 250px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);">
            <div style="text-align: center; margin-bottom: 12px;">
              <div style="font-size: 48px; animation: spin-cyclone 2s linear infinite; display: inline-block;">🌀</div>
            </div>
            <div style="text-align: center;">
              <strong style="color: #ef4444; font-size: 18px; text-shadow: 0 0 10px rgba(239, 68, 68, 0.5);">
                ${stormName || 'Cyclone'} Center
              </strong>
            </div>
            <hr style="margin: 10px 0; border: none; border-top: 1px solid #475569;">
            <div style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
              <div style="margin: 8px 0;">
                <strong style="color: #f59e0b;">📍 Cyclone Origin Point</strong>
              </div>
              <div>Latitude: ${lat.toFixed(4)}°N</div>
              <div>Longitude: ${lon.toFixed(4)}°E</div>
              <div style="margin-top: 10px; padding: 8px; background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; border-radius: 4px;">
                <strong style="color: #ef4444;">⚠️ Starting Position</strong>
              </div>
            </div>
          </div>
        `);

        // Create and add marker
        const marker = new maplibregl.Marker({ 
          element: el,
          anchor: 'center'
        })
          .setLngLat([lon, lat])
          .setPopup(popup)
          .addTo(map);

        // Store globally to remove later
        window.cycloneMarker = marker;

        // Auto-open popup briefly
        setTimeout(() => {
          marker.togglePopup();
          setTimeout(() => marker.togglePopup(), 3000);
        }, 500);

        console.log('✅ Animated cyclone marker added at last forecast position');
      }
    }

    return () => {
      if (window.cycloneMarker) {
        window.cycloneMarker.remove();
        window.cycloneMarker = null;
      }
    };
  }, [pastTrack, styleLoaded, stormName]);


  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
      <div ref={mapRef} className="w-full h-full" />
      
      <div className="absolute top-3 left-3 z-10 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg p-3 text-xs max-w-xs">
        <div className="font-semibold text-cyan-400 mb-2">🗺️ OpenFreeMap</div>
        <div className="text-slate-300 space-y-1">
          <div>Storm: {stormName}</div>
          <div>Districts: {districts.length}</div>
          {districts.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-700 space-y-1">
              {['Red', 'Orange', 'Yellow'].map(z => {
                const count = districts.filter(d => d.zone === z).length;
                return count > 0 ? (
                  <div key={z}>
                    {z === 'Red' ? '🔴' : z === 'Orange' ? '🟠' : '🟡'} {z}: {count}
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
