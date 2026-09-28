package com.cyclonesense.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MLApiService {

    private final WebClient.Builder webClientBuilder;
    
    @Value("${ml.api.base-url:http://localhost:8001}")
    private String mlApiBaseUrl;

    /**
     * Call FastAPI ML service for predictions
     */
    public Map<String, Object> predict(String modelName, Object features) {
        try {
            WebClient webClient = webClientBuilder.baseUrl(mlApiBaseUrl).build();
            
            Map<String, Object> request = new HashMap<>();
            request.put("model", modelName);
            request.put("features", features);
            
            Map<String, Object> response = webClient.post()
                .uri("/api/v1/predict")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
            
            log.info("ML API prediction successful for model: {}", modelName);
            return response != null ? response : Map.of("error", "No response from ML API");
            
        } catch (Exception e) {
            log.warn("ML API call failed: {}. Using fallback.", e.getMessage());
            return getFallbackPrediction(modelName);
        }
    }

    /**
     * Call FastAPI ML service to predict from uploaded satellite image (Enhanced - All Models)
     */
    public Map<String, Object> predictFromImageEnhanced(MultipartFile file) {
        try {
            WebClient webClient = webClientBuilder.baseUrl(mlApiBaseUrl).build();
            
            MultipartBodyBuilder builder = new MultipartBodyBuilder();
            builder.part("file", file.getResource());
            
            Map<String, Object> response = webClient.post()
                .uri("/api/v1/predict-from-image-enhanced")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(builder.build()))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
            
            log.info("ML API enhanced prediction successful for file: {}", file.getOriginalFilename());
            return response != null ? response : Map.of("success", false, "error", "No response from ML API");
            
        } catch (Exception e) {
            log.error("ML API enhanced prediction failed: {}", e.getMessage(), e);
            return Map.of(
                "success", false, 
                "error", "Failed to call ML API: " + e.getMessage()
            );
        }
    }
    
    /**
     * Call FastAPI ML service to predict from uploaded satellite image
     */
    public Map<String, Object> predictFromImage(MultipartFile file) {
        try {
            WebClient webClient = webClientBuilder.baseUrl(mlApiBaseUrl).build();
            
            MultipartBodyBuilder builder = new MultipartBodyBuilder();
            builder.part("file", file.getResource());
            
            Map<String, Object> response = webClient.post()
                .uri("/api/v1/predict-from-image")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(builder.build()))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
            
            log.info("ML API image prediction successful for file: {}", file.getOriginalFilename());
            return response != null ? response : Map.of("success", false, "error", "No response from ML API");
            
        } catch (Exception e) {
            log.error("ML API image prediction failed: {}", e.getMessage(), e);
            return Map.of(
                "success", false, 
                "error", "Failed to call ML API: " + e.getMessage()
            );
        }
    }

    /**
     * Check if ML API is available
     */
    public boolean isMLApiAvailable() {
        try {
            WebClient webClient = webClientBuilder.baseUrl(mlApiBaseUrl).build();
            Map<String, Object> health = webClient.get()
                .uri("/health")
                .retrieve()
                .bodyToMono(Map.class)
                .block();
            
            return health != null && "ok".equals(health.get("status"));
        } catch (Exception e) {
            log.debug("ML API not available: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Fallback predictions when ML API is unavailable
     */
    private Map<String, Object> getFallbackPrediction(String modelName) {
        log.info("Using fallback prediction for model: {}", modelName);
        
        return Map.of(
            "model", modelName,
            "prediction", generateMockPrediction(modelName),
            "probabilities", null,
            "fallback", true,
            "message", "ML API unavailable - using mock data"
        );
    }

    private Object generateMockPrediction(String modelName) {
        // Generate realistic mock predictions based on model type
        switch (modelName) {
            case "module1_state":
                return Map.of(
                    "track_lat", 19.8,
                    "track_lon", 85.8,
                    "wind_kt", 125.0,
                    "pressure_mb", 945.0
                );
            case "module2_state":
                return Map.of(
                    "intensity_kt", 130.0,
                    "confidence", 0.87
                );
            case "module3_state":
                return Map.of(
                    "risk_score", 8.5,
                    "affected_districts", 12
                );
            case "module4_state":
                return Map.of(
                    "damage_usd_m", 450.0,
                    "uncertainty", "P10-P90"
                );
            case "module5_alerts":
                return Map.of(
                    "alerts_generated", 25,
                    "languages", 7
                );
            default:
                return Map.of("value", 0.5);
        }
    }
}
