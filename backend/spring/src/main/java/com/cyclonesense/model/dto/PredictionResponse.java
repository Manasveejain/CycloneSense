package com.cyclonesense.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PredictionResponse {
    private StormInfo storm;
    private IntensityData intensity;
    
    @JsonProperty("landfall_prediction")
    private LandfallPrediction landfallPrediction;
    
    @JsonProperty("past_track")
    private List<TrackPoint> pastTrack;
    
    @JsonProperty("forecast_track")
    private List<TrackPoint> forecastTrack;
    
    @JsonProperty("districts_risk")
    private List<DistrictRisk> districtsRisk;
    
    private SummaryData summary;
    
    @JsonProperty("spectral_previews")
    private Map<String, String> spectralPreviews;
    
    @JsonProperty("cap_alerts")
    private List<CapAlert> capAlerts;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StormInfo {
        private String id;
        private String name;
        private Integer year;
        private String basin;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IntensityData {
        @JsonProperty("predicted_wind_kt")
        private Double predictedWindKt;
        
        @JsonProperty("predicted_wind_kmh")
        private Double predictedWindKmh;
        
        @JsonProperty("central_pressure_est_mb")
        private Double centralPressureEstMb;
        
        @JsonProperty("imd_classification")
        private String imdClassification;
        
        @JsonProperty("threat_level")
        private String threatLevel;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LandfallPrediction {
        private Double lat;
        private Double lon;
        
        @JsonProperty("nearest_coastal_hub")
        private String nearestCoastalHub;
        
        @JsonProperty("estimated_time")
        private String estimatedTime;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrackPoint {
        private Double lat;
        private Double lon;
        private String timestamp;
        @JsonProperty("wind_kt")
        private Double windKt;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DistrictRisk {
        private String id;
        private String name;
        private String state;
        private Double lat;
        private Double lon;
        private String zone;
        
        @JsonProperty("risk_score")
        private Double riskScore;
        
        @JsonProperty("distance_to_path_km")
        private Double distanceToPathKm;
        
        @JsonProperty("estimated_damage_usd_m")
        private Double estimatedDamageUsdM;
        
        private String action;
        
        @JsonProperty("population_affected")
        private Long populationAffected;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SummaryData {
        @JsonProperty("red_zone_count")
        private Integer redZoneCount;
        
        @JsonProperty("orange_zone_count")
        private Integer orangeZoneCount;
        
        @JsonProperty("yellow_zone_count")
        private Integer yellowZoneCount;
        
        @JsonProperty("total_population_affected")
        private Long totalPopulationAffected;
        
        @JsonProperty("total_damage_usd_m")
        private Double totalDamageUsdM;
        
        @JsonProperty("total_damage_inr_crores")
        private Double totalDamageInrCrores;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CapAlert {
        private String district;
        private String severity;
        private String message;
        private String language;
    }
}
