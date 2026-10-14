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
import com.mediflow.backend.persistence.DurableCommitInspection;
import com.mediflow.backend.persistence.FinalizedDocumentState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
    private JsonMapper jsonMapper;
    private DocumentFinalizationService service;

    @BeforeEach
    void setUp() {
        persistenceService = mock(DocumentPersistenceService.class);
        storageService = mock(ObjectStorageService.class);
        jsonMapper = JacksonConfig.createJsonMapper();
        service = new DocumentFinalizationService(
                persistenceService,
                storageService,
                new ObjectKeyGenerator(),
                new DocumentResponseMapper(jsonMapper),
                jsonMapper,
                new PassThroughDocumentExclusiveLock());
    }

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
    void approvedRoutineResolvesToRutinaPrefix() {
        assertEquals(ObjectKeyGenerator.PREFIJO_RUTINA,
                service.resolvePrefix(DocumentStatus.APPROVED, PriorityLevel.ROUTINE));
    }

    @Test
    void rejectedResolvesToAuditoriaPrefix() {
        assertEquals(ObjectKeyGenerator.PREFIJO_AUDITORIA,
                service.resolvePrefix(DocumentStatus.REJECTED, null));
    }

    @Test
    void processedWithoutPriorityIsRejected() {
        assertThrows(IllegalStateException.class,
                () -> service.resolvePrefix(DocumentStatus.PROCESSED, null));
    }

    @Test
    void failedStatusThrowsNoFinalPrefix() {
        assertThrows(IllegalStateException.class,
                () -> service.resolvePrefix(DocumentStatus.FAILED, null));
    }

    @Test
    void invalidCommandIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.finalizeResult(null));
        FinalizationCommand missingDecision = baseCommand(
                DocumentStatus.REJECTED, null, TriageEventType.HUMAN_REVIEW, null);
        assertThrows(IllegalArgumentException.class, () -> service.finalizeResult(missingDecision));
    }

    @Test
    void finalizeResultWithPrefixChangePerformsOciThenPgThenCleanup() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenReturn(historyEntry("DOC-1", 1, Instant.parse("2026-03-01T00:00:00Z")));

        FinalizationOutcome outcome = service.finalizeResult(baseCommand(
                DocumentStatus.PROCESSED, PriorityLevel.URGENT, TriageEventType.INITIAL_TRIAGE, null));

        assertEquals(FinalizationOutcome.Kind.CONFIRMED, outcome.kind());
        assertEquals(StorageState.SUCCESS, outcome.storageState());
        assertTrue(outcome.storageArtifactConfirmed());
        assertEquals(1, outcome.sequence());

        InOrder inOrder = inOrder(storageService, persistenceService);
        inOrder.verify(storageService).copyWithinBucket(
                "recibidos/DOC-1/original.pdf",
                "procesados/urgentes/DOC-1/original.pdf");
        inOrder.verify(storageService).putJson(
                eq("procesados/urgentes/DOC-1/triage.json"), anyString());
        inOrder.verify(persistenceService).commitFinalization(anyString(), any(), any(), any(), any(), any(), anyInt());
        inOrder.verify(storageService).deleteObject("recibidos/DOC-1/original.pdf");
        inOrder.verify(storageService).deleteObject("recibidos/DOC-1/triage.json");
    }

    @Test
    void finalizeResultWithoutPrefixChangeKeepsOriginalAndOverwritesTriage() {
        DocumentRecord document = baseDocument("auditoria_humana/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(2);
        when(storageService.getObject("auditoria_humana/DOC-1/triage.json"))
                .thenReturn("{\"sequence\":1}".getBytes());
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenReturn(historyEntry("DOC-1", 2, Instant.now()));

        service.finalizeResult(baseCommand(
                DocumentStatus.REJECTED, null, TriageEventType.HUMAN_REVIEW, HumanDecision.REJECT));

        verify(storageService, never()).copyWithinBucket(anyString(), anyString());
        verify(storageService, never()).deleteObject(anyString());
        verify(storageService).putJson(eq("auditoria_humana/DOC-1/triage.json"), anyString());
    }

    @Test
    void ociFailureWithPrefixChangeDeletesDestinationAndSkipsPgForHumanReview() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        doThrow(new ObjectStorageService.StorageOperationException("copy fail", new RuntimeException()))
                .when(storageService).copyWithinBucket(anyString(), anyString());

        assertThrows(ObjectStorageService.StorageOperationException.class,
                () -> service.finalizeResult(baseCommand(
                        DocumentStatus.REJECTED, null, TriageEventType.HUMAN_REVIEW, HumanDecision.REJECT)));

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
                .thenReturn("PREVIOUS_JSON".getBytes())
                .thenThrow(new ObjectStorageService.StorageOperationException("write not a get", new RuntimeException()));
        doThrow(new ObjectStorageService.StorageOperationException("write fail", new RuntimeException()))
                .when(storageService).putJson(eq("auditoria_humana/DOC-1/triage.json"), anyString());

        assertThrows(ObjectStorageService.StorageOperationException.class,
                () -> service.finalizeResult(baseCommand(
                        DocumentStatus.REJECTED, null, TriageEventType.HUMAN_REVIEW, HumanDecision.REJECT)));

        verify(storageService).putJson("auditoria_humana/DOC-1/triage.json", "PREVIOUS_JSON");
    }

    @Test
    void previousArtifactReadFailureAbortsOverwrite() {
        DocumentRecord document = baseDocument("auditoria_humana/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(2);
        when(storageService.getObject("auditoria_humana/DOC-1/triage.json"))
                .thenThrow(new ObjectStorageService.StorageOperationException("permission", new RuntimeException()));

        assertThrows(ObjectStorageService.StorageOperationException.class,
                () -> service.finalizeResult(baseCommand(
                        DocumentStatus.REJECTED, null, TriageEventType.HUMAN_REVIEW, HumanDecision.REJECT)));

        verify(storageService, never()).putJson(anyString(), anyString());
        verify(persistenceService, never()).commitFinalization(anyString(), any(), any(), any(), any(), any(), anyInt());
    }

    @Test
    void previousArtifactMissingIsNotTreatedAsReadFailure() {
        DocumentRecord document = baseDocument("auditoria_humana/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(2);
        when(storageService.getObject("auditoria_humana/DOC-1/triage.json"))
                .thenThrow(new ObjectStorageService.ObjectNotFoundException("missing", new RuntimeException()));
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenReturn(historyEntry("DOC-1", 2, Instant.now()));

        service.finalizeResult(baseCommand(
                DocumentStatus.REJECTED, null, TriageEventType.HUMAN_REVIEW, HumanDecision.REJECT));

        verify(storageService).putJson(eq("auditoria_humana/DOC-1/triage.json"), anyString());
    }

    @Test
    void pgFailureWithSafeInspectionDeletesDestinationObjects() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenThrow(new RuntimeException("db down"));
        when(persistenceService.inspectDurableCommit("DOC-1", 1))
                .thenReturn(DurableCommitInspection.NOT_COMMITTED);

        assertThrows(RuntimeException.class, () -> service.finalizeResult(baseCommand(
                DocumentStatus.PROCESSED, PriorityLevel.URGENT, TriageEventType.INITIAL_TRIAGE, null)));

        verify(persistenceService).inspectDurableCommit("DOC-1", 1);
        verify(storageService).deleteObject("procesados/urgentes/DOC-1/original.pdf");
        verify(storageService).deleteObject("procesados/urgentes/DOC-1/triage.json");
    }

    @Test
    void pgFailureWithNewerResultDoesNotTouchOci() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenThrow(new RuntimeException("db down"));
        when(persistenceService.inspectDurableCommit("DOC-1", 1))
                .thenReturn(DurableCommitInspection.NEWER_CONFIRMED);

        assertThrows(RuntimeException.class, () -> service.finalizeResult(baseCommand(
                DocumentStatus.PROCESSED, PriorityLevel.URGENT, TriageEventType.INITIAL_TRIAGE, null)));

        verify(storageService, never()).deleteObject(anyString());
    }

    @Test
    void uncertainCommitThatActuallySucceededReturnsConfirmedOutcome() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenThrow(new RuntimeException("timeout after commit"));
        when(persistenceService.inspectDurableCommit("DOC-1", 1))
                .thenReturn(DurableCommitInspection.THIS_ATTEMPT_COMMITTED);

        FinalizationOutcome outcome = service.finalizeResult(baseCommand(
                DocumentStatus.PROCESSED, PriorityLevel.URGENT, TriageEventType.INITIAL_TRIAGE, null));

        assertEquals(FinalizationOutcome.Kind.CONFIRMED, outcome.kind());
        verify(storageService, never()).deleteObject("procesados/urgentes/DOC-1/original.pdf");
        verify(storageService, never()).deleteObject("procesados/urgentes/DOC-1/triage.json");
    }

    @Test
    void indeterminateCommitDoesNotCompensate() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenThrow(new RuntimeException("db down"));
        when(persistenceService.inspectDurableCommit("DOC-1", 1))
                .thenThrow(new RuntimeException("still down"));

        assertThrows(RuntimeException.class, () -> service.finalizeResult(baseCommand(
                DocumentStatus.PROCESSED, PriorityLevel.URGENT, TriageEventType.INITIAL_TRIAGE, null)));

        verify(storageService, never()).deleteObject(anyString());
    }

    @Test
    void restoreFailureMarksStorageError() {
        DocumentRecord document = baseDocument("auditoria_humana/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(2);
        when(storageService.getObject("auditoria_humana/DOC-1/triage.json"))
                .thenReturn("PREVIOUS_JSON".getBytes());
        doThrow(new ObjectStorageService.StorageOperationException("write fail", new RuntimeException()))
                .when(storageService).putJson(anyString(), anyString());

        assertThrows(ObjectStorageService.StorageOperationException.class,
                () -> service.finalizeResult(baseCommand(
                        DocumentStatus.REJECTED, null, TriageEventType.HUMAN_REVIEW, HumanDecision.REJECT)));

        verify(persistenceService).markStorageErrorPreservingResult("DOC-1");
    }

    @Test
    void postCommitCleanupFailureDoesNotInvalidateConfirmedResult() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenReturn(historyEntry("DOC-1", 1, Instant.now()));
        doThrow(new ObjectStorageService.StorageOperationException("cleanup", new RuntimeException()))
                .when(storageService).deleteObject(anyString());

        FinalizationOutcome outcome = service.finalizeResult(baseCommand(
                DocumentStatus.PROCESSED, PriorityLevel.URGENT, TriageEventType.INITIAL_TRIAGE, null));

        assertEquals(FinalizationOutcome.Kind.CONFIRMED, outcome.kind());
        assertEquals(StorageState.SUCCESS, outcome.storageState());
    }

    @Test
    void initialTriageOciFailurePersistsNeedsAuditFallbackWithoutReportingSuccess() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        doThrow(new ObjectStorageService.StorageOperationException("copy fail", new RuntimeException()))
                .when(storageService).copyWithinBucket(anyString(), anyString());
        when(storageService.getObject("recibidos/DOC-1/original.pdf")).thenReturn("pdf".getBytes());
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenReturn(historyEntry("DOC-1", 1, Instant.now()));

        FinalizationOutcome outcome = service.finalizeResult(baseCommand(
                DocumentStatus.PROCESSED, PriorityLevel.URGENT, TriageEventType.INITIAL_TRIAGE, null));

        assertEquals(FinalizationOutcome.Kind.FALLBACK_DURABLE, outcome.kind());
        assertEquals(DocumentStatus.NEEDS_AUDIT, outcome.status());
        assertEquals(StorageState.ERROR, outcome.storageState());
        assertTrue(outcome.persistenceConfirmed());
        assertFalse(outcome.storageArtifactConfirmed() && outcome.kind() == FinalizationOutcome.Kind.CONFIRMED);

        ArgumentCaptor<FinalizedDocumentState> stateCaptor = ArgumentCaptor.forClass(FinalizedDocumentState.class);
        verify(persistenceService).commitFinalization(
                eq("DOC-1"), stateCaptor.capture(), eq(TriageEventType.INITIAL_TRIAGE),
                eq(null), any(), any(Instant.class), eq(1));

        FinalizedDocumentState persisted = stateCaptor.getValue();
        assertEquals(DocumentStatus.NEEDS_AUDIT, persisted.status());
        assertEquals(StorageState.ERROR, persisted.storageState());
        assertEquals(PrimaryDestination.HUMAN_REVIEW, persisted.routingDestination());
        assertEquals("recibidos/DOC-1/original.pdf", persisted.objectKey());
        assertTrue(persisted.routingJustification().contains("Fallo de almacenamiento OCI"));
        assertEquals(List.of(AuditReason.LOW_CONFIDENCE), persisted.auditReasons());
    }

    @Test
    void fallbackPersistenceFailureDoesNotClaimDurableTransition() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        doThrow(new ObjectStorageService.StorageOperationException("copy fail", new RuntimeException()))
                .when(storageService).copyWithinBucket(anyString(), anyString());
        when(storageService.getObject("recibidos/DOC-1/original.pdf")).thenReturn("pdf".getBytes());
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenThrow(new RuntimeException("pg down"));

        assertThrows(RuntimeException.class, () -> service.finalizeResult(baseCommand(
                DocumentStatus.PROCESSED, PriorityLevel.URGENT, TriageEventType.INITIAL_TRIAGE, null)));
    }

    @Test
    void unrecoverableOriginalRegistersFailed() {
        DocumentRecord document = baseDocument("recibidos/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(1);
        doThrow(new ObjectStorageService.StorageOperationException("copy fail", new RuntimeException()))
                .when(storageService).copyWithinBucket(anyString(), anyString());
        when(storageService.getObject("recibidos/DOC-1/original.pdf"))
                .thenThrow(new ObjectStorageService.ObjectNotFoundException("gone", new RuntimeException()));
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenReturn(historyEntry("DOC-1", 1, Instant.now()));

        FinalizationOutcome outcome = service.finalizeResult(baseCommand(
                DocumentStatus.PROCESSED, PriorityLevel.URGENT, TriageEventType.INITIAL_TRIAGE, null));

        assertEquals(FinalizationOutcome.Kind.FAILED_UNRECOVERABLE, outcome.kind());
        assertEquals(DocumentStatus.FAILED, outcome.status());
        assertEquals(StorageState.ERROR, outcome.storageState());
    }

    @Test
    void humanReviewTriageArtifactIncludesHumanReviewDecision() {
        DocumentRecord document = baseDocument("auditoria_humana/DOC-1/original.pdf");
        when(persistenceService.getDocument("DOC-1")).thenReturn(document);
        when(persistenceService.nextSequenceFor("DOC-1")).thenReturn(2);
        when(storageService.getObject("auditoria_humana/DOC-1/triage.json"))
                .thenReturn("{\"sequence\":1}".getBytes());
        when(persistenceService.commitFinalization(
                anyString(), any(FinalizedDocumentState.class), any(TriageEventType.class),
                any(), any(), any(Instant.class), anyInt()))
                .thenReturn(historyEntry("DOC-1", 2, Instant.now()));

        service.finalizeResult(baseCommand(
                DocumentStatus.REJECTED, null, TriageEventType.HUMAN_REVIEW, HumanDecision.REJECT));

        ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
        verify(storageService).putJson(eq("auditoria_humana/DOC-1/triage.json"), jsonCaptor.capture());

        @SuppressWarnings("unchecked")
        Map<String, Object> artifact = jsonMapper.readValue(jsonCaptor.getValue(), Map.class);
        assertEquals(2, artifact.get("sequence"));
        assertNotNull(artifact.get("created_at"));
        assertNotNull(artifact.get("updated_at"));
        assertFalse(artifact.containsKey("bucket"));
        assertFalse(artifact.containsKey("object_key"));
        @SuppressWarnings("unchecked")
        Map<String, Object> storage = (Map<String, Object>) artifact.get("storage");
        assertEquals("SUCCESS", storage.get("state"));
        assertFalse(storage.containsKey("bucket"));
        @SuppressWarnings("unchecked")
        Map<String, Object> humanReview = (Map<String, Object>) artifact.get("human_review");
        assertEquals("REJECT", humanReview.get("decision"));
    }

    private DocumentRecord baseDocument(String objectKey) {
        DocumentRecord document = new DocumentRecord();
        document.setId("DOC-1");
        document.setStatus(DocumentStatus.RECEIVED);
        document.setObjectKey(objectKey);
        document.setBucket("mediflow-bucket");
        document.setMimeType("application/pdf");
        document.setFileName("document.pdf");
        document.setInputType(com.mediflow.backend.enums.InputType.FILE);
        document.setStorageState(StorageState.PENDING);
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
