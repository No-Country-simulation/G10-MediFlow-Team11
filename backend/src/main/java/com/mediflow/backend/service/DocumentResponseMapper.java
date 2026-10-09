package com.mediflow.backend.service;

import com.mediflow.backend.dto.response.DocumentoCanonicoResponse;
import com.mediflow.backend.dto.response.AuditDocumentResponse;
import com.mediflow.backend.dto.response.DocumentHistoryResponse;
import com.mediflow.backend.dto.response.NotificationResponse;
import com.mediflow.backend.dto.response.RoutingDecisionResponse;
import com.mediflow.backend.dto.response.StorageResponse;
import com.mediflow.backend.dto.shared.Classification;
import com.mediflow.backend.dto.shared.Confidence;
import com.mediflow.backend.dto.shared.ExtractedData;
import com.mediflow.backend.dto.shared.Validation;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.entity.DocumentTriageHistory;
import com.mediflow.backend.enums.DocumentStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

@Component
public class DocumentResponseMapper {

    private final JsonMapper jsonMapper;

    public DocumentResponseMapper(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    public AuditDocumentResponse toAuditResponse(DocumentRecord document) {
        return new AuditDocumentResponse(
                document.getId(),
                document.getStatus(),
                document.getInputType(),
                document.getMimeType(),
                document.getFileName(),
                document.getDocumentType(),
                document.getAuditReasons(),
                document.getCreatedAt(),
                document.getUpdatedAt()
        );
    }

    public DocumentHistoryResponse.Entry toHistoryEntry(DocumentTriageHistory history) {
        return new DocumentHistoryResponse.Entry(
                history.getId().getSequence(),
                history.getEventType(),
                history.getDecision(),
                history.getOccurredAt(),
                history.getResult()
        );
    }

    public DocumentoCanonicoResponse toResponse(DocumentRecord document) {
        DocumentoCanonicoResponse response = new DocumentoCanonicoResponse();
        response.setDocumentId(document.getId());
        response.setStatus(document.getStatus());

        if (document.getDocumentType() != null || document.getSpecialty() != null || document.getPriority() != null) {
            Classification classification = new Classification();
            classification.setDocumentType(document.getDocumentType());
            classification.setSpecialty(document.getSpecialty());
            classification.setPriorityLevel(document.getPriority());
            response.setClassification(classification);
        }

        if (document.getConfidenceClassification() != null
                && document.getConfidenceExtraction() != null
                && document.getConfidenceGlobal() != null) {
            Confidence confidence = new Confidence();
            confidence.setClassification(document.getConfidenceClassification());
            confidence.setExtraction(document.getConfidenceExtraction());
            confidence.setGlobal(document.getConfidenceGlobal());
            response.setConfidence(confidence);
        }

        if (document.getExtractedData() != null) {
            response.setExtractedData(jsonMapper.convertValue(document.getExtractedData(), ExtractedData.class));
        }
        if (document.getValidation() != null) {
            response.setValidation(jsonMapper.convertValue(document.getValidation(), Validation.class));
        }

        RoutingDecisionResponse routing = new RoutingDecisionResponse();
        routing.setPrimaryDestination(document.getRoutingDestination());
        routing.setRequiresHumanReview(document.getStatus() == DocumentStatus.NEEDS_AUDIT);
        routing.setAuditReasons(document.getAuditReasons());
        routing.setJustification(document.getRoutingJustification());
        response.setRoutingDecision(routing);

        response.setNotification(jsonMapper.convertValue(document.getNotification(), NotificationResponse.class));

        StorageResponse storage = new StorageResponse();
        storage.setState(document.getStorageState());
        response.setStorage(storage);
        return response;
    }
}
