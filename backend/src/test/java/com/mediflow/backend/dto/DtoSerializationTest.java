package com.mediflow.backend.dto;

import com.mediflow.backend.config.JacksonConfig;
import com.mediflow.backend.dto.request.ProcessFileRequest;
import com.mediflow.backend.dto.request.ProcessTextRequest;
import com.mediflow.backend.dto.response.AiErrorResponse;
import com.mediflow.backend.dto.response.AiProcessResponse;
import com.mediflow.backend.dto.response.ApiErrorResponse;
import com.mediflow.backend.dto.response.DocumentoCanonicoResponse;
import com.mediflow.backend.dto.response.NotificationResponse;
import com.mediflow.backend.dto.response.RoutingDecisionAi;
import com.mediflow.backend.dto.response.RoutingDecisionResponse;
import com.mediflow.backend.dto.response.StorageResponse;
import com.mediflow.backend.dto.shared.Classification;
import com.mediflow.backend.dto.shared.Confidence;
import com.mediflow.backend.dto.shared.ExtractedData;
import com.mediflow.backend.dto.shared.Validation;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.BackendErrorCode;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.InputType;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import com.mediflow.backend.enums.StorageState;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DtoSerializationTest {

    private final JsonMapper mapper = JacksonConfig.createJsonMapper();

    @Test
    void processTextRequestRoundTripsWithOptionalDocumentId() {
        String json = """
                {
                  "document_text": "HOSPITAL SANTA LUCIA - INFORME...",
                  "origin_channel": "Guardia_Emergencias"
                }
                """;

        ProcessTextRequest request = mapper.readValue(json, ProcessTextRequest.class);
        assertNull(request.getDocumentId());
        assertEquals("Guardia_Emergencias", request.getOriginChannel());

        request.setDocumentId("DOC-CLIN-2026-8942");
        JsonNode node = mapper.readTree(mapper.writeValueAsString(request));
        assertEquals("DOC-CLIN-2026-8942", node.get("document_id").asString());
        assertEquals("HOSPITAL SANTA LUCIA - INFORME...", node.get("document_text").asString());
        assertEquals("Guardia_Emergencias", node.get("origin_channel").asString());
    }

    @Test
    void processFileRequestRepresentsMultipartContractWithOptionalDocumentId() {
        ProcessFileRequest request = new ProcessFileRequest();
        request.setFile(new MockMultipartFile("file", "informe.pdf", "application/pdf", new byte[] {1, 2, 3}));
        request.setOriginChannel("Portal_Pacientes");

        assertNull(request.getDocumentId());
        assertEquals("informe.pdf", request.getFile().getOriginalFilename());
        assertEquals("Portal_Pacientes", request.getOriginChannel());
    }

    @Test
    void processingRequestSerializesTextVariant() {
        ProcessingRequest req = new ProcessingRequest();
        req.setDocumentId("DOC-CLIN-2026-8942");
        req.setInputType(InputType.TEXT);
        req.setMimeType("text/plain");
        req.setDocumentText("texto de prueba");
        req.setOriginChannel("Guardia_Emergencias");

        JsonNode node = mapper.readTree(mapper.writeValueAsString(req));
        assertEquals("TEXT", node.get("input_type").asString());
        assertTrue(node.get("content_base64").isNull());
        assertEquals("texto de prueba", node.get("document_text").asString());

        ProcessingRequest back = mapper.readValue(node.toString(), ProcessingRequest.class);
        assertEquals(InputType.TEXT, back.getInputType());
        assertTrue(back.isValid());
    }

    @Test
    void processingRequestSerializesFileVariant() {
        ProcessingRequest req = new ProcessingRequest();
        req.setDocumentId("DOC-FILE-0001");
        req.setInputType(InputType.FILE);
        req.setMimeType("application/pdf");
        req.setFileName("informe.pdf");
        req.setContentBase64("JVBERi0xLjQK");
        req.setOriginChannel("Portal_Pacientes");

        JsonNode node = mapper.readTree(mapper.writeValueAsString(req));
        assertEquals("FILE", node.get("input_type").asString());
        assertEquals("JVBERi0xLjQK", node.get("content_base64").asString());
        assertTrue(node.get("document_text").isNull());

        ProcessingRequest back = mapper.readValue(node.toString(), ProcessingRequest.class);
        assertEquals(InputType.FILE, back.getInputType());
        assertEquals("informe.pdf", back.getFileName());
        assertTrue(back.isValid());
    }

    @Test
    void processingRequestRejectsIncoherentVariants() {
        ProcessingRequest fileWithoutContent = new ProcessingRequest();
        fileWithoutContent.setInputType(InputType.FILE);
        fileWithoutContent.setDocumentText("no aplica");
        assertFalse(fileWithoutContent.isValid());

        ProcessingRequest textWithoutBody = new ProcessingRequest();
        textWithoutBody.setInputType(InputType.TEXT);
        textWithoutBody.setContentBase64("AAAA");
        assertFalse(textWithoutBody.isValid());
    }

    @Test
    void aiProcessResponseRoundTripsWithoutBackendOwnedFields() {
        String json = """
                {
                  "document_id": "DOC-CLIN-2026-8942",
                  "classification": {
                    "document_type": "IMAGING_REPORT",
                    "specialty": "Radiologia / Neumonologia",
                    "priority_level": "URGENT"
                  },
                  "confidence": {
                    "classification": 0.99,
                    "extraction": 0.94,
                    "global": 0.96
                  },
                  "extracted_data": {
                    "patient": { "name": "Carlos Eduardo Mendes", "age": 52 },
                    "requesting_doctor": { "name": "Dra. Renata Silveira", "license_number": "145892" },
                    "primary_diagnosis": "Tromboembolismo Pulmonar Agudo",
                    "suggested_icd10": "I26.9"
                  },
                  "validation": {
                    "missing_fields": [],
                    "inconsistencies": [],
                    "warnings": []
                  },
                  "routing_decision": {
                    "primary_destination": "MEDICAL_EMERGENCY",
                    "audit_reasons": ["LOW_CONFIDENCE"],
                    "justification": "Hallazgo de alta prioridad clínica."
                  }
                }
                """;

        AiProcessResponse response = mapper.readValue(json, AiProcessResponse.class);
        assertEquals("DOC-CLIN-2026-8942", response.getDocumentId());
        assertEquals(DocumentType.IMAGING_REPORT, response.getClassification().getDocumentType());
        assertEquals(PriorityLevel.URGENT, response.getClassification().getPriorityLevel());
        assertEquals(0.96, response.getConfidence().getGlobal());
        assertEquals("Carlos Eduardo Mendes", response.getExtractedData().getPatient().getName());
        assertEquals("145892", response.getExtractedData().getRequestingDoctor().getLicenseNumber());
        assertEquals(PrimaryDestination.MEDICAL_EMERGENCY, response.getRoutingDecision().getPrimaryDestination());
        assertEquals(List.of(AuditReason.LOW_CONFIDENCE), response.getRoutingDecision().getAuditReasons());

        JsonNode node = mapper.readTree(mapper.writeValueAsString(response));
        assertTrue(node.get("routing_decision").has("audit_reasons"));
        assertFalse(node.has("status"));
        assertFalse(node.has("notification"));
        assertFalse(node.has("storage"));
        assertFalse(node.get("routing_decision").has("requires_human_review"));
        assertFalse(node.toString().contains("OCI"));
    }

    @Test
    void aiErrorResponseRoundTripsControlledEnvelope() {
        String json = """
                {
                  "error": {
                    "code": "AI_OUTPUT_INVALID",
                    "message": "No se pudo producir una respuesta estructurada válida."
                  }
                }
                """;

        AiErrorResponse error = mapper.readValue(json, AiErrorResponse.class);
        assertEquals("AI_OUTPUT_INVALID", error.getError().getCode());

        JsonNode node = mapper.readTree(mapper.writeValueAsString(error));
        assertEquals("AI_OUTPUT_INVALID", node.get("error").get("code").asString());
        assertTrue(node.get("error").get("message").asString().contains("estructurada"));
    }

    @Test
    void documentoCanonicoResponseRoundTripsBackendOwnedBlocks() {
        DocumentoCanonicoResponse response = new DocumentoCanonicoResponse();
        response.setDocumentId("DOC-CLIN-2026-8942");
        response.setStatus(DocumentStatus.PROCESSED);

        Classification classification = new Classification();
        classification.setDocumentType(DocumentType.IMAGING_REPORT);
        classification.setSpecialty("Radiologia / Neumonologia");
        classification.setPriorityLevel(PriorityLevel.URGENT);
        response.setClassification(classification);

        Confidence confidence = new Confidence();
        confidence.setClassification(0.99);
        confidence.setExtraction(0.94);
        confidence.setGlobal(0.96);
        response.setConfidence(confidence);

        ExtractedData extractedData = new ExtractedData();
        ExtractedData.Patient patient = new ExtractedData.Patient();
        patient.setName("Carlos Eduardo Mendes");
        patient.setAge(52);
        extractedData.setPatient(patient);
        response.setExtractedData(extractedData);

        Validation validation = new Validation();
        validation.setMissingFields(List.of());
        validation.setInconsistencies(List.of());
        validation.setWarnings(List.of());
        response.setValidation(validation);

        RoutingDecisionResponse routing = new RoutingDecisionResponse();
        routing.setPrimaryDestination(PrimaryDestination.MEDICAL_EMERGENCY);
        routing.setRequiresHumanReview(false);
        routing.setAuditReasons(List.of());
        routing.setJustification("Hallazgo de alta prioridad clínica.");
        response.setRoutingDecision(routing);

        NotificationResponse notification = new NotificationResponse();
        notification.setGenerated(true);
        notification.setType(PrimaryDestination.MEDICAL_EMERGENCY);
        notification.setMessage("ALERTA URGENTE: el documento DOC-CLIN-2026-8942 requiere atención inmediata.");
        response.setNotification(notification);

        StorageResponse storage = new StorageResponse();
        storage.setState(StorageState.SUCCESS);
        response.setStorage(storage);

        JsonNode node = mapper.readTree(mapper.writeValueAsString(response));
        assertEquals("PROCESSED", node.get("status").asString());
        assertEquals(false, node.get("routing_decision").get("requires_human_review").asBoolean());
        assertEquals("MEDICAL_EMERGENCY", node.get("notification").get("type").asString());
        assertEquals("OCI_OBJECT_STORAGE", node.get("storage").get("provider").asString());
        assertEquals("SUCCESS", node.get("storage").get("state").asString());
        assertFalse(node.get("storage").has("bucket"));
        assertFalse(node.get("storage").has("object_key"));

        DocumentoCanonicoResponse back = mapper.readValue(node.toString(), DocumentoCanonicoResponse.class);
        assertEquals(DocumentStatus.PROCESSED, back.getStatus());
        assertFalse(back.getRoutingDecision().isRequiresHumanReview());
        assertEquals(StorageState.SUCCESS, back.getStorage().getState());
    }

    @Test
    void documentoCanonicoResponseSerializesNullableAiBlocksOnFailure() {
        String json = """
                {
                  "document_id": "DOC-CLIN-2026-8942",
                  "status": "NEEDS_AUDIT",
                  "classification": null,
                  "confidence": null,
                  "extracted_data": null,
                  "validation": null,
                  "routing_decision": {
                    "primary_destination": "HUMAN_REVIEW",
                    "requires_human_review": true,
                    "audit_reasons": ["AI_TIMEOUT"],
                    "justification": "El servicio de IA no respondió dentro del tiempo configurado."
                  },
                  "notification": { "generated": false },
                  "storage": {
                    "provider": "OCI_OBJECT_STORAGE",
                    "state": "SUCCESS"
                  }
                }
                """;

        DocumentoCanonicoResponse response = mapper.readValue(json, DocumentoCanonicoResponse.class);
        assertEquals(DocumentStatus.NEEDS_AUDIT, response.getStatus());
        assertNull(response.getClassification());
        assertNull(response.getConfidence());
        assertNull(response.getExtractedData());
        assertNull(response.getValidation());
        assertTrue(response.getRoutingDecision().isRequiresHumanReview());
        assertEquals(List.of(AuditReason.AI_TIMEOUT), response.getRoutingDecision().getAuditReasons());
        assertFalse(response.getNotification().isGenerated());
        assertNull(response.getNotification().getType());

        JsonNode node = mapper.readTree(mapper.writeValueAsString(response));
        assertTrue(node.get("classification").isNull());
        assertTrue(node.get("confidence").isNull());
        assertTrue(node.get("extracted_data").isNull());
        assertTrue(node.get("validation").isNull());
        assertFalse(node.get("notification").has("type"));
        assertFalse(node.get("notification").has("message"));
    }

    @Test
    void auditReasonsDeserializeKnownValueAndRejectUnknown() {
        String valid = """
                {
                  "primary_destination": "HUMAN_REVIEW",
                  "audit_reasons": ["MISSING_CRITICAL_FIELDS"],
                  "justification": "Faltan campos críticos."
                }
                """;
        RoutingDecisionAi ai = mapper.readValue(valid, RoutingDecisionAi.class);
        assertEquals(List.of(AuditReason.MISSING_CRITICAL_FIELDS), ai.getAuditReasons());
        assertTrue(ai.getAuditReasons().getFirst().isSemantic());

        String unknown = """
                {
                  "primary_destination": "HUMAN_REVIEW",
                  "audit_reasons": ["NOT_A_DEFINED_REASON"],
                  "justification": "motivo inventado"
                }
                """;
        String unknownCanonical = """
                {
                  "primary_destination": "HUMAN_REVIEW",
                  "requires_human_review": true,
                  "audit_reasons": ["NOT_A_DEFINED_REASON"],
                  "justification": "motivo inventado"
                }
                """;
        assertThrows(JacksonException.class, () -> mapper.readValue(unknown, RoutingDecisionAi.class));
        assertThrows(JacksonException.class, () -> mapper.readValue(unknownCanonical, RoutingDecisionResponse.class));
    }

    @Test
    void apiErrorResponseSerializesBackendHttpEnvelope() {
        ApiErrorResponse error = new ApiErrorResponse(BackendErrorCode.INVALID_FILE_TYPE, "Tipo de archivo no soportado");
        JsonNode node = mapper.readTree(mapper.writeValueAsString(error));
        assertEquals("INVALID_FILE_TYPE", node.get("error").get("code").asString());
        assertEquals("Tipo de archivo no soportado", node.get("error").get("message").asString());

        ApiErrorResponse back = mapper.readValue(node.toString(), ApiErrorResponse.class);
        assertEquals(BackendErrorCode.INVALID_FILE_TYPE.name(), back.getError().getCode());
    }
}
