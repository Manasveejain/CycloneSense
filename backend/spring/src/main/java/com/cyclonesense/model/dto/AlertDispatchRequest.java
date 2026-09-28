package com.cyclonesense.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class AlertDispatchRequest {
    private List<Object> districts;
    
    @JsonProperty("cyclone_name")
    private String cycloneName;
    
    @JsonProperty("broadcast_channels")
    private List<String> broadcastChannels;
}
