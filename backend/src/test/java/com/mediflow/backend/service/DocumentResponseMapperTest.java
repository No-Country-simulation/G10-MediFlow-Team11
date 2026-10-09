package com.mediflow.backend.service;

import com.mediflow.backend.config.JacksonConfig;
import com.mediflow.backend.dto.response.DocumentoCanonicoResponse;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import com.mediflow.backend.enums.StorageState;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocumentResponseMapperTest {

    private final JsonMapper jsonMapper = JacksonConfig.createJsonMapper();
    private final DocumentResponseMapper responseMapper = new DocumentResponseMapper(jsonMapper);

    @Test
    void reconstructsCanonicalResponseFromPersistedColumnsAndJson() {
        DocumentRecord document = baseDocument(DocumentStatus.PROCESSED);
        document.setDocumentType(DocumentType.IMAGING_REPORT);
        document.setSpecialty("Radiologia");
        document.setPriority(PriorityLevel.URGENT);
        document.setConfidenceClassification(0.99);
        document.setConfidenceExtraction(0.94);
        document.setConfidenceGlobal(0.96);
        document.setExtractedData(Map.of("patient", Map.of("name", "Ana"), "clinical_code", Map.of("code", "I26.9")));
        document.setValidation(Map.of("missing_fields", List.of(), "inconsistencies", List.of(), "warnings", List.of("revisar")));
        document.setNotification(Map.of("generated", true, "type", "MEDICAL_EMERGENCY", "message", "Alerta"));

        JsonNode json = jsonMapper.readTree(jsonMapper.writeValueAsString(responseMapper.toResponse(document)));
        assertEquals("DOC-70", json.get("document_id").asString());
        assertEquals("IMAGING_REPORT", json.get("classification").get("document_type").asString());
        assertEquals("Radiologia", json.get("classification").get("specialty").asString());
        assertEquals("URGENT", json.get("classification").get("priority_level").asString());
        assertEquals(0.96, json.get("confidence").get("global").asDouble());
        assertEquals("Ana", json.get("extracted_data").get("patient").get("name").asString());
        assertEquals("I26.9", json.get("extracted_data").get("clinical_code").get("code").asString());
        assertEquals("revisar", json.get("validation").get("warnings").get(0).asString());
        assertFalse(json.get("routing_decision").get("requires_human_review").asBoolean());
        assertEquals("MEDICAL_EMERGENCY", json.get("routing_decision").get("primary_destination").asString());
        assertEquals("Alerta", json.get("notification").get("message").asString());
        assertEquals("OCI_OBJECT_STORAGE", json.get("storage").get("provider").asString());
        assertEquals("SUCCESS", json.get("storage").get("state").asString());
        assertFalse(json.toString().contains("private-bucket"));
        assertFalse(json.toString().contains("recibidos/"));
    }

    @Test
    void keepsAbsentAiBlocksNullAndDerivesReviewFromCurrentStatus() {
        DocumentRecord document = baseDocument(DocumentStatus.NEEDS_AUDIT);
        document.setAuditReasons(List.of(AuditReason.AI_TIMEOUT));
        document.setNotification(DocumentRecord.defaultNotification());

        DocumentoCanonicoResponse response = responseMapper.toResponse(document);
        assertNull(response.getClassification());
        assertNull(response.getConfidence());
        assertNull(response.getExtractedData());
        assertNull(response.getValidation());
        assertTrue(response.getRoutingDecision().isRequiresHumanReview());

        JsonNode json = jsonMapper.readTree(jsonMapper.writeValueAsString(response));
        assertTrue(json.get("classification").isNull());
        assertTrue(json.get("confidence").isNull());
        assertTrue(json.get("extracted_data").isNull());
        assertTrue(json.get("validation").isNull());
        assertEquals("AI_TIMEOUT", json.get("routing_decision").get("audit_reasons").get(0).asString());
        assertFalse(json.get("notification").get("generated").asBoolean());
        assertFalse(json.get("notification").has("type"));

        document.setStatus(DocumentStatus.APPROVED);
        assertFalse(responseMapper.toResponse(document).getRoutingDecision().isRequiresHumanReview());
        assertEquals(List.of(AuditReason.AI_TIMEOUT), responseMapper.toResponse(document).getRoutingDecision().getAuditReasons());
    }

    @Test
    void treatsPartialPersistedConfidenceAsNull() {
        DocumentRecord document = baseDocument(DocumentStatus.PROCESSED);
        document.setConfidenceClassification(0.99);
        document.setConfidenceExtraction(0.94);

        assertNull(responseMapper.toResponse(document).getConfidence());
    }

    private static DocumentRecord baseDocument(DocumentStatus status) {
        DocumentRecord document = new DocumentRecord();
        document.setId("DOC-70");
        document.setStatus(status);
        document.setRoutingDestination(PrimaryDestination.MEDICAL_EMERGENCY);
        document.setRoutingJustification("Destino persistido");
        document.setStorageState(StorageState.SUCCESS);
        document.setBucket("private-bucket");
        document.setObjectKey("recibidos/DOC-70/original.pdf");
        return document;
    }
}
