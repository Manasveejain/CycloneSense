import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Wind, Compass, AlertOctagon, DollarSign, Bell, Layers, Play, RefreshCw, 
  ShieldCheck, Sliders, Eye, Radio, Activity, ChevronRight, ExternalLink, Info, Upload, Zap
} from 'lucide-react';
import SatelliteViewer from './SatelliteViewer';
import WorkingMap from './WorkingMap';
import CapAlertModal from './CapAlertModal';

const API_BASE_URL = 'http://localhost:8000';

const SAMPLE_ANALYSIS = {
  intensity: {
    predicted_wind_kt: 150,
    predicted_wind_kmh: 278,
    central_pressure_est_mb: 920,
    imd_classification: 'Category 4',
    threat_level: 'HIGH',
    confidence: 0.92
  },
  summary: {
    red_zone_count: 3,
    orange_zone_count: 5,
    yellow_zone_count: 8,
    total_population_affected: 2500000,
    total_damage_usd_m: 1250,
    total_damage_inr_crores: 104
  },
  past_track: [[19.8, 85.8], [20.1, 86.0], [20.4, 86.2]],
  forecast_track: [[20.7, 86.4], [21.0, 86.6], [21.3, 86.8], [21.6, 87.0]],
  districts_risk: [
    { name: 'Puri', state: 'Odisha', lat: 19.8, lon: 85.8, zone: 'Red', risk_score: 9, distance_to_path_km: 10, estimated_damage_usd_m: 450, population_affected: 1698730, action: 'Evacuate immediately' },
    { name: 'Khordha', state: 'Odisha', lat: 20.1, lon: 85.6, zone: 'Red', risk_score: 8, distance_to_path_km: 15, estimated_damage_usd_m: 420, population_affected: 2246341, action: 'Evacuate immediately' },
    { name: 'Jagatsinghpur', state: 'Odisha', lat: 20.3, lon: 86.1, zone: 'Orange', risk_score: 7, distance_to_path_km: 25, estimated_damage_usd_m: 280, population_affected: 1136971, action: 'Prepare for evacuation' },
  ]
};

