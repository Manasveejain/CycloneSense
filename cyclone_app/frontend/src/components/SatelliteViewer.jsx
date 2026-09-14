import React, { useState } from 'react';
import { Eye, Layers, Upload, ZoomIn, Radio, RefreshCw, Satellite, Zap } from 'lucide-react';

export default function SatelliteViewer({ 
  storm, 
  spectralPreviews, 
  intensityData, 
  onImageUploaded, 
  onFetchLive,
  isLiveFeed = false,
  isLoading 
}) {
  const [activeChannel, setActiveChannel] = useState('infrared');
  const [showCrosshair, setShowCrosshair] = useState(true);

  const channels = [
    { id: 'infrared', label: 'Infrared (IR)', desc: 'Cloud-top Brightness Temp', color: 'text-cyan-400' },
    { id: 'water_vapor', label: 'Water Vapor (WV)', desc: 'Upper-tropospheric Moisture', color: 'text-blue-400' },
    { id: 'visible', label: 'Visible (VIS)', desc: 'Optical Cloud Reflectance', color: 'text-emerald-400' },
    { id: 'microwave', label: 'Microwave (PMW)', desc: 'Deep Convective Eye Core', color: 'text-amber-400' },
  ];

  const currentImage = spectralPreviews ? spectralPreviews[activeChannel] : null;

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    onImageUploaded(file);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col h-full shadow-xl backdrop-blur-md">
      {/* Header with Live Satellite Feed Toggle */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <Satellite className="w-5 h-5 text-cyan-400" />
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-semibold text-slate-100 text-sm tracking-wide uppercase">
                Satellite Perception
              </h2>
              {isLiveFeed && (
                <span className="flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/50 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  LIVE STREAM
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live & Upload Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onFetchLive}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
              isLiveFeed 
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60 shadow-sm shadow-emerald-500/30' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Fetch real-time INSAT-3DR / NASA satellite feed"
          >
            <Zap className={`w-3.5 h-3.5 ${isLiveFeed ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span>{isLiveFeed ? 'Live Feed Active' : 'Fetch Live Satellite'}</span>
          </button>

          <label className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 cursor-pointer transition-all">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileUpload} 
              disabled={isLoading}
            />
          </label>
        </div>
      </div>

      {/* Main Imagery Display Area */}
      <div className="relative flex-1 my-3 min-h-[260px] bg-[#050914] rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center group">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 text-cyan-400">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <span className="text-xs font-medium tracking-wider">
              {isLiveFeed ? 'Streaming Live Geostationary Feed...' : 'Processing Satellite Spectral Bands...'}
            </span>
          </div>
        ) : currentImage ? (
          <div className="relative w-full h-full flex items-center justify-center p-2">
            <img 
              src={currentImage} 
              alt={`${storm?.name || 'Cyclone'} - ${activeChannel}`}
              className="max-h-full max-w-full object-contain rounded transition-transform duration-300 group-hover:scale-105"
            />
            
            {/* Eye Crosshair Overlay */}
            {showCrosshair && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 border-2 border-cyan-400/80 rounded-full animate-ping opacity-40"></div>
                <div className="w-12 h-12 border-2 border-dashed border-red-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                </div>
                <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur px-2.5 py-1 rounded text-[11px] font-mono text-cyan-300 border border-slate-700">
                  Eye Center: Lat {storm?.track_sequence?.[storm?.track_sequence?.length - 1]?.[0] || '19.5'}°N, Lon {storm?.track_sequence?.[storm?.track_sequence?.length - 1]?.[1] || '85.4'}°E
                </div>
              </div>
            )}

            {/* Live Source & Spectral Band Badge */}
            <div className="absolute bottom-2 right-2 bg-slate-950/85 backdrop-blur border border-slate-700 px-2 py-0.5 rounded text-[11px] font-mono text-slate-300 flex items-center gap-2">
              {isLiveFeed && (
                <span className="text-emerald-400 flex items-center gap-1 font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  INSAT-3DR
                </span>
              )}
              <span>Band: <strong className="text-cyan-400 uppercase">{activeChannel}</strong></span>
            </div>
          </div>
        ) : (
          <div className="text-slate-500 text-xs flex flex-col items-center gap-1">
            <Eye className="w-8 h-8 text-slate-600 mb-1" />
            <span>Select a cyclone from the list or fetch live satellite feed</span>
          </div>
        )}

        {/* Toggle Crosshair overlay control */}
        <button 
          onClick={() => setShowCrosshair(!showCrosshair)}
          className={`absolute top-2 right-2 p-1.5 rounded text-xs backdrop-blur border transition-all ${
            showCrosshair 
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
              : 'bg-slate-800/60 text-slate-400 border-slate-700'
          }`}
          title="Toggle Cyclone Eye Tracking Reticle"
        >
          <Radio className="w-4 h-4" />
        </button>
      </div>

      {/* Spectral Band Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
        {channels.map((ch) => {
          const isSelected = activeChannel === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={`px-2 py-1.5 rounded-lg text-left text-xs transition-all border ${
                isSelected
                  ? 'bg-cyan-950/70 border-cyan-500/60 text-white shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800/50 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${isSelected ? ch.color : ''}`}>{ch.label.split(' ')[0]}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>}
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">{ch.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Perception Metrics Footer */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Source: <strong className="text-slate-200">{isLiveFeed ? 'INSAT-3DR / NASA GIBS' : 'TCIR Benchmark'}</strong></span>
        </div>
        <div className="text-slate-400">
          CNN Tensor: <strong className="text-cyan-300 font-mono">64x64x4</strong>
        </div>
      </div>
    </div>
  );
}
