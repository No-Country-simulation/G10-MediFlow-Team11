package com.mediflow.backend.service;

import com.mediflow.backend.config.JacksonConfig;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import com.mediflow.backend.enums.TriageEventType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiResultInterpreterTest {

    private final AiResultInterpreter interpreter =
            new AiResultInterpreter(JacksonConfig.createJsonMapper(), new NotificationFactory());

    @Test
    void cleanResponseWithBusinessDestinationIsProcessed() {
        FinalizationCommand command = interpreter.fromAiResponse("DOC-1",
                ProcessingTestData.aiResponse("DOC-1", "ROUTINE", "MEDICAL_RECORD", "[]"));

        assertEquals(DocumentStatus.PROCESSED, command.status());
        assertEquals(PriorityLevel.ROUTINE, command.priority());
        assertEquals(PrimaryDestination.MEDICAL_RECORD, command.routingDestination());
        assertEquals(DocumentType.IMAGING_REPORT, command.documentType());
        assertEquals("Radiologia", command.specialty());
        assertEquals(0.99, command.confidenceClassification());
        assertEquals(0.94, command.confidenceExtraction());
        assertEquals(0.96, command.confidenceGlobal());
        assertEquals("Justificacion sintetica.", command.routingJustification());
        assertTrue(command.auditReasons().isEmpty());
        assertEquals(TriageEventType.INITIAL_TRIAGE, command.eventType());
        assertNull(command.decision());
        assertNull(command.expectedHistorySequence());
        assertEquals(Map.of("generated", false), command.notification());
    }

    @Test
    void extractedDataAndValidationKeepSnakeCaseAndUnknownKeys() {
        FinalizationCommand command = interpreter.fromAiResponse("DOC-1",
                ProcessingTestData.aiResponse("DOC-1", "ROUTINE", "MEDICAL_RECORD", "[]"));

        assertEquals("Diagnostico sintetico", command.extractedData().get("primary_diagnosis"));
        assertEquals(List.of(Map.of("name", "Estudio sintetico")), command.extractedData().get("requested_studies"));
        assertEquals(Map.of("name", "Paciente Sintetico", "age", 52), command.extractedData().get("patient"));
        assertEquals(List.of(), command.validation().get("missing_fields"));
        assertEquals(List.of(), command.validation().get("inconsistencies"));
        assertEquals(List.of(), command.validation().get("warnings"));
    }

    @Test
    void urgentEmergencyProcessedGeneratesNotification() {
        FinalizationCommand command = interpreter.fromAiResponse("DOC-U",
                ProcessingTestData.aiResponse("DOC-U", "URGENT", "MEDICAL_EMERGENCY", "[]"));

        assertEquals(DocumentStatus.PROCESSED, command.status());
        assertEquals(Map.of(
                "generated", true,
                "type", "MEDICAL_EMERGENCY",
                "message", "ALERTA URGENTE: el documento DOC-U requiere atención inmediata."), command.notification());
    }

    @Test
    void urgentWithOtherDestinationDoesNotNotify() {
        FinalizationCommand command = interpreter.fromAiResponse("DOC-U",
                ProcessingTestData.aiResponse("DOC-U", "URGENT", "PHARMACY", "[]"));

        assertEquals(DocumentStatus.PROCESSED, command.status());
        assertEquals(Map.of("generated", false), command.notification());
    }

    @Test
    void semanticReasonsMakeItNeedAuditKeepingSuggestedDestinationAndNoNotification() {
        FinalizationCommand command = interpreter.fromAiResponse("DOC-A",
                ProcessingTestData.aiResponse("DOC-A", "URGENT", "MEDICAL_EMERGENCY",
                        "[\"LOW_CONFIDENCE\", \"MISSING_CRITICAL_FIELDS\", \"LOW_CONFIDENCE\"]"));

        assertEquals(DocumentStatus.NEEDS_AUDIT, command.status());
        assertEquals(List.of(AuditReason.LOW_CONFIDENCE, AuditReason.MISSING_CRITICAL_FIELDS), command.auditReasons());
        assertEquals(PrimaryDestination.MEDICAL_EMERGENCY, command.routingDestination());
        assertEquals(DocumentType.IMAGING_REPORT, command.documentType());
        assertEquals(Map.of("generated", false), command.notification());
    }

    @Test
    void humanReviewDestinationWithoutReasonsNeedsAudit() {
        FinalizationCommand command = interpreter.fromAiResponse("DOC-H",
                ProcessingTestData.aiResponse("DOC-H", "ROUTINE", "HUMAN_REVIEW", "[]"));

        assertEquals(DocumentStatus.NEEDS_AUDIT, command.status());
        assertTrue(command.auditReasons().isEmpty());
        assertEquals(PrimaryDestination.HUMAN_REVIEW, command.routingDestination());
    }

    @ParameterizedTest
    @EnumSource(value = AuditReason.class, names = {"AI_TIMEOUT", "AI_UNAVAILABLE", "INVALID_AI_RESPONSE"})
    void technicalFailureBuildsCanonicalFallback(AuditReason reason) {
        FinalizationCommand command = interpreter.fromTechnicalFailure("DOC-F", reason);

        assertEquals(DocumentStatus.NEEDS_AUDIT, command.status());
        assertEquals(List.of(reason), command.auditReasons());
        assertEquals(PrimaryDestination.HUMAN_REVIEW, command.routingDestination());
        assertNull(command.documentType());
        assertNull(command.specialty());
        assertNull(command.priority());
        assertNull(command.confidenceClassification());
        assertNull(command.confidenceExtraction());
        assertNull(command.confidenceGlobal());
        assertNull(command.extractedData());
        assertNull(command.validation());
        assertEquals(Map.of("generated", false), command.notification());
        assertFalse(command.routingJustification().isBlank());
        assertEquals(TriageEventType.INITIAL_TRIAGE, command.eventType());
    }

    @Test
    void timeoutJustificationMatchesTheContractExample() {
        assertEquals("El servicio de IA no respondió dentro del tiempo configurado.",
                interpreter.fromTechnicalFailure("DOC-F", AuditReason.AI_TIMEOUT).routingJustification());
    }

    @Test
    void processedWithoutPriorityDegradesToInvalidResponseFallback() {
        var response = ProcessingTestData.aiResponse("DOC-N", "ROUTINE", "MEDICAL_RECORD", "[]");
        response.getClassification().setPriorityLevel(null);

        FinalizationCommand command = interpreter.fromAiResponse("DOC-N", response);

        assertEquals(DocumentStatus.NEEDS_AUDIT, command.status());
        assertEquals(List.of(AuditReason.INVALID_AI_RESPONSE), command.auditReasons());
        assertNull(command.documentType());
    }
}
