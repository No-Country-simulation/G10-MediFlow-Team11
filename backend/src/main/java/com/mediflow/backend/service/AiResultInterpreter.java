package com.mediflow.backend.service;

import com.mediflow.backend.dto.response.AiProcessResponse;
import com.mediflow.backend.dto.response.RoutingDecisionAi;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import com.mediflow.backend.enums.TriageEventType;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;

@Component
public class AiResultInterpreter {

    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};

    private final JsonMapper jsonMapper;
    private final NotificationFactory notificationFactory;

    public AiResultInterpreter(JsonMapper jsonMapper, NotificationFactory notificationFactory) {
        this.jsonMapper = jsonMapper;
        this.notificationFactory = notificationFactory;
    }

    public FinalizationCommand fromAiResponse(String documentId, AiProcessResponse response) {
        RoutingDecisionAi routing = response.getRoutingDecision();
        List<AuditReason> reasons = routing.getAuditReasons() == null
                ? List.of()
                : routing.getAuditReasons().stream().distinct().toList();
        PrimaryDestination destination = routing.getPrimaryDestination();
        PriorityLevel priority = response.getClassification().getPriorityLevel();

        DocumentStatus status = reasons.isEmpty() && destination != PrimaryDestination.HUMAN_REVIEW
                ? DocumentStatus.PROCESSED
                : DocumentStatus.NEEDS_AUDIT;
        if (status == DocumentStatus.PROCESSED && priority == null) {
            return fromTechnicalFailure(documentId, AuditReason.INVALID_AI_RESPONSE);
        }

        return new FinalizationCommand(
                documentId,
                status,
                response.getClassification().getDocumentType(),
                response.getClassification().getSpecialty(),
                priority,
                response.getConfidence().getClassification(),
                response.getConfidence().getExtraction(),
                response.getConfidence().getGlobal(),
                destination,
                routing.getJustification(),
                reasons,
                jsonMapper.convertValue(response.getExtractedData(), MAP),
                jsonMapper.convertValue(response.getValidation(), MAP),
                notificationFactory.forInitialTriage(documentId, status, priority, destination),
                TriageEventType.INITIAL_TRIAGE,
                null,
                null
        );
    }

    public FinalizationCommand fromTechnicalFailure(String documentId, AuditReason reason) {
        return new FinalizationCommand(
                documentId,
                DocumentStatus.NEEDS_AUDIT,
                null,
                null,
                null,
                null,
                null,
                null,
                PrimaryDestination.HUMAN_REVIEW,
                justificationFor(reason),
                List.of(reason),
                null,
                null,
                DocumentRecord.defaultNotification(),
                TriageEventType.INITIAL_TRIAGE,
                null,
                null
        );
    }

    static String justificationFor(AuditReason reason) {
        return switch (reason) {
            case AI_TIMEOUT -> "El servicio de IA no respondió dentro del tiempo configurado.";
            case AI_UNAVAILABLE -> "El servicio de IA no está disponible.";
            default -> "El servicio de IA devolvió una respuesta no válida.";
        };
    }
}
