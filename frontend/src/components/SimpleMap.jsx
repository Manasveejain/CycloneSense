import React from 'react';
import { MapPin } from 'lucide-react';

export default function SimpleMap({
  pastTrack = [],
  forecastTrack = [],
  landfall = null,
  districts = [],
  stormName = 'Cyclone',
  showTrack = true,
  showRiskZones = true
}) {
  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
      {/* Placeholder map */}
      <div className="text-center p-8">
        <MapPin className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-pulse" />
        <h3 className="text-xl font-bold text-white mb-2">Upload Cyclone Image</h3>
        <p className="text-slate-400 mb-4">
          Click "Upload Image" button to analyze your cyclone satellite image
        </p>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-sm text-slate-300">
            Once you upload an image, the dashboard will show:
          </p>
          <ul className="text-xs text-slate-400 mt-2 space-y-1 text-left">
            <li>✓ Wind speed prediction</li>
            <li>✓ Pressure estimation</li>
            <li>✓ Category classification</li>
            <li>✓ Risk zone analysis</li>
            <li>✓ Damage estimates</li>
          </ul>
        </div>
      </div>

      {/* Show data if available */}
      {(districts.length > 0 || pastTrack.length > 0) && (
        <div className="absolute bottom-4 left-4 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg p-3 text-xs">
          <div className="font-semibold text-cyan-400 mb-2">Analysis Results:</div>
          {districts.length > 0 && (
            <div className="text-slate-300">
              Districts: {districts.length} analyzed
            </div>
          )}
          {pastTrack.length > 0 && (
            <div className="text-slate-300">
              Track points: {pastTrack.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
