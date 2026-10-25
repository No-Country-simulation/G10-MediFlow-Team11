package com.mediflow.backend.dto.response;

import com.mediflow.backend.dto.shared.Classification;
import com.mediflow.backend.dto.shared.Confidence;
import com.mediflow.backend.dto.shared.ExtractedData;
import com.mediflow.backend.dto.shared.Validation;
import com.mediflow.backend.enums.DocumentStatus;
import lombok.Getter;
import lombok.Setter;

/**
 * Respuesta canónica Backend → Frontend (arquitectura §6).
 * classification, confidence, extracted_data y validation son nullable si IA no produjo un resultado válido.
 * status, routing_decision, notification y storage los arma exclusivamente el Backend.
 */
@Getter
@Setter
public class DocumentoCanonicoResponse {

    private String documentId;
    private DocumentStatus status;
    private Classification classification;
    private Confidence confidence;
    private ExtractedData extractedData;
    private Validation validation;
    private RoutingDecisionResponse routingDecision;
    private NotificationResponse notification;
    private StorageResponse storage;
}
