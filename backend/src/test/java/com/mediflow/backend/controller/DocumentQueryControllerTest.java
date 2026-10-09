package com.mediflow.backend.controller;

import com.mediflow.backend.config.JacksonConfig;
import com.mediflow.backend.dto.response.ApiErrorResponse;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.entity.DocumentTriageHistory;
import com.mediflow.backend.entity.DocumentTriageHistoryId;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.InputType;
import com.mediflow.backend.enums.HumanDecision;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.StorageState;
import com.mediflow.backend.enums.TriageEventType;
import com.mediflow.backend.persistence.DocumentPersistenceService;
import com.mediflow.backend.service.DocumentResponseMapper;
import com.mediflow.backend.service.ObjectStorageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.ByteArrayHttpMessageConverter;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DocumentQueryControllerTest {

    private final DocumentPersistenceService persistenceService = mock(DocumentPersistenceService.class);
    private final ObjectStorageService storageService = mock(ObjectStorageService.class);
    private final DocumentQueryController controller = new DocumentQueryController(
            persistenceService, new DocumentResponseMapper(JacksonConfig.createJsonMapper()), storageService);

    @Test
    void historyRouteReturnsOrderedPersistedSnapshotsAndNullableDecision() throws Exception {
        DocumentRecord document = new DocumentRecord();
        document.setId("DOC-70");
        document.setStatus(DocumentStatus.APPROVED);
        Map<String, Object> initial = new LinkedHashMap<>();
        initial.put("status", "NEEDS_AUDIT");
        initial.put("classification", null);
        initial.put("custom_nested", Map.of("source", "persisted"));
        Map<String, Object> reviewed = Map.of("status", "APPROVED", "custom_nested", Map.of("version", 2));
        DocumentTriageHistory first = historyEntry(1, TriageEventType.INITIAL_TRIAGE, null, initial);
        DocumentTriageHistory second = historyEntry(2, TriageEventType.HUMAN_REVIEW, HumanDecision.APPROVE, reviewed);
        when(persistenceService.findDocument("DOC-70")).thenReturn(Optional.of(document));
        when(persistenceService.listHistory("DOC-70")).thenReturn(List.of(first, second));

        String json = mvc().perform(get("/api/v1/documents/DOC-70/history"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.document_id").value("DOC-70"))
                .andExpect(jsonPath("$.entries[0].sequence").value(1))
                .andExpect(jsonPath("$.entries[1].sequence").value(2))
                .andExpect(jsonPath("$.entries[0].event_type").value("INITIAL_TRIAGE"))
                .andExpect(jsonPath("$.entries[1].event_type").value("HUMAN_REVIEW"))
                .andExpect(jsonPath("$.entries[0].decision").value((Object) null))
                .andExpect(jsonPath("$.entries[1].decision").value("APPROVE"))
                .andExpect(jsonPath("$.entries[0].occurred_at").value("2026-09-15T18:00:00Z"))
                .andReturn().getResponse().getContentAsString();

        var mapper = JacksonConfig.createJsonMapper();
        var entries = mapper.readTree(json).get("entries");
        assertEquals(mapper.readTree(mapper.writeValueAsString(initial)), entries.get(0).get("result"));
        assertEquals(mapper.readTree(mapper.writeValueAsString(reviewed)), entries.get(1).get("result"));
        assertSame(initial, ((com.mediflow.backend.dto.response.DocumentHistoryResponse)
                controller.getHistory("DOC-70").getBody()).entries().get(0).result());
    }

    @Test
    void historyRouteReturnsEmptyEntriesForExistingDocument() throws Exception {
        when(persistenceService.findDocument("DOC-70")).thenReturn(Optional.of(new DocumentRecord()));
        when(persistenceService.listHistory("DOC-70")).thenReturn(List.of());

        mvc().perform(get("/api/v1/documents/DOC-70/history"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.document_id").value("DOC-70"))
                .andExpect(jsonPath("$.entries").isArray())
                .andExpect(jsonPath("$.entries").isEmpty());
    }

    @Test
    void historyRouteReturnsNotFoundWithoutQueryingHistory() throws Exception {
        when(persistenceService.findDocument("missing")).thenReturn(Optional.empty());

        mvc().perform(get("/api/v1/documents/missing/history"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("DOCUMENT_NOT_FOUND"));
        verify(persistenceService, never()).listHistory("missing");
    }

    @Test
    void historyRouteMapsDocumentLookupFailureToPersistenceError() throws Exception {
        when(persistenceService.findDocument("DOC-70"))
                .thenThrow(new DataAccessResourceFailureException("database unavailable"));

        mvc().perform(get("/api/v1/documents/DOC-70/history"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error.code").value("PERSISTENCE_ERROR"));
    }

    @Test
    void historyRouteMapsHistoryQueryFailureToPersistenceError() throws Exception {
        when(persistenceService.findDocument("DOC-70")).thenReturn(Optional.of(new DocumentRecord()));
        when(persistenceService.listHistory("DOC-70"))
                .thenThrow(new DataAccessResourceFailureException("database unavailable"));

        mvc().perform(get("/api/v1/documents/DOC-70/history"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error.code").value("PERSISTENCE_ERROR"));
    }

    @Test
    void auditRouteReturnsOrderedPublicFieldsAndPreservesNulls() throws Exception {
        DocumentRecord first = auditDocument("DOC-A", "2026-09-15T18:00:00Z");
        first.setFileName(null);
        first.setDocumentType(null);
        DocumentRecord second = auditDocument("DOC-B", "2026-09-15T18:00:00Z");
        second.setFileName("informe.pdf");
        second.setDocumentType(DocumentType.IMAGING_REPORT);
        DocumentRecord later = auditDocument("DOC-0", "2026-09-15T19:00:00Z");
        when(persistenceService.listAuditDocuments()).thenReturn(List.of(first, second, later));

        String json = mvc().perform(get("/api/v1/documents/audit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].document_id").value("DOC-A"))
                .andExpect(jsonPath("$[1].document_id").value("DOC-B"))
                .andExpect(jsonPath("$[2].document_id").value("DOC-0"))
                .andExpect(jsonPath("$[0].file_name").value((Object) null))
                .andExpect(jsonPath("$[0].document_type").value((Object) null))
                .andExpect(jsonPath("$[1].document_type").value("IMAGING_REPORT"))
                .andExpect(jsonPath("$[0].created_at").value("2026-09-15T18:00:00Z"))
                .andReturn().getResponse().getContentAsString();

        var firstJson = JacksonConfig.createJsonMapper().readTree(json).get(0);
        assertEquals(9, firstJson.size());
        assertEquals("NEEDS_AUDIT", firstJson.get("status").asString());
        assertEquals("FILE", firstJson.get("input_type").asString());
        assertEquals("application/pdf", firstJson.get("mime_type").asString());
        assertEquals("AI_TIMEOUT", firstJson.get("audit_reasons").get(0).asString());
        assertEquals("2026-09-15T18:01:00Z", firstJson.get("updated_at").asString());
        verify(persistenceService, never()).findDocument("audit");
    }

    @Test
    void auditRouteReturnsEmptyArrayWhenNoPendingDocuments() throws Exception {
        when(persistenceService.listAuditDocuments()).thenReturn(List.of());

        mvc().perform(get("/api/v1/documents/audit"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void auditRouteReturnsPersistenceErrorEnvelopeOnDatabaseFailure() throws Exception {
        when(persistenceService.listAuditDocuments())
                .thenThrow(new DataAccessResourceFailureException("database unavailable"));

        mvc().perform(get("/api/v1/documents/audit"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error.code").value("PERSISTENCE_ERROR"));
    }

    @Test
    void getRouteReturnsCanonicalJson() throws Exception {
        DocumentRecord document = new DocumentRecord();
        document.setId("DOC-70");
        document.setStatus(DocumentStatus.NEEDS_AUDIT);
        document.setRoutingDestination(PrimaryDestination.HUMAN_REVIEW);
        document.setRoutingJustification("Procesamiento pendiente");
        document.setStorageState(StorageState.PENDING);
        when(persistenceService.findDocument("DOC-70")).thenReturn(Optional.of(document));
        MockMvc mvc = standaloneSetup(controller)
                .setMessageConverters(new ByteArrayHttpMessageConverter(),
                        new JacksonJsonHttpMessageConverter(JacksonConfig.createJsonMapper()))
                .build();

        mvc.perform(get("/api/v1/documents/DOC-70"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.document_id").value("DOC-70"))
                .andExpect(jsonPath("$.routing_decision.requires_human_review").value(true))
                .andExpect(jsonPath("$.classification").value((Object) null))
                .andExpect(jsonPath("$.storage.state").value("PENDING"));
    }

    @Test
    void missingIdReturnsDocumentNotFoundInApiErrorEnvelope() {
        when(persistenceService.findDocument("missing")).thenReturn(Optional.empty());

        ResponseEntity<Object> response = controller.getDocument("missing");

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertEquals("DOCUMENT_NOT_FOUND", ((ApiErrorResponse) response.getBody()).getError().getCode());
    }

    @Test
    void databaseFailureReturnsPersistenceErrorInApiErrorEnvelope() {
        when(persistenceService.findDocument("DOC-70"))
                .thenThrow(new DataAccessResourceFailureException("database unavailable"));

        ResponseEntity<Object> response = controller.getDocument("DOC-70");

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals("PERSISTENCE_ERROR", ((ApiErrorResponse) response.getBody()).getError().getCode());
    }

    @ParameterizedTest
    @ValueSource(strings = {"application/pdf", "image/jpeg", "image/png"})
    void fileContentReturnsOriginalBytesWithPersistedMimeType(String mimeType) throws Exception {
        DocumentRecord document = contentDocument(InputType.FILE, mimeType);
        byte[] original = new byte[] {0, 1, (byte) 255, 42};
        when(persistenceService.findDocument("DOC-70")).thenReturn(Optional.of(document));
        when(storageService.getObject("stored-original-key")).thenReturn(original);

        mvc().perform(get("/api/v1/documents/DOC-70/content"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(mimeType))
                .andExpect(content().bytes(original));
        verify(storageService).getObject("stored-original-key");
    }

    @Test
    void textContentReturnsOriginalJsonBytes() throws Exception {
        DocumentRecord document = contentDocument(InputType.TEXT, "application/json");
        byte[] original = "{\"document_id\":\"DOC-70\",\"document_text\":\"á\"}"
                .getBytes(StandardCharsets.UTF_8);
        when(persistenceService.findDocument("DOC-70")).thenReturn(Optional.of(document));
        when(storageService.getObject("stored-original-key")).thenReturn(original);

        mvc().perform(get("/api/v1/documents/DOC-70/content"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(content().bytes(original));
    }

    @Test
    void contentMissingIdReturnsDocumentNotFound() {
        when(persistenceService.findDocument("missing")).thenReturn(Optional.empty());

        ResponseEntity<Object> response = controller.getContent("missing");

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertEquals("DOCUMENT_NOT_FOUND", ((ApiErrorResponse) response.getBody()).getError().getCode());
    }

    @Test
    void contentDatabaseFailureReturnsPersistenceError() {
        when(persistenceService.findDocument("DOC-70"))
                .thenThrow(new DataAccessResourceFailureException("database unavailable"));

        ResponseEntity<Object> response = controller.getContent("DOC-70");

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals("PERSISTENCE_ERROR", ((ApiErrorResponse) response.getBody()).getError().getCode());
    }

    @Test
    void contentStorageFailureReturnsStorageError() {
        when(persistenceService.findDocument("DOC-70"))
                .thenReturn(Optional.of(contentDocument(InputType.FILE, "application/pdf")));
        when(storageService.getObject("stored-original-key"))
                .thenThrow(new ObjectStorageService.StorageOperationException("unavailable", new RuntimeException()));

        ResponseEntity<Object> response = controller.getContent("DOC-70");

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals("STORAGE_ERROR", ((ApiErrorResponse) response.getBody()).getError().getCode());
    }

    private MockMvc mvc() {
        return standaloneSetup(controller)
                .setMessageConverters(new ByteArrayHttpMessageConverter(),
                        new JacksonJsonHttpMessageConverter(JacksonConfig.createJsonMapper()))
                .build();
    }

    private static DocumentRecord contentDocument(InputType inputType, String mimeType) {
        DocumentRecord document = new DocumentRecord();
        document.setInputType(inputType);
        document.setMimeType(mimeType);
        document.setObjectKey("stored-original-key");
        document.setBucket("private-bucket");
        return document;
    }

    private static DocumentRecord auditDocument(String id, String createdAt) {
        DocumentRecord document = new DocumentRecord();
        document.setId(id);
        document.setStatus(DocumentStatus.NEEDS_AUDIT);
        document.setInputType(InputType.FILE);
        document.setMimeType("application/pdf");
        document.setAuditReasons(List.of(AuditReason.AI_TIMEOUT));
        document.setCreatedAt(Instant.parse(createdAt));
        document.setUpdatedAt(Instant.parse("2026-09-15T18:01:00Z"));
        document.setBucket("private-bucket");
        document.setObjectKey("private-key");
        return document;
    }

    private static DocumentTriageHistory historyEntry(int sequence, TriageEventType eventType,
                                                       HumanDecision decision, Map<String, Object> result) {
        DocumentTriageHistory entry = new DocumentTriageHistory();
        entry.setId(new DocumentTriageHistoryId("DOC-70", sequence));
        entry.setEventType(eventType);
        entry.setDecision(decision);
        entry.setOccurredAt(Instant.parse("2026-09-15T18:00:00Z"));
        entry.setResult(result);
        return entry;
    }
}
