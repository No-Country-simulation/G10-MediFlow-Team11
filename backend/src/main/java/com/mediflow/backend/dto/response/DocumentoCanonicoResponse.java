package com.mediflow.backend.dto.response;

import com.mediflow.backend.enums.DocumentStatus;
import lombok.Getter;
import lombok.Setter;
import java.util.Map;

@Getter
@Setter
public class DocumentoCanonicoResponse {
    private String documentId;
    private DocumentStatus status;
    private Classification classification; //nullable
    private Confidence confidence; // nullable
    private Map<String, Object> extractedData; // nullable
    private Validation validation; // nullable
    private RoutingDecisionResponse routingDecision; // nunca null
    private NotificationResponse notification; // nunca null
    private StorageResponse storage; // nunca null
}