export default function DashboardModern() {
  const [storms, setStorms] = useState([]);
  const [selectedStormId, setSelectedStormId] = useState('storm-fani');
  const [analysisData, setAnalysisData] = useState(SAMPLE_ANALYSIS);
  const [isLoading, setIsLoading] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isLivePrediction, setIsLivePrediction] = useState(false);
  
  const [showIntensity, setShowIntensity] = useState(true);
  const [showPath, setShowPath] = useState(true);
  const [showRiskZones, setShowRiskZones] = useState(true);
  const [showDamage, setShowDamage] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);

  useEffect(() => {
    loadStorms();
  }, []);

  const loadStorms = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/storms`);
      if (res.data?.storms) {
        setStorms(res.data.storms);
      }
    } catch (e) {
      console.error('Failed to load storms:', e);
      setStorms([
        { id: 'storm-fani', name: 'Cyclone Fani', year: 2019, basin: 'Bay of Bengal' },
        { id: 'storm-amphan', name: 'Cyclone Amphan', year: 2020, basin: 'Bay of Bengal' },
      ]);
    }
  };

  const handleStormChange = (stormId) => {
    setSelectedStormId(stormId);
    setUploadedImage(null); // Clear uploaded image when changing storm
    
    // Comprehensive storm data with unique tracks, intensity, and risk zones for each cyclone
    const stormData = {
      'storm-fani': {
        intensity: {
          predicted_wind_kt: 150,
          predicted_wind_kmh: 278,
          central_pressure_est_mb: 920,
          imd_classification: 'Extremely Severe Cyclonic Storm',
          threat_level: 'EXTREME',
          confidence: 0.94
        },
        past_track: [[19.8, 85.8], [20.1, 86.0], [20.4, 86.2], [20.7, 86.4]],
        forecast_track: [[21.0, 86.6], [21.3, 86.8], [21.6, 87.0], [21.9, 87.2]],
        districts_risk: [
          { name: 'Puri', state: 'Odisha', lat: 19.8, lon: 85.8, zone: 'Red', risk_score: 10, distance_to_path_km: 5, estimated_damage_usd_m: 550, population_affected: 1698730, action: 'Evacuate immediately' },
          { name: 'Khordha', state: 'Odisha', lat: 20.1, lon: 85.6, zone: 'Red', risk_score: 9, distance_to_path_km: 12, estimated_damage_usd_m: 480, population_affected: 2246341, action: 'Evacuate immediately' },
          { name: 'Jagatsinghpur', state: 'Odisha', lat: 20.3, lon: 86.1, zone: 'Red', risk_score: 9, distance_to_path_km: 8, estimated_damage_usd_m: 420, population_affected: 1136971, action: 'Evacuate immediately' },
          { name: 'Kendrapara', state: 'Odisha', lat: 20.5, lon: 86.4, zone: 'Orange', risk_score: 8, distance_to_path_km: 22, estimated_damage_usd_m: 320, population_affected: 1440361, action: 'Prepare for evacuation' },
          { name: 'Bhadrak', state: 'Odisha', lat: 21.0, lon: 86.5, zone: 'Orange', risk_score: 7, distance_to_path_km: 28, estimated_damage_usd_m: 280, population_affected: 1506337, action: 'Prepare for evacuation' },
          { name: 'Balasore', state: 'Odisha', lat: 21.5, lon: 86.9, zone: 'Orange', risk_score: 7, distance_to_path_km: 30, estimated_damage_usd_m: 260, population_affected: 2320529, action: 'Stay alert' },
          { name: 'Cuttack', state: 'Odisha', lat: 20.5, lon: 85.8, zone: 'Yellow', risk_score: 6, distance_to_path_km: 45, estimated_damage_usd_m: 180, population_affected: 2624470, action: 'Monitor updates' },
          { name: 'Ganjam', state: 'Odisha', lat: 19.3, lon: 85.0, zone: 'Yellow', risk_score: 5, distance_to_path_km: 55, estimated_damage_usd_m: 150, population_affected: 3520151, action: 'Monitor updates' }
        ],
        summary: {
          red_zone_count: 3,
          orange_zone_count: 3,
          yellow_zone_count: 2,
          total_population_affected: 16493890,
          total_damage_usd_m: 2640,
          total_damage_inr_crores: 220
        }
      },
      'storm-amphan': {
        intensity: {
          predicted_wind_kt: 140,
          predicted_wind_kmh: 259,
          central_pressure_est_mb: 925,
          imd_classification: 'Super Cyclonic Storm',
          threat_level: 'EXTREME',
          confidence: 0.91
        },
        past_track: [[18.5, 84.2], [18.8, 84.5], [19.1, 84.8]],
        forecast_track: [[19.4, 85.1], [19.7, 85.4], [20.0, 85.7], [20.3, 86.0]],
        districts_risk: [
          { name: 'South 24 Parganas', state: 'West Bengal', lat: 22.16, lon: 88.43, zone: 'Red', risk_score: 10, distance_to_path_km: 3, estimated_damage_usd_m: 620, population_affected: 8161961, action: 'Evacuate immediately' },
          { name: 'North 24 Parganas', state: 'West Bengal', lat: 22.61, lon: 88.42, zone: 'Red', risk_score: 9, distance_to_path_km: 8, estimated_damage_usd_m: 580, population_affected: 10009781, action: 'Evacuate immediately' },
          { name: 'Kolkata', state: 'West Bengal', lat: 22.57, lon: 88.36, zone: 'Red', risk_score: 9, distance_to_path_km: 10, estimated_damage_usd_m: 520, population_affected: 4496694, action: 'Evacuate immediately' },
          { name: 'Howrah', state: 'West Bengal', lat: 22.58, lon: 88.31, zone: 'Orange', risk_score: 8, distance_to_path_km: 18, estimated_damage_usd_m: 390, population_affected: 4850029, action: 'Prepare for evacuation' },
          { name: 'Hooghly', state: 'West Bengal', lat: 22.90, lon: 88.39, zone: 'Orange', risk_score: 7, distance_to_path_km: 25, estimated_damage_usd_m: 310, population_affected: 5519145, action: 'Prepare for evacuation' },
          { name: 'East Midnapore', state: 'West Bengal', lat: 22.02, lon: 87.75, zone: 'Orange', risk_score: 7, distance_to_path_km: 32, estimated_damage_usd_m: 280, population_affected: 5095875, action: 'Stay alert' },
          { name: 'Nadia', state: 'West Bengal', lat: 23.47, lon: 88.56, zone: 'Yellow', risk_score: 5, distance_to_path_km: 48, estimated_damage_usd_m: 160, population_affected: 5167600, action: 'Monitor updates' }
        ],
        summary: {
          red_zone_count: 3,
          orange_zone_count: 3,
          yellow_zone_count: 1,
          total_population_affected: 43301085,
          total_damage_usd_m: 2860,
          total_damage_inr_crores: 238
        }
      },
      'storm-yaas': {
        intensity: {
          predicted_wind_kt: 115,
          predicted_wind_kmh: 213,
          central_pressure_est_mb: 950,
          imd_classification: 'Very Severe Cyclonic Storm',
          threat_level: 'HIGH',
          confidence: 0.89
        },
        past_track: [[19.2, 85.5], [19.5, 85.8], [19.8, 86.1]],
        forecast_track: [[20.1, 86.4], [20.4, 86.7], [20.7, 87.0], [21.0, 87.3]],
        districts_risk: [
          { name: 'Balasore', state: 'Odisha', lat: 21.5, lon: 86.9, zone: 'Red', risk_score: 9, distance_to_path_km: 7, estimated_damage_usd_m: 420, population_affected: 2320529, action: 'Evacuate immediately' },
          { name: 'Bhadrak', state: 'Odisha', lat: 21.0, lon: 86.5, zone: 'Red', risk_score: 8, distance_to_path_km: 12, estimated_damage_usd_m: 380, population_affected: 1506337, action: 'Evacuate immediately' },
          { name: 'Kendrapara', state: 'Odisha', lat: 20.5, lon: 86.4, zone: 'Orange', risk_score: 8, distance_to_path_km: 20, estimated_damage_usd_m: 340, population_affected: 1440361, action: 'Prepare for evacuation' },
          { name: 'Jajpur', state: 'Odisha', lat: 20.85, lon: 86.33, zone: 'Orange', risk_score: 7, distance_to_path_km: 26, estimated_damage_usd_m: 280, population_affected: 1827192, action: 'Prepare for evacuation' },
          { name: 'Mayurbhanj', state: 'Odisha', lat: 21.93, lon: 86.73, zone: 'Orange', risk_score: 6, distance_to_path_km: 35, estimated_damage_usd_m: 220, population_affected: 2519738, action: 'Stay alert' },
          { name: 'Jagatsinghpur', state: 'Odisha', lat: 20.3, lon: 86.1, zone: 'Yellow', risk_score: 5, distance_to_path_km: 42, estimated_damage_usd_m: 170, population_affected: 1136971, action: 'Monitor updates' },
          { name: 'Puri', state: 'Odisha', lat: 19.8, lon: 85.8, zone: 'Yellow', risk_score: 4, distance_to_path_km: 50, estimated_damage_usd_m: 130, population_affected: 1698730, action: 'Monitor updates' }
        ],
        summary: {
          red_zone_count: 2,
          orange_zone_count: 3,
          yellow_zone_count: 2,
          total_population_affected: 12449858,
          total_damage_usd_m: 1940,
          total_damage_inr_crores: 162
        }
      },
      'storm-biparjoy': {
        intensity: {
          predicted_wind_kt: 105,
          predicted_wind_kmh: 194,
          central_pressure_est_mb: 960,
          imd_classification: 'Very Severe Cyclonic Storm',
          threat_level: 'HIGH',
          confidence: 0.87
        },
        past_track: [[19.0, 83.5], [19.3, 83.8], [19.6, 84.1]],
        forecast_track: [[19.9, 84.4], [20.2, 84.7], [20.5, 85.0], [20.8, 85.3]],
        districts_risk: [
          { name: 'Ganjam', state: 'Odisha', lat: 19.3, lon: 85.0, zone: 'Red', risk_score: 9, distance_to_path_km: 6, estimated_damage_usd_m: 390, population_affected: 3520151, action: 'Evacuate immediately' },
          { name: 'Gajapati', state: 'Odisha', lat: 19.0, lon: 84.1, zone: 'Red', risk_score: 8, distance_to_path_km: 10, estimated_damage_usd_m: 350, population_affected: 577817, action: 'Evacuate immediately' },
          { name: 'Rayagada', state: 'Odisha', lat: 19.16, lon: 83.42, zone: 'Orange', risk_score: 7, distance_to_path_km: 22, estimated_damage_usd_m: 290, population_affected: 967911, action: 'Prepare for evacuation' },
          { name: 'Kandhamal', state: 'Odisha', lat: 20.22, lon: 84.13, zone: 'Orange', risk_score: 7, distance_to_path_km: 28, estimated_damage_usd_m: 260, population_affected: 731952, action: 'Prepare for evacuation' },
          { name: 'Puri', state: 'Odisha', lat: 19.8, lon: 85.8, zone: 'Orange', risk_score: 6, distance_to_path_km: 35, estimated_damage_usd_m: 210, population_affected: 1698730, action: 'Stay alert' },
          { name: 'Khordha', state: 'Odisha', lat: 20.1, lon: 85.6, zone: 'Yellow', risk_score: 5, distance_to_path_km: 45, estimated_damage_usd_m: 160, population_affected: 2246341, action: 'Monitor updates' },
          { name: 'Nayagarh', state: 'Odisha', lat: 20.12, lon: 85.09, zone: 'Yellow', risk_score: 4, distance_to_path_km: 52, estimated_damage_usd_m: 120, population_affected: 962789, action: 'Monitor updates' }
        ],
        summary: {
          red_zone_count: 2,
          orange_zone_count: 3,
          yellow_zone_count: 2,
          total_population_affected: 10705691,
          total_damage_usd_m: 1780,
          total_damage_inr_crores: 148
        }
      }
    };
    
    // Get storm-specific data or fallback to Fani
    const selectedStorm = stormData[stormId] || stormData['storm-fani'];
    
    setAnalysisData({
      intensity: selectedStorm.intensity,
      summary: selectedStorm.summary,
      past_track: selectedStorm.past_track,
      forecast_track: selectedStorm.forecast_track,
      districts_risk: selectedStorm.districts_risk
    });
  };

  const handleCustomImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post(`${API_BASE_URL}/api/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (!res.data) throw new Error('No response from server');
      
      const enhancedData = res.data.data || res.data;
      const mlPredictions = enhancedData.intensity || {};

      const currentLat = enhancedData.current_position?.lat || 19.5;
      const currentLon = enhancedData.current_position?.lon || 85.5;

      const customAnalysisData = {
        intensity: {
          predicted_wind_kt: mlPredictions.wind_speed_kt || 100,
          predicted_wind_kmh: mlPredictions.wind_speed_kmh || 185,
          central_pressure_est_mb: mlPredictions.pressure_mb || 950,
          imd_classification: mlPredictions.classification || 'Category 4',
          threat_level: 'MODERATE',
          confidence: mlPredictions.confidence || 0.85
        },
        past_track: [[currentLat, currentLon]],
        forecast_track: (enhancedData.track_forecast || []).map(p => [p.lat, p.lon]),
        districts_risk: (enhancedData.risk_zones || []).map(zone => ({
          name: zone.district, 
          state: 'Odisha', 
          lat: zone.lat, 
          lon: zone.lon,
          zone: zone.zone, 
          risk_score: zone.risk_score, 
          distance_to_path_km: zone.distance_km,
          estimated_damage_usd_m: (enhancedData.damage_assessment?.total_damage_usd_m || 0) / Math.max((enhancedData.risk_zones || []).length, 1),
          action: zone.zone === 'Red' ? 'Evacuate immediately' : 'Prepare for impact'
        })),
        summary: {
          red_zone_count: enhancedData.risk_summary?.red_zones || 0,
          orange_zone_count: enhancedData.risk_summary?.orange_zones || 0,
          yellow_zone_count: enhancedData.risk_summary?.yellow_zones || 0,
          total_population_affected: enhancedData.risk_summary?.total_population_affected || 0,
          total_damage_usd_m: enhancedData.damage_assessment?.total_damage_usd_m || 0,
          total_damage_inr_crores: enhancedData.damage_assessment?.total_damage_inr_crores || 0
        }
      };

      setUploadedImage(URL.createObjectURL(file));
      setSelectedStormId('custom-upload');
      setAnalysisData(customAnalysisData);
      alert('✅ Image uploaded and analyzed successfully!');
    } catch (err) {
      console.error('Upload error:', err);
      alert('❌ Upload failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCapAlert = () => {
    // Generate CAP alerts from the current analysis data
    if (analysisData?.districts_risk && analysisData.districts_risk.length > 0) {
      setIsAlertModalOpen(true);
    } else {
      alert('⚠️ No risk data available. Please upload an image or select a storm first.');
    }
  };

  const intensity = analysisData?.intensity;
  const summary = analysisData?.summary;
  const track = analysisData?.past_track || [];
  const forecast = analysisData?.forecast_track || [];
  const districts = analysisData?.districts_risk || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-slate-100 flex flex-col overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      <header className="sticky top-0 z-40 bg-slate-950/70 backdrop-blur-xl border-b border-slate-700/30 px-6 py-4 shadow-2xl">
        <div className="max-w-[1920px] mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-purple-500 flex items-center justify-center shadow-2xl shadow-cyan-500/30 border border-cyan-400/20">
                <Activity className="w-7 h-7 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-black text-white">CycloneSense</h1>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-400/40">
                    AI Early Warning
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Real-time Deep Learning Predictions</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select value={selectedStormId} onChange={(e) => handleStormChange(e.target.value)}
                className="px-4 py-2 bg-slate-900/50 border border-slate-600/40 rounded-xl text-sm text-cyan-300 focus:outline-none cursor-pointer">
                {storms.map(s => <option key={s.id} value={s.id} className="bg-slate-900">{s.name} ({s.year})</option>)}
              </select>

              <label className="px-5 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/30 transition-all cursor-pointer flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Live Satellite
                <input type="checkbox" checked={isLivePrediction} onChange={(e) => setIsLivePrediction(e.target.checked)} className="hidden" />
              </label>

              <label className="px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-500/30 transition-all cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Image
                <input type="file" accept="image/*" onChange={handleCustomImageUpload} className="hidden" disabled={isLoading} />
              </label>

              <button onClick={handleOpenCapAlert}
                className="px-5 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/30 flex items-center gap-2 transition-all">
                <Bell className="w-4 h-4 animate-pulse" />
                CAP Alert
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-700/30">
            <span className="text-xs text-slate-300 font-semibold flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" /> Display:
            </span>
            <div className="flex flex-wrap gap-3">
              {[{show: showIntensity, set: setShowIntensity, label: '🌪️ Intensity'},
                {show: showPath, set: setShowPath, label: '🗺️ Forecast'},
                {show: showRiskZones, set: setShowRiskZones, label: '⚠️ Risk'},
                {show: showDamage, set: setShowDamage, label: '💰 Damage'},
                {show: showAlerts, set: setShowAlerts, label: '📢 Alerts'}].map((t, i) => (
                <label key={i} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={t.show} onChange={(e) => t.set(e.target.checked)} className="rounded accent-cyan-500" />
                  <span className={t.show ? 'text-cyan-300 font-medium' : 'text-slate-500'}>{t.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1920px] w-full mx-auto p-6 space-y-6 overflow-auto">
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard icon={<Wind className="w-5 h-5" />} title="Peak Wind" value={intensity?.predicted_wind_kt} unit="kt" color="cyan" />
          <MetricCard icon={<AlertOctagon className="w-5 h-5" />} title="Pressure" value={intensity?.central_pressure_est_mb} unit="mb" color="red" />
          <MetricCard icon={<ShieldCheck className="w-5 h-5" />} title="Red Zones" value={summary?.red_zone_count} unit="areas" color="red" />
          <MetricCard icon={<Compass className="w-5 h-5" />} title="Orange Zones" value={summary?.orange_zone_count} unit="areas" color="orange" />
          <MetricCard icon={<DollarSign className="w-5 h-5" />} title="Est. Damage" value={summary?.total_damage_usd_m?.toFixed(1)} unit="$M" color="purple" />
        </div>

        {/* Main grid: Map + Uploaded Image (Always visible) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2 h-[500px] bg-slate-900/80 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm hover:border-slate-600/70 transition-all">
            <WorkingMap pastTrack={track} forecastTrack={forecast} districts={districts} stormName={storms.find(s => s.id === selectedStormId)?.name || 'Cyclone'} />
          </div>
          
          {/* Uploaded Image - Always show viewer */}
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-4 shadow-2xl backdrop-blur-sm overflow-hidden h-[500px]">
            {uploadedImage ? (
              <div className="w-full h-full flex flex-col">
                <h3 className="text-sm font-bold text-cyan-300 mb-3">📡 Uploaded Satellite Image</h3>
                <div className="flex-1 flex items-center justify-center bg-slate-950 rounded-lg overflow-hidden border border-slate-700">
                  <img src={uploadedImage} alt="Uploaded cyclone" className="max-w-full max-h-full object-contain" />
                </div>
                <button onClick={() => setUploadedImage(null)} className="mt-2 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded text-slate-300 w-full transition-all">
                  Clear Image
                </button>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Eye className="w-12 h-12 text-slate-600" />
                <span className="text-sm font-semibold">No Image Uploaded</span>
                <span className="text-xs">Upload a satellite image to see it here</span>
              </div>
            )}
          </div>
        </div>

        {/* Risk zones table */}
        {districts.length > 0 && showRiskZones && (
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-cyan-400" />
              Risk Assessment - Affected Districts
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700/50">
                  <tr className="text-slate-300 font-semibold">
                    <th className="text-left py-3 px-4">District</th>
                    <th className="text-center py-3 px-4">Zone</th>
                    <th className="text-center py-3 px-4">Risk Score</th>
                    <th className="text-center py-3 px-4">Distance (km)</th>
                    <th className="text-right py-3 px-4">Est. Damage ($M)</th>
                  </tr>
                </thead>
                <tbody>
                  {districts.map((d, i) => (
                    <tr key={i} className={`border-b border-slate-700/30 hover:bg-slate-800/50 transition-colors ${d.zone === 'Red' ? 'bg-red-950/20' : d.zone === 'Orange' ? 'bg-orange-950/20' : 'bg-yellow-950/20'}`}>
                      <td className="py-3 px-4 font-semibold">{d.name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${d.zone === 'Red' ? 'bg-red-500/30 text-red-300' : d.zone === 'Orange' ? 'bg-orange-500/30 text-orange-300' : 'bg-yellow-500/30 text-yellow-300'}`}>
                          {d.zone}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-cyan-300">{d.risk_score}/10</td>
                      <td className="py-3 px-4 text-center">{(d.distance_to_path_km || 0).toFixed(1)}</td>
                      <td className="py-3 px-4 text-right font-mono text-orange-300">${(d.estimated_damage_usd_m || 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {isAlertModalOpen && <CapAlertModal isOpen={isAlertModalOpen} onClose={() => setIsAlertModalOpen(false)} capAlerts={districts} cycloneName={storms.find(s => s.id === selectedStormId)?.name || 'Cyclone'} />}
    </div>
  );
}

function MetricCard({icon, title, value, unit, color}) {
  const colorMap = {
    cyan: { bg: 'from-cyan-500/20 to-cyan-600/20', border: 'border-cyan-500/30', text: 'text-cyan-300' },
    red: { bg: 'from-red-500/20 to-red-600/20', border: 'border-red-500/30', text: 'text-red-300' },
    orange: { bg: 'from-orange-500/20 to-orange-600/20', border: 'border-orange-500/30', text: 'text-orange-300' },
    purple: { bg: 'from-purple-500/20 to-purple-600/20', border: 'border-purple-500/30', text: 'text-purple-300' }
  };
  const c = colorMap[color];
  
  return (
    <div className={`bg-gradient-to-br ${c.bg} ${c.border} border rounded-xl p-4 backdrop-blur-sm hover:border-opacity-100 transition-all shadow-lg`}>
      <div className={`w-10 h-10 rounded-lg bg-opacity-20 flex items-center justify-center ${c.text} mb-3`}>
        {icon}
      </div>
      <p className="text-slate-400 text-xs font-semibold mb-1">{title}</p>
      <p className="text-2xl font-black text-white">{value ?? '--'}</p>
      <p className="text-xs text-slate-400 mt-1">{unit}</p>
    </div>
  );
}
