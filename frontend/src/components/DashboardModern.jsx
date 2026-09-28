import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Wind, Compass, AlertOctagon, DollarSign, Bell,
  Layers, ShieldCheck, Sliders, Activity,
  WifiOff, Map, Navigation
} from 'lucide-react';
import WorkingMap from './WorkingMap';
import GISMap from './GISMap';
import EvacuationModule from './EvacuationModule';
import CapAlertModal from './CapAlertModal';
import IntensityChart, { STORM_TIMELINES } from './IntensityChart';
import { usePWA, saveOfflineSnapshot, loadOfflineSnapshot } from '../hooks/usePWA';

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
  const [activeMapTab, setActiveMapTab] = useState('gis'); // 'gis' | 'simple' | 'evacuation'

  // PWA offline/update state
  const { isOnline, offlineDataAge } = usePWA();
  
  const [showIntensity, setShowIntensity] = useState(true);
  const [showPath, setShowPath] = useState(true);
  const [showRiskZones, setShowRiskZones] = useState(true);
  const [showDamage, setShowDamage] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);

  useEffect(() => {
    loadStorms();
    // Restore cached data if offline
    if (!navigator.onLine) {
      loadOfflineSnapshot('analysisData').then(cached => {
        if (cached) { setAnalysisData(cached); }
      });
    }
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
        { id: 'storm-fani',      name: 'Cyclone Fani',      year: 2019, basin: 'Bay of Bengal' },
        { id: 'storm-amphan',    name: 'Cyclone Amphan',    year: 2020, basin: 'Bay of Bengal' },
        { id: 'storm-yaas',      name: 'Cyclone Yaas',      year: 2021, basin: 'Bay of Bengal' },
        { id: 'storm-biparjoy',  name: 'Cyclone Biparjoy',  year: 2023, basin: 'Arabian Sea'   },
        { id: 'storm-tauktae',   name: 'Cyclone Tauktae',   year: 2021, basin: 'Arabian Sea'   },
        { id: 'storm-michaung',  name: 'Cyclone Michaung',  year: 2023, basin: 'Bay of Bengal' },
        { id: 'storm-gati',      name: 'Cyclone Gati',      year: 2020, basin: 'Arabian Sea'   },
        { id: 'storm-nisarga',   name: 'Cyclone Nisarga',   year: 2020, basin: 'Arabian Sea'   },
      ]);
    }
  };

  const handleStormChange = (stormId) => {
    setSelectedStormId(stormId);
    
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
      'storm-tauktae': {
        intensity: {
          predicted_wind_kt: 145,
          predicted_wind_kmh: 269,
          central_pressure_est_mb: 916,
          imd_classification: 'Extremely Severe Cyclonic Storm',
          threat_level: 'EXTREME',
          confidence: 0.93
        },
        past_track: [[14.5, 72.0], [15.2, 72.4], [16.0, 72.7], [17.1, 72.5]],
        forecast_track: [[18.2, 72.3], [19.5, 72.0], [20.8, 71.8], [22.0, 71.5]],
        districts_risk: [
          { name: 'Raigad',       state: 'Maharashtra', lat: 18.52, lon: 73.17, zone: 'Red',    risk_score: 10, distance_to_path_km: 4,  estimated_damage_usd_m: 580, population_affected: 2634200, action: 'Evacuate immediately' },
          { name: 'Ratnagiri',    state: 'Maharashtra', lat: 17.00, lon: 73.30, zone: 'Red',    risk_score: 9,  distance_to_path_km: 10, estimated_damage_usd_m: 490, population_affected: 1612672, action: 'Evacuate immediately' },
          { name: 'Palghar',      state: 'Maharashtra', lat: 19.70, lon: 72.77, zone: 'Orange', risk_score: 8,  distance_to_path_km: 20, estimated_damage_usd_m: 380, population_affected: 2990116, action: 'Prepare for evacuation' },
          { name: 'Thane',        state: 'Maharashtra', lat: 19.21, lon: 72.97, zone: 'Orange', risk_score: 7,  distance_to_path_km: 28, estimated_damage_usd_m: 320, population_affected: 11060148, action: 'Stay alert' },
          { name: 'Mumbai',       state: 'Maharashtra', lat: 19.07, lon: 72.87, zone: 'Yellow', risk_score: 6,  distance_to_path_km: 42, estimated_damage_usd_m: 260, population_affected: 12478447, action: 'Monitor updates' },
        ],
        summary: { red_zone_count: 2, orange_zone_count: 2, yellow_zone_count: 1, total_population_affected: 30775583, total_damage_usd_m: 2030, total_damage_inr_crores: 169 }
      },
      'storm-michaung': {
        intensity: {
          predicted_wind_kt: 80,
          predicted_wind_kmh: 148,
          central_pressure_est_mb: 975,
          imd_classification: 'Severe Cyclonic Storm',
          threat_level: 'HIGH',
          confidence: 0.88
        },
        past_track: [[12.5, 83.5], [12.9, 83.8], [13.3, 84.0]],
        forecast_track: [[13.8, 80.2], [14.2, 80.0], [14.7, 79.8], [15.1, 79.5]],
        districts_risk: [
          { name: 'Chennai',       state: 'Tamil Nadu',  lat: 13.08, lon: 80.27, zone: 'Red',    risk_score: 9, distance_to_path_km: 5,  estimated_damage_usd_m: 420, population_affected: 7088000, action: 'Evacuate immediately' },
          { name: 'Nellore',       state: 'Andhra Pradesh', lat: 14.44, lon: 79.99, zone: 'Red', risk_score: 8, distance_to_path_km: 12, estimated_damage_usd_m: 350, population_affected: 2966082, action: 'Evacuate immediately' },
          { name: 'Chittoor',      state: 'Andhra Pradesh', lat: 13.21, lon: 79.10, zone: 'Orange', risk_score: 6, distance_to_path_km: 30, estimated_damage_usd_m: 210, population_affected: 4170468, action: 'Prepare for evacuation' },
          { name: 'Kanchipuram',   state: 'Tamil Nadu',  lat: 12.83, lon: 79.70, zone: 'Yellow', risk_score: 5, distance_to_path_km: 48, estimated_damage_usd_m: 160, population_affected: 3998252, action: 'Monitor updates' },
        ],
        summary: { red_zone_count: 2, orange_zone_count: 1, yellow_zone_count: 1, total_population_affected: 18222802, total_damage_usd_m: 1140, total_damage_inr_crores: 95 }
      },
      'storm-gati': {
        intensity: {
          predicted_wind_kt: 165,
          predicted_wind_kmh: 306,
          central_pressure_est_mb: 899,
          imd_classification: 'Super Cyclonic Storm',
          threat_level: 'CATASTROPHIC',
          confidence: 0.90
        },
        past_track: [[10.5, 51.0], [11.2, 52.5], [11.8, 53.8], [12.3, 55.2]],
        forecast_track: [[12.8, 56.5], [13.0, 57.8], [13.2, 59.0], [13.1, 60.3]],
        districts_risk: [
          { name: 'Qishn',         state: 'Al Mahrah, Yemen', lat: 15.42, lon: 51.67, zone: 'Red',    risk_score: 10, distance_to_path_km: 3,  estimated_damage_usd_m: 680, population_affected: 120000,  action: 'Evacuate immediately' },
          { name: 'Hadbeen',       state: 'Socotra, Yemen',   lat: 12.65, lon: 54.00, zone: 'Red',    risk_score: 9,  distance_to_path_km: 8,  estimated_damage_usd_m: 540, population_affected: 60000,   action: 'Evacuate immediately' },
          { name: 'Nishtun',       state: 'Al Mahrah, Yemen', lat: 15.81, lon: 52.20, zone: 'Orange', risk_score: 7,  distance_to_path_km: 25, estimated_damage_usd_m: 310, population_affected: 45000,   action: 'Prepare for evacuation' },
        ],
        summary: { red_zone_count: 2, orange_zone_count: 1, yellow_zone_count: 0, total_population_affected: 225000, total_damage_usd_m: 1530, total_damage_inr_crores: 127 }
      },
      'storm-nisarga': {
        intensity: {
          predicted_wind_kt: 85,
          predicted_wind_kmh: 157,
          central_pressure_est_mb: 970,
          imd_classification: 'Severe Cyclonic Storm',
          threat_level: 'HIGH',
          confidence: 0.86
        },
        past_track: [[15.0, 72.0], [15.5, 72.3], [16.0, 72.7]],
        forecast_track: [[16.8, 73.1], [17.5, 73.4], [18.3, 73.6], [19.0, 73.8]],
        districts_risk: [
          { name: 'Alibag',      state: 'Maharashtra', lat: 18.64, lon: 72.87, zone: 'Red',    risk_score: 9, distance_to_path_km: 3,  estimated_damage_usd_m: 360, population_affected: 962769,  action: 'Evacuate immediately' },
          { name: 'Raigad',      state: 'Maharashtra', lat: 18.52, lon: 73.17, zone: 'Red',    risk_score: 8, distance_to_path_km: 8,  estimated_damage_usd_m: 310, population_affected: 2634200, action: 'Evacuate immediately' },
          { name: 'Ratnagiri',   state: 'Maharashtra', lat: 17.00, lon: 73.30, zone: 'Orange', risk_score: 6, distance_to_path_km: 22, estimated_damage_usd_m: 200, population_affected: 1612672, action: 'Prepare for evacuation' },
          { name: 'Sindhudurg',  state: 'Maharashtra', lat: 16.35, lon: 73.57, zone: 'Yellow', risk_score: 4, distance_to_path_km: 40, estimated_damage_usd_m: 120, population_affected: 848868,  action: 'Monitor updates' },
        ],
        summary: { red_zone_count: 2, orange_zone_count: 1, yellow_zone_count: 1, total_population_affected: 6058509, total_damage_usd_m: 990, total_damage_inr_crores: 82 }
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
    
    const newData = {
      intensity: selectedStorm.intensity,
      summary: selectedStorm.summary,
      past_track: selectedStorm.past_track,
      forecast_track: selectedStorm.forecast_track,
      districts_risk: selectedStorm.districts_risk
    };
    setAnalysisData(newData);
    // Persist to IndexedDB for offline use
    saveOfflineSnapshot('analysisData', newData);
  };

  const handleOpenCapAlert = () => {
    // Generate CAP alerts from the current analysis data
    if (analysisData?.districts_risk && analysisData.districts_risk.length > 0) {
      setIsAlertModalOpen(true);
    } else {
      alert('No risk data available. Please select a storm first.');
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
              {[{show: showIntensity, set: setShowIntensity, label: 'Intensity'},
                {show: showPath, set: setShowPath, label: 'Forecast'},
                {show: showRiskZones, set: setShowRiskZones, label: 'Risk'},
                {show: showDamage, set: setShowDamage, label: 'Damage'},
                {show: showAlerts, set: setShowAlerts, label: 'Alerts'}].map((t, i) => (
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
        {/* -- Offline / update banners -- */}
        {!isOnline && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 text-sm">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span className="font-semibold">Offline mode</span>
            <span className="text-amber-400/80">
              {' - '}showing cached data{offlineDataAge != null ? ` (saved ${offlineDataAge} min ago)` : ''}. Maps and risk assessments available.
            </span>
          </div>
        )}
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard icon={<Wind className="w-5 h-5" />} title="Peak Wind" value={intensity?.predicted_wind_kt} unit="kt" color="cyan" />
          <MetricCard icon={<AlertOctagon className="w-5 h-5" />} title="Pressure" value={intensity?.central_pressure_est_mb} unit="mb" color="red" />
          <MetricCard icon={<ShieldCheck className="w-5 h-5" />} title="Red Zones" value={summary?.red_zone_count} unit="areas" color="red" />
          <MetricCard icon={<Compass className="w-5 h-5" />} title="Orange Zones" value={summary?.orange_zone_count} unit="areas" color="orange" />
          <MetricCard icon={<DollarSign className="w-5 h-5" />} title="Est. Damage" value={summary?.total_damage_usd_m?.toFixed(1)} unit="$M" color="purple" />
        </div>

        {/* -- Map tab switcher -- */}
        <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-700/40 rounded-xl p-1 w-fit">
          {[
            { id: 'gis',        icon: <Map className="w-3.5 h-3.5"/>,        label: 'GIS Layers'    },
            { id: 'simple',     icon: <Layers className="w-3.5 h-3.5"/>,     label: 'Simple Map'    },
            { id: 'evacuation', icon: <Navigation className="w-3.5 h-3.5"/>, label: 'Evacuation'    },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveMapTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${activeMapTab === t.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Main grid: map (left 2/3) + intensity chart (right 1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Map panel - 2/3 width */}
          <div className="lg:col-span-2 h-[580px] bg-slate-900/80 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
            {activeMapTab === 'gis' && (
              <GISMap
                pastTrack={track}
                forecastTrack={forecast}
                districts={districts}
                stormName={storms.find(s => s.id === selectedStormId)?.name || 'Cyclone'}
                windKt={intensity?.predicted_wind_kt}
              />
            )}
            {activeMapTab === 'simple' && (
              <WorkingMap
                pastTrack={track}
                forecastTrack={forecast}
                districts={districts}
                stormName={storms.find(s => s.id === selectedStormId)?.name || 'Cyclone'}
                windKt={intensity?.predicted_wind_kt}
              />
            )}
            {activeMapTab === 'evacuation' && (
              <div className="w-full h-full overflow-auto">
                <EvacuationModule
                  districts={districts}
                  stormName={storms.find(s => s.id === selectedStormId)?.name || 'Cyclone'}
                />
              </div>
            )}
          </div>

          {/* Intensity chart - right 1/3, same height as map */}
          <div className="h-[580px]">
            <IntensityChart
              selectedStormId={selectedStormId}
              onStormSelect={handleStormChange}
            />
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
