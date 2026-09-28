package com.cyclonesense.controller;

import com.cyclonesense.model.dto.*;
import com.cyclonesense.service.CycloneService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CycloneController {

    private final CycloneService cycloneService;

    @GetMapping("/storms")
    public ResponseEntity<Map<String, Object>> getStorms() {
        log.info("GET /api/storms - Fetching available storms");
        return ResponseEntity.ok(cycloneService.getAvailableStorms());
    }

    @PostMapping("/predict/all")
    public ResponseEntity<PredictionResponse> predictAll(@RequestBody PredictionRequest request) {
        log.info("POST /api/predict/all - Running end-to-end prediction for storm: {}", request.getStormId());
        PredictionResponse response = cycloneService.runFullPrediction(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/upload-image")
    public ResponseEntity<Map<String, Object>> uploadImage(@RequestParam("file") MultipartFile file) {
        log.info("POST /api/upload-image - Uploading satellite image: {}", file.getOriginalFilename());
        Map<String, Object> response = cycloneService.processSatelliteImage(file);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/alerts/dispatch")
    public ResponseEntity<Map<String, Object>> dispatchAlerts(@RequestBody AlertDispatchRequest request) {
        log.info("POST /api/alerts/dispatch - Dispatching alerts for cyclone: {}", request.getCycloneName());
        Map<String, Object> response = cycloneService.dispatchAlerts(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "ok",
            "service", "CycloneSense Spring Boot Backend",
            "timestamp", String.valueOf(System.currentTimeMillis())
        ));
    }
}
