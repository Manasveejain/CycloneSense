import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Navigation } from 'lucide-react';

export default function OpenFreeMapCyclone({
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

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Default center - Bay of Bengal
    let centerLng = 85.5;
    let centerLat = 19.5;

    // Try to use landfall coordinates if valid
    if (landfall && typeof landfall.lon === 'number' && typeof landfall.lat === 'number' && 
        !isNaN(landfall.lon) && !isNaN(landfall.lat)) {
      centerLng = landfall.lon;
      centerLat = landfall.lat;
    } 
    // Try first forecast track point
    else if (forecastTrack && forecastTrack.length > 0 && forecastTrack[0].length === 2) {
      const [lat, lng] = forecastTrack[0];
      if (!isNaN(lat) && !isNaN(lng)) {
        centerLat = lat;
        centerLng = lng;
      }
    }
    // Try first past track point
    else if (pastTrack && pastTrack.length > 0 && pastTrack[0].length === 2) {
      const [lat, lng] = pastTrack[0];
      if (!isNaN(lat) && !isNaN(lng)) {
        centerLat = lat;
        centerLng = lng;
      }
    }

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty', // Free, no API key needed!
      center: [centerLng, centerLat],
      zoom: 6,
      pitch: 0,
      bearing: 0
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    mapInstanceRef.current = map;

    // Clean up on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update tracks and markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Remove existing layers and sources
    ['past-track', 'forecast-track', 'past-markers', 'forecast-markers', 
     'landfall-marker', 'districts-circles', 'districts-markers'].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });

    // 1. Plot Past Track (Observed)
    if (showTrack && pastTrack.length > 0) {
      // Convert track coordinates - handle both array [lat,lng] and object {lat,lon} formats
      const pastCoords = pastTrack.map(pt => {
        if (Array.isArray(pt)) {
          return [pt[1], pt[0]]; // [lng, lat] for MapLibre
        }
        return [pt.lon, pt.lat];
      }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));

      if (pastCoords.length > 0) {
        map.addSource('past-track', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: pastCoords
            }
          }
        });

        map.addLayer({
          id: 'past-track',
          type: 'line',
          source: 'past-track',
          paint: {
            'line-color': '#06b6d4',
            'line-width': 4,
            'line-opacity': 0.9
          }
        });

        // Past track markers
        map.addSource('past-markers', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: pastCoords.map((coord, idx) => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: coord
              },
              properties: {
                title: idx === pastCoords.length - 1 ? 'Current Storm Center' : `Past #${idx + 1}`,
                wind: 85,
                isLatest: idx === pastCoords.length - 1
              }
            }))
          }
        });

      map.addLayer({
        id: 'past-markers',
        type: 'circle',
        source: 'past-markers',
        paint: {
          'circle-radius': ['case', ['get', 'isLatest'], 10, 6],
          'circle-color': ['case', ['get', 'isLatest'], '#06b6d4', '#22d3ee'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': ['case', ['get', 'isLatest'], 1, 0.7]
        }
      });

      // Add popups on click
      map.on('click', 'past-markers', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const props = e.features[0].properties;
        
        new maplibregl.Popup()
          .setLngLat(coordinates)
          .setHTML(`
            <div style="padding: 8px; font-family: sans-serif;">
              <div style="font-weight: bold; color: #06b6d4; margin-bottom: 4px;">${props.title}</div>
              <div>Wind: <strong style="color: #f59e0b;">${props.wind} kt</strong></div>
            </div>
          `)
          .addTo(map);
      });

      map.on('mouseenter', 'past-markers', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'past-markers', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // 2. Plot Forecast Track (Predicted)
    if (showTrack && forecastTrack.length > 0) {
      // Convert forecast coordinates - handle both array [lat,lng] and object {lat,lon} formats
      const forecastCoords = forecastTrack.map(pt => {
        if (Array.isArray(pt)) {
          return [pt[1], pt[0]]; // [lng, lat] for MapLibre
        }
        return [pt.lon, pt.lat];
      }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
      
      // Connect from last observed point
      if (pastTrack.length > 0 && forecastCoords.length > 0) {
        const lastPast = pastTrack[pastTrack.length - 1];
        const lastPastCoord = Array.isArray(lastPast) ? [lastPast[1], lastPast[0]] : [lastPast.lon, lastPast.lat];
        if (!isNaN(lastPastCoord[0]) && !isNaN(lastPastCoord[1])) {
          forecastCoords.unshift(lastPastCoord);
        }
      }

      if (forecastCoords.length > 0) {
        map.addSource('forecast-track', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: forecastCoords
            }
          }
        });

      map.addLayer({
        id: 'forecast-track',
        type: 'line',
        source: 'forecast-track',
        paint: {
          'line-color': '#ef4444',
          'line-width': 4,
          'line-opacity': 0.9,
          'line-dasharray': [2, 2]
        }
      });

      // Forecast markers
      map.addSource('forecast-markers', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: forecastCoords.slice(1).map((coord, idx) => ({ // Skip first (connection point)
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: coord
            },
            properties: {
              title: `Forecast +${(idx + 1) * 6}h`,
              wind: 120,
              hour: (idx + 1) * 6
            }
          }))
        }
      });

      map.addLayer({
        id: 'forecast-markers',
        type: 'circle',
        source: 'forecast-markers',
        paint: {
          'circle-radius': 7,
          'circle-color': '#ef4444',
          'circle-stroke-color': '#7f1d1d',
          'circle-stroke-width': 2,
          'circle-opacity': 0.8
        }
      });

      map.on('click', 'forecast-markers', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const props = e.features[0].properties;
        
        new maplibregl.Popup()
          .setLngLat(coordinates)
          .setHTML(`
            <div style="padding: 8px; font-family: sans-serif;">
              <div style="font-weight: bold; color: #ef4444; margin-bottom: 4px;">LSTM Prediction +${props.hour}h</div>
              <div>Wind: <strong style="color: #f59e0b;">${props.wind} kt</strong></div>
            </div>
          `)
          .addTo(map);
      });

      map.on('mouseenter', 'forecast-markers', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'forecast-markers', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // 3. Landfall Marker
    if (landfall && landfall.lat && landfall.lon) {
      map.addSource('landfall-marker', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [landfall.lon, landfall.lat]
          },
          properties: {
            title: 'Predicted Landfall',
            location: landfall.nearest_coastal_hub,
            eta: landfall.estimated_time
          }
        }
      });

      map.addLayer({
        id: 'landfall-marker',
        type: 'circle',
        source: 'landfall-marker',
        paint: {
          'circle-radius': 12,
          'circle-color': '#f59e0b',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
          'circle-opacity': 1
        }
      });

      map.on('click', 'landfall-marker', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const props = e.features[0].properties;
        
        new maplibregl.Popup()
          .setLngLat(coordinates)
          .setHTML(`
            <div style="padding: 8px; font-family: sans-serif;">
              <div style="font-weight: bold; color: #f59e0b; margin-bottom: 4px;">Landfall Sector</div>
              <div>Region: <strong>${props.location}</strong></div>
              <div>ETA: <strong>${props.eta}</strong></div>
            </div>
          `)
          .addTo(map);
      });
    }

    // 4. District Risk Zones
    if (showRiskZones && districts.length > 0) {
      const districtFeatures = districts
        .filter(d => d.lat && d.lon && !isNaN(d.lat) && !isNaN(d.lon))
        .map(dist => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [dist.lon, dist.lat]
          },
          properties: {
            name: dist.name,
            state: dist.state,
            zone: dist.zone || 'Yellow',
            risk: dist.risk_score,
            distance: dist.distance_to_path_km,
            damage: dist.estimated_damage_usd_m,
            action: dist.action
          }
        }));

      map.addSource('districts-circles', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: districtFeatures
        }
      });

      // Circles for risk zones
      map.addLayer({
        id: 'districts-circles',
        type: 'circle',
        source: 'districts-circles',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, 15,
            10, 30
          ],
          'circle-color': [
            'match',
            ['get', 'zone'],
            'Red', '#ef4444',
            'Orange', '#f97316',
            '#eab308' // Yellow
          ],
          'circle-opacity': [
            'match',
            ['get', 'zone'],
            'Red', 0.25,
            'Orange', 0.20,
            0.15 // Yellow
          ],
          'circle-stroke-color': [
            'match',
            ['get', 'zone'],
            'Red', '#ef4444',
            'Orange', '#f97316',
            '#eab308'
          ],
          'circle-stroke-width': [
            'match',
            ['get', 'zone'],
            'Red', 2.5,
            1.5
          ],
          'circle-stroke-opacity': 0.6
        }
      });

      // District markers
      map.addSource('districts-markers', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: districtFeatures
        }
      });

      map.addLayer({
        id: 'districts-markers',
        type: 'circle',
        source: 'districts-markers',
        paint: {
          'circle-radius': 8,
          'circle-color': [
            'match',
            ['get', 'zone'],
            'Red', '#ef4444',
            'Orange', '#f97316',
            '#eab308'
          ],
          'circle-stroke-color': '#0f172a',
          'circle-stroke-width': 2
        }
      });

      map.on('click', 'districts-markers', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const props = e.features[0].properties;
        
        new maplibregl.Popup()
          .setLngLat(coordinates)
          .setHTML(`
            <div style="padding: 10px; font-family: sans-serif; min-width: 220px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0;">
                <span style="font-weight: bold;">${props.name}</span>
                <span style="background: ${props.zone === 'Red' ? '#ef4444' : props.zone === 'Orange' ? '#f97316' : '#eab308'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">${props.zone}</span>
              </div>
              <div style="font-size: 12px;">
                <div><strong>State:</strong> ${props.state}</div>
                <div><strong>Risk Score:</strong> ${props.risk}/10</div>
                <div><strong>Distance:</strong> ${props.distance} km</div>
                <div><strong>Loss:</strong> $${props.damage}M</div>
              </div>
              <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 11px; font-style: italic; color: #64748b;">
                "${props.action}"
              </div>
            </div>
          `)
          .addTo(map);
      });

      map.on('mouseenter', 'districts-markers', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'districts-markers', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // Fit map bounds
    const allCoords = [];
    
    // Add past track coordinates
    if (pastTrack && pastTrack.length > 0) {
      pastTrack.forEach(pt => {
        if (Array.isArray(pt) && pt.length === 2 && !isNaN(pt[1]) && !isNaN(pt[0])) {
          allCoords.push([pt[1], pt[0]]);
        } else if (pt.lon && pt.lat && !isNaN(pt.lon) && !isNaN(pt.lat)) {
          allCoords.push([pt.lon, pt.lat]);
        }
      });
    }
    
    // Add forecast track coordinates
    if (forecastTrack && forecastTrack.length > 0) {
      forecastTrack.forEach(pt => {
        if (Array.isArray(pt) && pt.length === 2 && !isNaN(pt[1]) && !isNaN(pt[0])) {
          allCoords.push([pt[1], pt[0]]);
        } else if (pt.lon && pt.lat && !isNaN(pt.lon) && !isNaN(pt.lat)) {
          allCoords.push([pt.lon, pt.lat]);
        }
      });
    }
    
    // Add district coordinates
    if (districts && districts.length > 0) {
      districts.forEach(d => {
        if (d.lat && d.lon && !isNaN(d.lat) && !isNaN(d.lon)) {
          allCoords.push([d.lon, d.lat]);
        }
      });
    }

    if (landfall && landfall.lat && landfall.lon && !isNaN(landfall.lat) && !isNaN(landfall.lon)) {
      allCoords.push([landfall.lon, landfall.lat]);
    }

    if (allCoords.length > 0) {
      const bounds = allCoords.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new maplibregl.LngLatBounds(allCoords[0], allCoords[0]));

      map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 8
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
            OpenFreeMap (No API Key!)
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
            <span className="text-slate-300 font-medium">Red Zone (Critical)</span>
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
          Free & open-source mapping by OpenFreeMap
        </div>
      </div>
    </div>
  );
}
