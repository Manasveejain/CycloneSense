package com.cyclonesense.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class PredictionRequest {
    @JsonProperty("storm_id")
    private String stormId;
    
    @JsonProperty("override_wind_kt")
    private Double overrideWindKt;
}
