package com.mediflow.backend.dto.response;

import lombok.Getter;
import lombok.Setter;
import java.util.Map;

@Getter
@Setter
public class AiProcessResponse {
    private String documentId;
    private Classification classification;
    private Confidence confidence;
    private Map<String, Object> extractedData; // estructura flexible,arquitectura§5
    private Validation validation;
    private RoutingDecisionAi routingDecision;
}
