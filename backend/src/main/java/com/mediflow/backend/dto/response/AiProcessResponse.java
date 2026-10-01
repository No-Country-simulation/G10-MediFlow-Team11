package com.mediflow.backend.dto.response;

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

    private String documentId;
    private Classification classification;
    private Confidence confidence;
    private ExtractedData extractedData;
    private Validation validation;
    private RoutingDecisionAi routingDecision;
}
