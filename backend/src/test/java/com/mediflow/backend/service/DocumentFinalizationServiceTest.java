package com.mediflow.backend.service;

import com.mediflow.backend.config.JacksonConfig;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.entity.DocumentTriageHistory;
import com.mediflow.backend.entity.DocumentTriageHistoryId;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.HumanDecision;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import com.mediflow.backend.enums.StorageState;
import com.mediflow.backend.enums.TriageEventType;
import com.mediflow.backend.persistence.DocumentPersistenceService;
import com.mediflow.backend.persistence.FinalizedDocumentState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DocumentFinalizationServiceTest {

    private DocumentPersistenceService persistenceService;
    private ObjectStorageService storageService;
    private ObjectKeyGenerator keyGenerator;
    private DocumentResponseMapper responseMapper;
    private JsonMapper jsonMapper;
    private DocumentFinalizationService service;

    @BeforeEach
    void setUp() {
        persistenceService = mock(DocumentPersistenceService.class);
        storageService = mock(ObjectStorageService.class);
        keyGenerator = new ObjectKeyGenerator();
        jsonMapper = JacksonConfig.createJsonMapper();
        responseMapper = new DocumentResponseMapper(jsonMapper);
        service = new DocumentFinalizationService(
                persistenceService, storageService, keyGenerator, responseMapper, jsonMapper);
    }

    // ── Prefix resolution (arquitectura §11) ──────────────────────────────

    @Test
    void processedUrgentResolvesToUrgentesPrefix() {
        assertEquals(ObjectKeyGenerator.PREFIJO_URGENTES,
                service.resolvePrefix(DocumentStatus.PROCESSED, PriorityLevel.URGENT));
    }

    @Test
    void processedRoutineResolvesToRutinaPrefix() {
        assertEquals(ObjectKeyGenerator.PREFIJO_RUTINA,
                service.resolvePrefix(DocumentStatus.PROCESSED, PriorityLevel.ROUTINE));
    }

    @Test
    void needsAuditResolvesToAuditoriaPrefix() {
        assertEquals(ObjectKeyGenerator.PREFIJO_AUDITORIA,
                service.resolvePrefix(DocumentStatus.NEEDS_AUDIT, null));
    }

    @Test
    void approvedUrgentResolvesToUrgentesPrefix() {
        assertEquals(ObjectKeyGenerator.PREFIJO_URGENTES,
                service.resolvePrefix(DocumentStatus.APPROVED, PriorityLevel.URGENT));
    }

    @Test
    void rejectedResolvesToAuditoriaPrefix() {
        assertEquals(ObjectKeyGenerator.PREFIJO_AUDITORIA,
                service.resolvePrefix(DocumentStatus.REJECTED, null));
    }

    @Test
    void failedStatusThrowsNoFinalPrefix() {
        assertThrows(IllegalStateException.class,
                () -> service.resolvePrefix(DocumentStatus.FAILED, null));
    }

    // ── Success flow with prefix change ──────────────────────────────────

    @Test
    void finalizeResultWithPrefixChangePerformsOciThenPgThenCleanup() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenReturn(historyEntry("DOC-1", 1, Instant.now()));

        FinalizationCommand command = baseCommand(
                DocumentStatus.PROCESSED, PriorityLevel.URGENT, TriageEventType.INITIAL_TRIAGE, null);

        FinalizationOutcome outcome = service.finalizeResult(command);

        assertNotNull(outcome);
        assertEquals(DocumentStatus.PROCESSED, outcome.status());
        assertEquals(1, outcome.sequence());

        var inOrder = inOrder(storageService, persistenceService);
        inOrder.verify(storageService).copyWithinBucket(
                "recibidos/DOC-1/original.pdf",
                "procesados/urgentes/DOC-1/original.pdf");
        inOrder.verify(storageService).putJson(
                eq("procesados/urgentes/DOC-1/triage.json"), anyString());
        inOrder.verify(persistenceService).commitFinalization(anyString(), any(), any(), any(), any(), any(), anyInt());
        inOrder.verify(storageService).deleteObject("recibidos/DOC-1/original.pdf");
        inOrder.verify(storageService).deleteObject("recibidos/DOC-1/triage.json");
    }

    // ── Success flow without prefix change ───────────────────────────────

    @Test
    void finalizeResultWithoutPrefixChangeKeepsOriginalAndOverwritesTriage() {
        DocumentRecord document = baseDocument("procesados/urgentes/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(2);
        when(storageService.getObject("procesados/urgentes/DOC-1/triage.json"))
                .thenReturn("{\"sequence\":1}".getBytes());
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenReturn(historyEntry("DOC-1", 2, Instant.now()));

        FinalizationCommand command = baseCommand(
                DocumentStatus.PROCESSED, PriorityLevel.URGENT, TriageEventType.INITIAL_TRIAGE, null);

        service.finalizeResult(command);

        verify(storageService, never()).copyWithinBucket(anyString(), anyString());
        verify(storageService, never()).deleteObject(anyString());
        verify(storageService).putJson(eq("procesados/urgentes/DOC-1/triage.json"), anyString());
    }

    // ── OCI failure compensation ─────────────────────────────────────────

    @Test
    void ociFailureWithPrefixChangeDeletesDestinationAndSkipsPg() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        doThrow(new ObjectStorageService.StorageOperationException("copy fail", new RuntimeException()))
                .when(storageService).copyWithinBucket(anyString(), anyString());

        FinalizationCommand command = baseCommand(
                DocumentStatus.REJECTED, null, TriageEventType.HUMAN_REVIEW, HumanDecision.REJECT);

        assertThrows(ObjectStorageService.StorageOperationException.class,
                () -> service.finalizeResult(command));

        verify(persistenceService, never()).commitFinalization(anyString(), any(), any(), any(), any(), any(), anyInt());
        verify(storageService).deleteObject("auditoria_humana/DOC-1/original.pdf");
        verify(storageService).deleteObject("auditoria_humana/DOC-1/triage.json");
    }

    @Test
    void ociFailureWithoutPrefixChangeRestoresPreviousTriageArtifact() {
        DocumentRecord document = baseDocument("auditoria_humana/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(2);
        when(storageService.getObject("auditoria_humana/DOC-1/triage.json"))
                .thenReturn("PREVIOUS_JSON".getBytes());
        // putJson fails when writing the new triage artifact
        doThrow(new ObjectStorageService.StorageOperationException("write fail", new RuntimeException()))
                .when(storageService).putJson(eq("auditoria_humana/DOC-1/triage.json"), anyString());

        FinalizationCommand command = baseCommand(
                DocumentStatus.REJECTED, null, TriageEventType.HUMAN_REVIEW, HumanDecision.REJECT);

        assertThrows(ObjectStorageService.StorageOperationException.class,
                () -> service.finalizeResult(command));

        verify(storageService).putJson("auditoria_humana/DOC-1/triage.json", "PREVIOUS_JSON");
    }

    // ── PostgreSQL failure compensation ──────────────────────────────────

    @Test
    void pgFailureWithSafeCompensationDeletesDestinationObjects() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenThrow(new RuntimeException("db down"));
        when(persistenceService.isCompensationSafe("DOC-1", 1)).thenReturn(true);

        FinalizationCommand command = baseCommand(
                DocumentStatus.PROCESSED, PriorityLevel.URGENT, TriageEventType.INITIAL_TRIAGE, null);

        assertThrows(RuntimeException.class, () -> service.finalizeResult(command));

        verify(persistenceService).isCompensationSafe("DOC-1", 1);
        verify(storageService).deleteObject("procesados/urgentes/DOC-1/original.pdf");
        verify(storageService).deleteObject("procesados/urgentes/DOC-1/triage.json");
    }

    @Test
    void pgFailureWithUnsafeCompensationDoesNotTouchOci() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenThrow(new RuntimeException("db down"));
        when(persistenceService.isCompensationSafe("DOC-1", 1)).thenReturn(false);

        FinalizationCommand command = baseCommand(
                DocumentStatus.PROCESSED, PriorityLevel.URGENT, TriageEventType.INITIAL_TRIAGE, null);

        assertThrows(RuntimeException.class, () -> service.finalizeResult(command));

        verify(persistenceService).isCompensationSafe("DOC-1", 1);
        verify(storageService, never()).deleteObject(anyString());
    }

    // ── Fallback for initial triage OCI failure (arquitectura §12.3) ───

    @Test
    void initialTriageOciFailurePersistsNeedsAuditFallback() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        doThrow(new ObjectStorageService.StorageOperationException("copy fail", new RuntimeException()))
                .when(storageService).copyWithinBucket(anyString(), anyString());
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenReturn(historyEntry("DOC-1", 1, Instant.now()));

        FinalizationCommand command = baseCommand(
                DocumentStatus.PROCESSED, PriorityLevel.URGENT, TriageEventType.INITIAL_TRIAGE, null);

        FinalizationOutcome outcome = service.finalizeResult(command);

        assertEquals(DocumentStatus.NEEDS_AUDIT, outcome.status());

        ArgumentCaptor<FinalizedDocumentState> stateCaptor = ArgumentCaptor.forClass(FinalizedDocumentState.class);
        verify(persistenceService).commitFinalization(
                eq("DOC-1"), stateCaptor.capture(), eq(TriageEventType.INITIAL_TRIAGE),
                eq(null), any(), any(Instant.class), eq(1));

        FinalizedDocumentState persisted = stateCaptor.getValue();
        assertEquals(DocumentStatus.NEEDS_AUDIT, persisted.status());
        assertEquals(StorageState.ERROR, persisted.storageState());
        assertEquals(PrimaryDestination.HUMAN_REVIEW, persisted.routingDestination());
        assertEquals("recibidos/DOC-1/original.pdf", persisted.objectKey());
    }

    // ── Triage.json metadata ─────────────────────────────────────────────

    @Test
    void humanReviewTriageArtifactIncludesHumanReviewDecision() throws Exception {
        DocumentRecord document = baseDocument("auditoria_humana/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(2);
        when(storageService.getObject("auditoria_humana/DOC-1/triage.json"))
                .thenReturn("{\"sequence\":1}".getBytes());
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenReturn(historyEntry("DOC-1", 2, Instant.now()));

        FinalizationCommand command = baseCommand(
                DocumentStatus.REJECTED, null, TriageEventType.HUMAN_REVIEW, HumanDecision.REJECT);

        service.finalizeResult(command);

        ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
        verify(storageService).putJson(eq("auditoria_humana/DOC-1/triage.json"), jsonCaptor.capture());

        @SuppressWarnings("unchecked")
        Map<String, Object> artifact = jsonMapper.readValue(jsonCaptor.getValue(), Map.class);
        assertEquals(2, artifact.get("sequence"));
        assertNotNull(artifact.get("created_at"));
        assertNotNull(artifact.get("updated_at"));
        @SuppressWarnings("unchecked")
        Map<String, Object> humanReview = (Map<String, Object>) artifact.get("human_review");
        assertEquals("REJECT", humanReview.get("decision"));
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private DocumentRecord baseDocument(String objectKey) {
        DocumentRecord document = new DocumentRecord();
        document.setId("DOC-1");
        document.setStatus(DocumentStatus.RECEIVED);
        document.setObjectKey(objectKey);
        document.setBucket("mediflow-bucket");
        document.setMimeType("application/pdf");
        document.setFileName("document.pdf");
        document.setInputType(com.mediflow.backend.enums.InputType.FILE);
        document.setStorageState(StorageState.SUCCESS);
        document.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        document.setUpdatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        return document;
    }

    private FinalizationCommand baseCommand(
            DocumentStatus status,
            PriorityLevel priority,
            TriageEventType eventType,
            HumanDecision decision
    ) {
        return new FinalizationCommand(
                "DOC-1",
                status,
                DocumentType.DISCHARGE_SUMMARY,
                "medicina_general",
                priority,
                0.92,
                0.88,
                0.90,
                PrimaryDestination.MEDICAL_RECORD,
                "Documento procesado correctamente",
                List.of(AuditReason.LOW_CONFIDENCE),
                null,
                null,
                DocumentRecord.defaultNotification(),
                eventType,
                decision
        );
    }

    private DocumentTriageHistory historyEntry(String documentId, int sequence, Instant occurredAt) {
        DocumentTriageHistory history = new DocumentTriageHistory();
        history.setId(new DocumentTriageHistoryId(documentId, sequence));
        history.setOccurredAt(occurredAt);
        return history;
    }
}
