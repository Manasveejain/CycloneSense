package com.cyclonesense.service;

import com.cyclonesense.model.dto.*;
import com.cyclonesense.model.dto.PredictionResponse.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class CycloneService {

    private final MLApiService mlApiService;

    // Mock data for demonstration - in production, this would integrate with FastAPI ML service
    
    public Map<String, Object> getAvailableStorms() {
        List<StormInfo> storms = Arrays.asList(
            StormInfo.builder()
                .id("storm-fani")
                .name("Cyclone Fani")
                .year(2019)
                .basin("Bay of Bengal")
                .build(),
            StormInfo.builder()
                .id("storm-amphan")
                .name("Cyclone Amphan")
                .year(2020)
                .basin("Bay of Bengal")
                .build(),
            StormInfo.builder()
                .id("storm-yaas")
                .name("Cyclone Yaas")
                .year(2021)
                .basin("Bay of Bengal")
                .build(),
            StormInfo.builder()
                .id("storm-biparjoy")
                .name("Cyclone Biparjoy")
                .year(2023)
                .basin("Arabian Sea")
                .build()
        );
        
        return Map.of("storms", storms);
    }

    public PredictionResponse runFullPrediction(PredictionRequest request) {
        log.info("Running full prediction pipeline for storm: {}", request.getStormId());
        
        // Get storm info
        StormInfo storm = getStormInfo(request.getStormId());
        
        // Module 1: Intensity Prediction (CNN/GBR)
        IntensityData intensity = predictIntensity(request);
        
        // Module 2: Track & Landfall Prediction (LSTM/GRU)
        LandfallPrediction landfall = predictLandfall(storm);
        List<TrackPoint> pastTrack = generatePastTrack(storm);
        List<TrackPoint> forecastTrack = generateForecastTrack(landfall);
        
        // Module 3: Risk Assessment (GIS/Fuzzy-AHP)
        List<DistrictRisk> districts = assessDistrictRisk(landfall, intensity);
        
        // Module 4: Damage Estimation (XGBoost)
        SummaryData summary = calculateSummary(districts, intensity);
        
        // Module 5: Alert Generation
        List<CapAlert> capAlerts = generateCapAlerts(districts, storm);
        
        // Spectral previews (satellite imagery)
        Map<String, String> spectralPreviews = getSpectralPreviews(storm);
        
        return PredictionResponse.builder()
            .storm(storm)
            .intensity(intensity)
            .landfallPrediction(landfall)
            .pastTrack(pastTrack)
            .forecastTrack(forecastTrack)
            .districtsRisk(districts)
            .summary(summary)
            .capAlerts(capAlerts)
            .spectralPreviews(spectralPreviews)
            .build();
    }

    private StormInfo getStormInfo(String stormId) {
        Map<String, StormInfo> stormMap = new HashMap<>();
        stormMap.put("storm-fani", StormInfo.builder()
            .id("storm-fani").name("Cyclone Fani").year(2019).basin("Bay of Bengal").build());
        stormMap.put("storm-amphan", StormInfo.builder()
            .id("storm-amphan").name("Cyclone Amphan").year(2020).basin("Bay of Bengal").build());
        stormMap.put("storm-yaas", StormInfo.builder()
            .id("storm-yaas").name("Cyclone Yaas").year(2021).basin("Bay of Bengal").build());
        stormMap.put("storm-biparjoy", StormInfo.builder()
            .id("storm-biparjoy").name("Cyclone Biparjoy").year(2023).basin("Arabian Sea").build());
        
        return stormMap.getOrDefault(stormId, stormMap.get("storm-fani"));
    }

    private IntensityData predictIntensity(PredictionRequest request) {
        Double windKt = request.getOverrideWindKt() != null ? request.getOverrideWindKt() : 125.0 + (Math.random() * 30);
        Double windKmh = windKt * 1.852;
        Double pressure = 950.0 - (windKt - 100) * 0.5;
        
        String classification;
        String threatLevel;
        
        if (windKt >= 120) {
            classification = "Extremely Severe Cyclonic Storm";
            threatLevel = "CRITICAL";
        } else if (windKt >= 90) {
            classification = "Very Severe Cyclonic Storm";
            threatLevel = "SEVERE";
        } else if (windKt >= 64) {
            classification = "Severe Cyclonic Storm";
            threatLevel = "HIGH";
        } else {
            classification = "Cyclonic Storm";
            threatLevel = "MODERATE";
        }
        
        return IntensityData.builder()
            .predictedWindKt(Math.round(windKt * 10.0) / 10.0)
            .predictedWindKmh(Math.round(windKmh * 10.0) / 10.0)
            .centralPressureEstMb(Math.round(pressure * 10.0) / 10.0)
            .imdClassification(classification)
            .threatLevel(threatLevel)
            .build();
    }

    private LandfallPrediction predictLandfall(StormInfo storm) {
        // Simulated landfall predictions for different storms
        Map<String, LandfallPrediction> landfalls = new HashMap<>();
        
        landfalls.put("storm-fani", LandfallPrediction.builder()
            .lat(19.8)
            .lon(85.8)
            .nearestCoastalHub("Puri, Odisha")
            .estimatedTime("36-48 hours")
            .build());
            
        landfalls.put("storm-amphan", LandfallPrediction.builder()
            .lat(21.6)
            .lon(88.2)
            .nearestCoastalHub("Sundarbans, West Bengal")
            .estimatedTime("24-36 hours")
            .build());
            
        landfalls.put("storm-yaas", LandfallPrediction.builder()
            .lat(21.3)
            .lon(87.3)
            .nearestCoastalHub("Balasore, Odisha")
            .estimatedTime("48-60 hours")
            .build());
        
        return landfalls.getOrDefault(storm.getId(), landfalls.get("storm-fani"));
    }

    private List<TrackPoint> generatePastTrack(StormInfo storm) {
        // Generate historical track points
        List<TrackPoint> track = new ArrayList<>();
        double baseLat = 15.0;
        double baseLon = 82.0;
        
        for (int i = 0; i < 10; i++) {
            track.add(TrackPoint.builder()
                .lat(baseLat + i * 0.5 + Math.random() * 0.2)
                .lon(baseLon + i * 0.3 + Math.random() * 0.2)
                .timestamp(LocalDateTime.now().minusHours(72 - i * 6).format(DateTimeFormatter.ISO_DATE_TIME))
                .windKt(80.0 + i * 4.0)
                .build());
        }
        
        return track;
    }

    private List<TrackPoint> generateForecastTrack(LandfallPrediction landfall) {
        // Generate forecast track points leading to landfall
        List<TrackPoint> track = new ArrayList<>();
        double currentLat = landfall.getLat() - 2.0;
        double currentLon = landfall.getLon() - 2.0;
        
        for (int i = 0; i < 8; i++) {
            double progress = i / 7.0;
            track.add(TrackPoint.builder()
                .lat(currentLat + (landfall.getLat() - currentLat) * progress)
                .lon(currentLon + (landfall.getLon() - currentLon) * progress)
                .timestamp(LocalDateTime.now().plusHours(i * 6).format(DateTimeFormatter.ISO_DATE_TIME))
                .windKt(120.0 + Math.random() * 15.0)
                .build());
        }
        
        return track;
    }

    private List<DistrictRisk> assessDistrictRisk(LandfallPrediction landfall, IntensityData intensity) {
        // Simulate district risk assessment with actual coastal district coordinates
        String[] districts = {"Puri", "Khordha", "Ganjam", "Jagatsinghpur", "Kendrapara", 
                             "Balasore", "Bhadrak", "Jajpur", "Cuttack", "Nayagarh", 
                             "Gajapati", "Rayagada"};
        String[] states = {"Odisha", "Odisha", "Odisha", "Odisha", "Odisha",
                          "Odisha", "Odisha", "Odisha", "Odisha", "Odisha",
                          "Odisha", "Odisha"};
        // Approximate district center coordinates (lat, lon)
        double[][] coords = {
            {19.8, 85.85},  // Puri
            {20.18, 85.62}, // Khordha
            {19.39, 84.88}, // Ganjam
            {20.26, 86.17}, // Jagatsinghpur
            {20.50, 86.42}, // Kendrapara
            {21.49, 86.93}, // Balasore
            {21.05, 86.50}, // Bhadrak
            {20.85, 86.20}, // Jajpur
            {20.47, 85.88}, // Cuttack
            {20.13, 85.10}, // Nayagarh
            {18.85, 83.90}, // Gajapati
            {19.17, 83.42}  // Rayagada
        };
        
        List<DistrictRisk> risks = new ArrayList<>();
        Random random = new Random();
        
        for (int i = 0; i < districts.length; i++) {
            double distanceToPath = 10.0 + i * 15.0 + random.nextDouble() * 20.0;
            double riskScore = Math.max(0, 10.0 - distanceToPath / 30.0);
            
            String zone;
            String action;
            if (riskScore > 7.5) {
                zone = "Red";
                action = "Immediate evacuation required. Move to cyclone shelters.";
            } else if (riskScore > 5.0) {
                zone = "Orange";
                action = "High alert. Prepare for evacuation. Stock emergency supplies.";
            } else {
                zone = "Yellow";
                action = "Stay alert. Monitor updates. Avoid coastal areas.";
            }
            
            double damageUsd = riskScore * 15.0 * (intensity.getPredictedWindKt() / 100.0);
            long population = (long) (50000 + random.nextInt(200000));
            
            risks.add(DistrictRisk.builder()
                .id("district-" + i)
                .name(districts[i])
                .state(states[i])
                .lat(coords[i][0])
                .lon(coords[i][1])
                .zone(zone)
                .riskScore(Math.round(riskScore * 10.0) / 10.0)
                .distanceToPathKm(Math.round(distanceToPath * 10.0) / 10.0)
                .estimatedDamageUsdM(Math.round(damageUsd * 10.0) / 10.0)
                .action(action)
                .populationAffected(population)
                .build());
        }
        
        // Sort by risk score descending
        risks.sort((a, b) -> Double.compare(b.getRiskScore(), a.getRiskScore()));
        
        return risks;
    }

    private SummaryData calculateSummary(List<DistrictRisk> districts, IntensityData intensity) {
        long redZones = districts.stream().filter(d -> "Red".equals(d.getZone())).count();
        long orangeZones = districts.stream().filter(d -> "Orange".equals(d.getZone())).count();
        long yellowZones = districts.stream().filter(d -> "Yellow".equals(d.getZone())).count();
        
        long totalPopulation = districts.stream()
            .mapToLong(DistrictRisk::getPopulationAffected)
            .sum();
        
        double totalDamageUsd = districts.stream()
            .mapToDouble(DistrictRisk::getEstimatedDamageUsdM)
            .sum();
        
        double totalDamageInr = totalDamageUsd * 83.0 * 10.0; // USD to INR crores
        
        return SummaryData.builder()
            .redZoneCount((int) redZones)
            .orangeZoneCount((int) orangeZones)
            .yellowZoneCount((int) yellowZones)
            .totalPopulationAffected(totalPopulation)
            .totalDamageUsdM(Math.round(totalDamageUsd * 10.0) / 10.0)
            .totalDamageInrCrores(Math.round(totalDamageInr * 10.0) / 10.0)
            .build();
    }

    private List<CapAlert> generateCapAlerts(List<DistrictRisk> districts, StormInfo storm) {
        List<CapAlert> alerts = new ArrayList<>();
        String[] languages = {"English", "Hindi", "Odia"};
        
        districts.stream()
            .filter(d -> "Red".equals(d.getZone()) || "Orange".equals(d.getZone()))
            .limit(5)
            .forEach(d -> {
                for (String lang : languages) {
                    String message = generateAlertMessage(d, storm, lang);
                    alerts.add(CapAlert.builder()
                        .district(d.getName())
                        .severity(d.getZone())
                        .message(message)
                        .language(lang)
                        .build());
                }
            });
        
        return alerts;
    }

    private String generateAlertMessage(DistrictRisk district, StormInfo storm, String language) {
        if ("Hindi".equals(language)) {
            return String.format("चक्रवात %s खतरा - %s जिला %s क्षेत्र में है। कृपया सुरक्षित स्थान पर जाएं।", 
                storm.getName(), district.getName(), district.getZone());
        } else if ("Odia".equals(language)) {
            return String.format("ଚକ୍ରବାତ %s ବିପଦ - %s ଜିଲ୍ଲା %s ଅଞ୍ଚଳରେ ଅଛି। ଦୟାକରି ସୁରକ୍ଷିତ ସ୍ଥାନକୁ ଯାଆନ୍ତୁ।",
                storm.getName(), district.getName(), district.getZone());
        } else {
            return String.format("Cyclone %s Alert - %s district is in %s zone. %s", 
                storm.getName(), district.getName(), district.getZone(), district.getAction());
        }
    }

    private Map<String, String> getSpectralPreviews(StormInfo storm) {
        // Use imgplaceholder.com which is more reliable
        return Map.of(
            "infrared", "https://placehold.co/400x400/000000/FFFFFF/png?text=IR+Image",
            "visible", "https://placehold.co/400x400/87CEEB/FFFFFF/png?text=Visible",
            "waterVapor", "https://placehold.co/400x400/4169E1/FFFFFF/png?text=Water+Vapor"
        );
    }

    public Map<String, Object> processSatelliteImage(MultipartFile file) {
        log.info("Processing satellite image: {} - forwarding to FastAPI ML service (ENHANCED)", file.getOriginalFilename());
        
        try {
            // Forward image to FastAPI ML service for comprehensive prediction using all models
            Map<String, Object> mlResponse = mlApiService.predictFromImageEnhanced(file);
            
            if (mlResponse != null && (Boolean) mlResponse.getOrDefault("success", false)) {
                return mlResponse;  // Return full enhanced response
            } else {
                log.error("FastAPI ML service returned unsuccessful response");
                throw new RuntimeException("ML prediction failed");
            }
        } catch (Exception e) {
            log.error("Error processing satellite image via ML service: {}", e.getMessage());
            return Map.of(
                "success", false,
                "error", "Failed to process image: " + e.getMessage(),
                "filename", file.getOriginalFilename()
            );
        }
    }

    public Map<String, Object> dispatchAlerts(AlertDispatchRequest request) {
        log.info("Dispatching alerts for cyclone: {} to {} channels", 
            request.getCycloneName(), request.getBroadcastChannels().size());
        
        int alertsSent = request.getDistricts().size() * request.getBroadcastChannels().size();
        
        return Map.of(
            "success", true,
            "alerts_sent", alertsSent,
            "channels", request.getBroadcastChannels(),
            "timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_DATE_TIME),
            "message", "Alerts dispatched successfully"
        );
    }
}
