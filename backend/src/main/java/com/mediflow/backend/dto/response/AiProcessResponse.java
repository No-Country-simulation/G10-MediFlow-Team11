package com.mediflow.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.mediflow.backend.dto.shared.Classification;
import com.mediflow.backend.dto.shared.Confidence;
import com.mediflow.backend.dto.shared.ExtractedData;
import com.mediflow.backend.dto.shared.Validation;
import lombok.Getter;
import lombok.Setter;

/**
 * Respuesta exitosa de IA Core (arquitectura §5).
 * No incluye status, requires_human_review ni datos de OCI.
 */
@Getter
@Setter
public class AiProcessResponse {

    @JsonProperty("document_id")
    private String documentId;
    @JsonProperty("classification")
    private Classification classification;
    @JsonProperty("confidence")
    private Confidence confidence;
    @JsonProperty("extracted_data")
    private ExtractedData extractedData;
    @JsonProperty("validation")
    private Validation validation;
    @JsonProperty("routing_decision")
    private RoutingDecisionAi routingDecision;
}
