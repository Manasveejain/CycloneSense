import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Wind, 
  Compass, 
  AlertOctagon, 
  DollarSign, 
  Bell, 
  Layers, 
  Play, 
  RefreshCw, 
  ShieldCheck, 
  Sliders, 
  Eye, 
  Radio, 
  Activity, 
  ChevronRight,
  ExternalLink,
  Info
} from 'lucide-react';

import SatelliteViewer from './SatelliteViewer';
import CycloneMap from './CycloneMap';
import CapAlertModal from './CapAlertModal';

const API_BASE_URL = 'http://localhost:8000';

export default function Dashboard() {
  const [storms, setStorms] = useState([]);
  const [selectedStormId, setSelectedStormId] = useState('storm-fani');
  const [analysisData, setAnalysisData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  // Module layer toggles on the unified screen (no tabs!)
  const [showIntensity, setShowIntensity] = useState(true);
  const [showPath, setShowPath] = useState(true);
  const [showRiskZones, setShowRiskZones] = useState(true);
  const [showDamage, setShowDamage] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);

  // Active zone filter in alerts panel
  const [alertFilter, setAlertFilter] = useState('ALL');

  // Load available storms on mount
  useEffect(() => {
    fetchStorms();
  }, []);

  const fetchStorms = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/storms`);
      if (res.data && res.data.storms && res.data.storms.length > 0) {
        setStorms(res.data.storms);
        const defaultStorm = res.data.storms.find(s => s.id === 'storm-fani') || res.data.storms[0];
        setSelectedStormId(defaultStorm.id);
        runAnalysis(defaultStorm.id);
      }
    } catch (err) {
      console.error('Error fetching storms:', err);
    }
  };

  const runAnalysis = async (stormId = selectedStormId, overrideWind = null) => {
    setIsLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/predict/all`, {
        storm_id: stormId,
        override_wind_kt: overrideWind
      });
      setAnalysisData(res.data);
    } catch (err) {
      console.error('Error running prediction analysis:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStormChange = (newStormId) => {
    setSelectedStormId(newStormId);
    runAnalysis(newStormId);
  };

  const handleFetchLive = () => {
    setSelectedStormId('live-active-satellite');
    runAnalysis('live-active-satellite');
  };

  const handleCustomImageUpload = async (file) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API_BASE_URL}/api/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const predictedWind = res.data.intensity.predicted_wind_kt;
      // Re-run end-to-end analysis with this wind speed
      await runAnalysis(selectedStormId, predictedWind);
    } catch (err) {
      console.error('Error uploading custom satellite image:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispatchAlerts = async () => {
    if (!analysisData) return;
    setIsDispatching(true);
    try {
      await axios.post(`${API_BASE_URL}/api/alerts/dispatch`, {
        districts: analysisData.districts_risk,
        cyclone_name: analysisData.storm.name,
        broadcast_channels: ['SMS Broadcast', 'Cell Siren Broadcast', 'NDMA Early Warning Gateway', 'Coastal IMD Siren']
      });
    } catch (err) {
      console.error('Error dispatching alerts:', err);
    } finally {
      setIsDispatching(false);
    }
  };

  const currentStorm = storms.find(s => s.id === selectedStormId) || analysisData?.storm;
  const intensity = analysisData?.intensity;
  const summary = analysisData?.summary;
  const districts = analysisData?.districts_risk || [];
  const capAlerts = analysisData?.cap_alerts || [];

  const filteredDistricts = districts.filter(d => {
    if (alertFilter === 'ALL') return true;
    return d.zone.toUpperCase() === alertFilter;
  });

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-100 flex flex-col">
      {/* Top Navigation & Operational Command Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-lg">
        <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* Logo and System Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Activity className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-tight">CycloneSense</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  AI Early Warning System
                </span>
              </div>
              <p className="text-xs text-slate-400">
                End-to-End Deep Learning: CNN Imagery + GRU/LSTM Tracks + GIS Risk + XGBoost Damage
              </p>
            </div>
          </div>

          {/* Unified Controls & Storm Selector */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Storm Dropdown */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-xs text-slate-400 font-medium">Active Storm:</span>
              <select
                value={selectedStormId}
                onChange={(e) => handleStormChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-cyan-300 focus:outline-none cursor-pointer"
              >
                {storms.length > 0 ? (
                  storms.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
                      {s.name} ({s.year})
                    </option>
                  ))
                ) : (
                  <option value="storm-fani" className="bg-slate-900 text-slate-200">
                    Cyclone Fani (Odisha)
                  </option>
                )}
              </select>
            </div>

            {/* Run Analysis Action Button */}
            <button
              onClick={() => runAnalysis()}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Running Pipeline...' : 'Run End-to-End Prediction'}</span>
            </button>

            {/* Direct Broadcast Alert Trigger */}
            <button
              onClick={() => setIsAlertModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/25 transition-all"
            >
              <Bell className="w-3.5 h-3.5 animate-bounce" />
              <span>CAP Alert Broadcast</span>
              {summary && summary.red_zone_count > 0 && (
                <span className="px-1.5 py-0.2 bg-black/40 rounded-full text-[10px]">
                  {summary.red_zone_count} Red
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Unified Module Toggles Bar (All on same screen - no tabs!) */}
        <div className="max-w-[1700px] mx-auto mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-slate-300">Unified Prediction Layers:</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showIntensity} 
                onChange={(e) => setShowIntensity(e.target.checked)}
                className="rounded accent-cyan-500" 
              />
              <span className={showIntensity ? 'text-cyan-300 font-medium' : 'text-slate-500'}>
                1. Intensity (CNN)
              </span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showPath} 
                onChange={(e) => setShowPath(e.target.checked)}
                className="rounded accent-cyan-500" 
              />
              <span className={showPath ? 'text-cyan-300 font-medium' : 'text-slate-500'}>
                2. Path & Landfall (GRU/LSTM)
              </span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showRiskZones} 
                onChange={(e) => setShowRiskZones(e.target.checked)}
                className="rounded accent-cyan-500" 
              />
              <span className={showRiskZones ? 'text-cyan-300 font-medium' : 'text-slate-500'}>
                3. Risk Zones (Red/Orange/Yellow)
              </span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showDamage} 
                onChange={(e) => setShowDamage(e.target.checked)}
                className="rounded accent-cyan-500" 
              />
              <span className={showDamage ? 'text-cyan-300 font-medium' : 'text-slate-500'}>
                4. Damage Estimation (XGBoost)
              </span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showAlerts} 
                onChange={(e) => setShowAlerts(e.target.checked)}
                className="rounded accent-cyan-500" 
              />
              <span className={showAlerts ? 'text-cyan-300 font-medium' : 'text-slate-500'}>
                5. Region Push Alerts
              </span>
            </label>
          </div>
        </div>
      </header>

      {/* Main Command Center Body */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 space-y-4">
        
        {/* Top Summary Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Intensity */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Wind className="w-4 h-4 text-cyan-400" />
                Predicted Peak Intensity
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                CNN Module
              </span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-extrabold text-white font-mono flex items-baseline gap-2">
                <span>{intensity ? intensity.predicted_wind_kt : '--'}</span>
                <span className="text-xs text-slate-400 font-sans font-normal">knots</span>
                <span className="text-xs text-cyan-400 font-mono">({intensity ? intensity.predicted_wind_kmh : '--'} km/h)</span>
              </div>
              <div className="text-xs font-semibold text-amber-400 truncate mt-1">
                {intensity ? intensity.imd_classification : 'Calculating...'}
              </div>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
              <span>Central Pressure: <strong className="text-slate-200 font-mono">{intensity ? intensity.central_pressure_est_mb : '--'} mb</strong></span>
              <span className="text-red-400 font-bold">{intensity ? intensity.threat_level : ''}</span>
            </div>
          </div>

          {/* Card 2: Path & Landfall */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-red-400" />
                Forecast Path & Landfall
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800/40">
                LSTM Module
              </span>
            </div>
            <div className="my-2">
              <div className="text-lg font-bold text-white truncate">
                {analysisData?.landfall_prediction?.nearest_coastal_hub || 'Coastline Target'}
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-1 mt-1">
                <span>ETA:</span>
                <strong className="text-amber-400 font-mono">{analysisData?.landfall_prediction?.estimated_time || '--'}</strong>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-1.5 flex items-center justify-between font-mono">
              <span>Coords: {analysisData?.landfall_prediction?.lat?.toFixed(2)}°N, {analysisData?.landfall_prediction?.lon?.toFixed(2)}°E</span>
              <span className="text-cyan-400 font-sans font-medium">Trajectory: Recurving</span>
            </div>
          </div>

          {/* Card 3: Risk Zoning */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-orange-400" />
                Coastal Risk Zoning
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-950 text-orange-400 border border-orange-800/40">
                GIS AHP Module
              </span>
            </div>
            <div className="my-2 flex items-center gap-2">
              <div className="flex-1 bg-red-950/40 border border-red-500/40 p-2 rounded-lg text-center">
                <div className="text-lg font-bold text-red-400 font-mono">{summary ? summary.red_zone_count : 0}</div>
                <div className="text-[10px] text-red-300 font-semibold uppercase">Red Zone</div>
              </div>
              <div className="flex-1 bg-orange-950/40 border border-orange-500/40 p-2 rounded-lg text-center">
                <div className="text-lg font-bold text-orange-400 font-mono">{summary ? summary.orange_zone_count : 0}</div>
                <div className="text-[10px] text-orange-300 font-semibold uppercase">Orange</div>
              </div>
              <div className="flex-1 bg-yellow-950/40 border border-yellow-500/40 p-2 rounded-lg text-center">
                <div className="text-lg font-bold text-yellow-400 font-mono">{summary ? summary.yellow_zone_count : 0}</div>
                <div className="text-[10px] text-yellow-300 font-semibold uppercase">Yellow</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-1.5 flex items-center justify-between">
              <span>Population At Direct Risk:</span>
              <strong className="text-white font-mono">
                {summary ? (summary.total_population_affected / 1e6).toFixed(1) : '--'}M
              </strong>
            </div>
          </div>

          {/* Card 4: Damage Estimation */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Estimated Economic Damage
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                XGBoost Model
              </span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                ${summary ? summary.total_damage_usd_m : '--'}M
              </div>
              <div className="text-xs text-slate-300 font-semibold mt-0.5">
                Approx. <strong className="text-amber-300">₹{summary ? summary.total_damage_inr_crores : '--'} Crores</strong>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-1.5 flex items-center justify-between">
              <span>Max District Impact:</span>
              <strong className="text-slate-200">
                {districts.length > 0 ? `${districts[0].name} ($${districts[0].estimated_damage_usd_m}M)` : '--'}
              </strong>
            </div>
          </div>
        </div>

        {/* Central Unified Grid: Satellite Perception + GIS Leaflet Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Left Column (4 cols): Satellite Perception & Damage Matrix */}
          <div className="lg:col-span-4 space-y-4 flex flex-col">
            {/* Satellite Viewer Component */}
            <div className="flex-1">
              <SatelliteViewer
                storm={currentStorm}
                spectralPreviews={analysisData?.spectral_previews}
                intensityData={intensity}
                onImageUploaded={handleCustomImageUpload}
                onFetchLive={handleFetchLive}
                isLiveFeed={selectedStormId === 'live-active-satellite'}
                isLoading={isLoading}
              />
            </div>

            {/* Damage Breakdown Card (XGBoost Insights) */}
            {showDamage && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-semibold text-slate-100 text-xs tracking-wide uppercase flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    Damage & Asset Exposure Matrix (XGBoost)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Model: Regressor</span>
                </div>

                {/* Sector bars */}
                <div className="mt-3 space-y-2.5 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Residential & Coastal Embankments</span>
                      <strong className="text-emerald-400 font-mono">42%</strong>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full w-[42%]"></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Agriculture, Paddy & Aquaculture</span>
                      <strong className="text-amber-400 font-mono">33%</strong>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full w-[33%]"></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Power Grids, Telecom & Ports</span>
                      <strong className="text-cyan-400 font-mono">25%</strong>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-cyan-500 h-full rounded-full w-[25%]"></div>
                    </div>
                  </div>
                </div>

                {/* Top Impacted Districts Ranking */}
                <div className="mt-4 pt-3 border-t border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Priority Impact Districts
                  </div>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                    {districts.slice(0, 4).map((d, i) => (
                      <div key={d.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-950/60 border border-slate-800/60">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            d.zone === 'Red' ? 'bg-red-500' : d.zone === 'Orange' ? 'bg-orange-500' : 'bg-yellow-500'
                          }`}></span>
                          <span className="font-medium text-slate-200">{d.name}</span>
                          <span className="text-[10px] text-slate-500">({d.state})</span>
                        </div>
                        <span className="text-emerald-400 font-mono font-semibold">${d.estimated_damage_usd_m}M</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column (8 cols): Interactive GIS Leaflet Map & Alerts Panel */}
          <div className="lg:col-span-8 space-y-4 flex flex-col">
            {/* Interactive Leaflet GIS Map */}
            <div className="h-[480px] w-full">
              <CycloneMap
                pastTrack={analysisData?.past_track || []}
                forecastTrack={analysisData?.forecast_track || []}
                landfall={analysisData?.landfall_prediction}
                districts={districts}
                stormName={currentStorm?.name || 'Cyclone'}
                showTrack={showPath}
                showRiskZones={showRiskZones}
                satelliteImageUrl={analysisData?.spectral_previews?.infrared}
                spectralPreviews={analysisData?.spectral_previews}
              />
            </div>

            {/* Actionable Alerts & District Risk Broadcast Strip */}
            {showAlerts && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-semibold text-slate-100 text-xs tracking-wide uppercase">
                      Actionable Regional Push Alerts (CAP Protocol)
                    </h3>
                  </div>

                  {/* Zone Category Filter Buttons */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      onClick={() => setAlertFilter('ALL')}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                        alertFilter === 'ALL' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      All Zones ({districts.length})
                    </button>
                    <button
                      onClick={() => setAlertFilter('RED')}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                        alertFilter === 'RED' ? 'bg-red-600 text-white' : 'bg-slate-800 text-red-400 hover:bg-slate-700'
                      }`}
                    >
                      Red Evacuation ({summary?.red_zone_count || 0})
                    </button>
                    <button
                      onClick={() => setAlertFilter('ORANGE')}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                        alertFilter === 'ORANGE' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-orange-400 hover:bg-slate-700'
                      }`}
                    >
                      Orange Alert ({summary?.orange_zone_count || 0})
                    </button>
                    <button
                      onClick={() => setAlertFilter('YELLOW')}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                        alertFilter === 'YELLOW' ? 'bg-yellow-600 text-slate-950' : 'bg-slate-800 text-yellow-400 hover:bg-slate-700'
                      }`}
                    >
                      Yellow Watch ({summary?.yellow_zone_count || 0})
                    </button>
                  </div>
                </div>

                {/* District Alerts Carousel / Grid */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {filteredDistricts.length > 0 ? (
                    filteredDistricts.map(dist => {
                      const isRed = dist.zone === 'Red';
                      const isOrange = dist.zone === 'Orange';

                      return (
                        <div 
                          key={dist.id}
                          className={`p-3 rounded-xl border transition-all ${
                            isRed 
                              ? 'bg-red-950/20 border-red-500/40 hover:bg-red-950/30'
                              : isOrange
                                ? 'bg-orange-950/20 border-orange-500/40 hover:bg-orange-950/30'
                                : 'bg-yellow-950/10 border-yellow-500/30 hover:bg-yellow-950/20'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-100 text-xs">{dist.name}, {dist.state}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                              isRed 
                                ? 'text-red-400 bg-red-950 border-red-500/60 animate-pulse'
                                : isOrange
                                  ? 'text-orange-400 bg-orange-950 border-orange-500/60'
                                  : 'text-yellow-400 bg-yellow-950 border-yellow-500/60'
                            }`}>
                              {dist.zone} Zone
                            </span>
                          </div>
                          
                          <div className="text-[11px] text-slate-300 font-mono my-1 flex items-center justify-between">
                            <span>Score: <strong>{dist.risk_score}</strong></span>
                            <span>Eye Dist: <strong>{dist.distance_to_path_km} km</strong></span>
                          </div>

                          <div className="text-[11px] text-slate-400 line-clamp-2 italic mt-1 bg-black/30 p-1.5 rounded">
                            "{dist.action}"
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-3 text-center py-6 text-slate-500 text-xs">
                      No coastal districts found for selected filter.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* CAP Alert Broadcast Modal */}
      <CapAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        capAlerts={capAlerts}
        cycloneName={currentStorm?.name || 'Cyclone'}
        onDispatch={handleDispatchAlerts}
        isDispatching={isDispatching}
      />
    </div>
  );
}
