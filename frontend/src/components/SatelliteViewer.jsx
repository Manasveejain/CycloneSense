import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, Upload, Radio, RefreshCw, Satellite, Zap, Clock, Wifi, WifiOff } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function SatelliteViewer({ 
  storm, 
  spectralPreviews, 
  intensityData, 
  onImageUploaded = () => {}, 
  onFetchLive = () => {},
  isLiveFeed = false,
  isLoading = false,
  uploadedImage = null
}) {
  const [activeChannel, setActiveChannel] = useState('infrared');
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [liveImageUrl, setLiveImageUrl] = useState(null);
  const [satelliteMeta, setSatelliteMeta] = useState(null);
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshTimerRef = useRef(null);

  const channels = [
    { id: 'infrared', label: 'Infrared (IR)', desc: 'Cloud-top Brightness Temp', color: 'text-cyan-400' },
    { id: 'water_vapor', label: 'Water Vapor (WV)', desc: 'Upper-tropospheric Moisture', color: 'text-blue-400' },
    { id: 'visible', label: 'Visible (VIS)', desc: 'Optical Cloud Reflectance', color: 'text-emerald-400' },
    { id: 'microwave', label: 'Microwave (PMW)', desc: 'Deep Convective Eye Core', color: 'text-amber-400' },
  ];

  // Fetch live satellite image from backend
  const fetchLiveSatellite = useCallback(async () => {
    setIsFetchingLive(true);
    setFetchError(null);
    try {
      // Fetch metadata first
      const metaRes = await axios.get(`${API_BASE_URL}/api/satellite/meta`);
      setSatelliteMeta(metaRes.data);

      // Fetch the actual image as a blob
      const imageRes = await axios.get(`${API_BASE_URL}/api/satellite/latest`, {
        responseType: 'blob',
        timeout: 30000,
      });

      // Create an object URL from the blob
      const imageBlob = new Blob([imageRes.data], { 
        type: imageRes.headers['content-type'] || 'image/jpeg' 
      });
      const url = URL.createObjectURL(imageBlob);

      // Revoke previous URL to prevent memory leaks
      if (liveImageUrl) {
        URL.revokeObjectURL(liveImageUrl);
      }

      setLiveImageUrl(url);
      setLastFetchTime(new Date());
      console.log('✓ Live satellite image fetched:', {
        source: imageRes.headers['x-satellite-source'],
        fetchedAt: imageRes.headers['x-fetched-at'],
        size: imageRes.data.size,
      });
    } catch (err) {
      console.error('✗ Failed to fetch live satellite image:', err);
      setFetchError(
        err.response?.status === 503
          ? 'Satellite imagery temporarily unavailable'
          : err.message || 'Failed to fetch satellite image'
      );
    } finally {
      setIsFetchingLive(false);
    }
  }, [liveImageUrl]);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => {
        fetchLiveSatellite();
      }, REFRESH_INTERVAL_MS);
    }
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [autoRefresh, fetchLiveSatellite]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (liveImageUrl) {
        URL.revokeObjectURL(liveImageUrl);
      }
    };
  }, []);

  const handleFetchLive = async () => {
    await fetchLiveSatellite();
    // Also trigger the parent's onFetchLive for ML analysis
    if (typeof onFetchLive === 'function') {
      onFetchLive();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Clear live image when user uploads their own
    if (liveImageUrl) {
      URL.revokeObjectURL(liveImageUrl);
      setLiveImageUrl(null);
    }
    if (typeof onImageUploaded === 'function') {
      onImageUploaded(file);
    }
  };

  const formatTimeSince = (date) => {
    if (!date) return null;
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  // Determine which image to show: uploaded > live > spectral preview
  const currentImage = uploadedImage || liveImageUrl || (spectralPreviews ? spectralPreviews[activeChannel] : null);
  const isLiveImage = !uploadedImage && liveImageUrl;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col h-full shadow-xl backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <Satellite className="w-5 h-5 text-cyan-400" />
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-semibold text-slate-100 text-sm tracking-wide uppercase">
                Satellite Perception
              </h2>
              {(isLiveFeed || isLiveImage) && (
                <span className="flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/50 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  LIVE
                </span>
              )}
            </div>
            {satelliteMeta?.source && isLiveImage && (
              <div className="text-[10px] text-slate-400 mt-0.5">
                Source: <strong className="text-slate-300">{satelliteMeta.source}</strong>
                {lastFetchTime && (
                  <span className="ml-2">• Updated {formatTimeSince(lastFetchTime)}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg border transition-all ${
              autoRefresh
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60'
                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title={autoRefresh ? 'Auto-refresh ON (every 5 min)' : 'Enable auto-refresh'}
          >
            <Clock className="w-3 h-3" />
            <span>Auto</span>
          </button>

          {/* Fetch Live button */}
          <button
            onClick={handleFetchLive}
            disabled={isLoading || isFetchingLive}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
              isLiveImage 
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60 shadow-sm shadow-emerald-500/30' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            {isFetchingLive ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            ) : (
              <Zap className={`w-3.5 h-3.5 ${isLiveImage ? 'text-emerald-400' : 'text-amber-400'}`} />
            )}
            <span>{isFetchingLive ? 'Fetching...' : isLiveImage ? 'Refresh Live' : 'Fetch Live'}</span>
          </button>

          <label className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 cursor-pointer transition-all">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
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

      <div className="relative flex-1 my-3 min-h-[260px] bg-[#050914] rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center group">
        {(isLoading || isFetchingLive) ? (
          <div className="flex flex-col items-center gap-2 text-cyan-400">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <span className="text-xs font-medium">
              {isFetchingLive ? 'Fetching satellite imagery...' : 'Processing...'}
            </span>
            {isFetchingLive && (
              <span className="text-[10px] text-slate-500">Connecting to INSAT-3D / GOES</span>
            )}
          </div>
        ) : fetchError && !currentImage ? (
          <div className="flex flex-col items-center gap-2 text-red-400 px-4 text-center">
            <WifiOff className="w-8 h-8" />
            <span className="text-xs font-medium">{fetchError}</span>
            <button 
              onClick={handleFetchLive}
              className="mt-2 px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 transition-all"
            >
              Retry
            </button>
          </div>
        ) : currentImage ? (
          <div className="relative w-full h-full flex items-center justify-center p-2">
            <img 
              src={currentImage} 
              alt="Cyclone Satellite" 
              className="max-h-full max-w-full object-contain rounded transition-transform duration-300 group-hover:scale-105"
            />
            
            {showCrosshair && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 border-2 border-cyan-400/80 rounded-full animate-ping opacity-40"></div>
                <div className="w-12 h-12 border-2 border-dashed border-red-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                </div>
              </div>
            )}

            {/* Image info overlay */}
            <div className="absolute bottom-2 left-2 flex items-center gap-2">
              {isLiveImage && satelliteMeta && (
                <div className="bg-emerald-950/85 backdrop-blur border border-emerald-700 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-300 flex items-center gap-1">
                  <Wifi className="w-3 h-3" />
                  {satelliteMeta.source}
                </div>
              )}
            </div>

            <div className="absolute bottom-2 right-2 bg-slate-950/85 backdrop-blur border border-slate-700 px-2 py-0.5 rounded text-[11px] font-mono text-slate-300">
              Band: <strong className="text-cyan-400">{activeChannel}</strong>
            </div>
          </div>
        ) : (
          <div className="text-slate-500 text-xs flex flex-col items-center gap-1">
            <Eye className="w-8 h-8 text-slate-600 mb-1" />
            <span>Click <strong className="text-cyan-400">Fetch Live</strong> for real-time satellite imagery</span>
            <span className="text-[10px] text-slate-600">or upload your own satellite image</span>
          </div>
        )}

        <button 
          onClick={() => setShowCrosshair(!showCrosshair)}
          className={`absolute top-2 right-2 p-1.5 rounded text-xs backdrop-blur border transition-all ${
            showCrosshair 
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
              : 'bg-slate-800/60 text-slate-400 border-slate-700'
          }`}
        >
          <Radio className="w-4 h-4" />
        </button>
      </div>

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
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{ch.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <span className={`w-2 h-2 rounded-full ${isLiveImage ? 'bg-emerald-400' : 'bg-slate-500'} animate-pulse`}></span>
          <span>Source: <strong className="text-slate-200">
            {isLiveImage ? (satelliteMeta?.source || 'Live Feed') : 'CycloneSense'}
          </strong></span>
          {autoRefresh && (
            <span className="text-emerald-400 text-[10px] ml-1">• Auto-refresh ON</span>
          )}
        </div>
        <div className="text-slate-400">
          CNN: <strong className="text-cyan-300 font-mono">64x64x4</strong>
        </div>
      </div>
    </div>
  );
}
