package com.mediflow.backend.service;

import com.mediflow.backend.config.JacksonConfig;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.entity.DocumentTriageHistory;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.HumanDecision;
import com.mediflow.backend.enums.InputType;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import com.mediflow.backend.enums.StorageState;
import com.mediflow.backend.enums.TriageEventType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocumentFinalizationConsistencyTest {

    private FakeDocumentPersistenceService persistence;
    private InMemoryObjectStorageService storage;
    private JsonMapper jsonMapper;
    private DocumentFinalizationService service;

    @BeforeEach
    void setUp() {
        persistence = new FakeDocumentPersistenceService();
        storage = new InMemoryObjectStorageService();
        jsonMapper = JacksonConfig.createJsonMapper();
        service = new DocumentFinalizationService(
                persistence,
                storage,
                new ObjectKeyGenerator(),
                new DocumentResponseMapper(jsonMapper),
                jsonMapper,
                new ReentrantDocumentExclusiveLock()
        );
    }

    @Test
    void copySucceedsAndTriageWriteFailureLeavesRecoverableOriginal() {
        seedReceived("DOC-COPY-FAIL");
        storage.failPutsMatching(key -> key.endsWith("triage.json") && key.contains("procesados"));

        FinalizationOutcome outcome = service.finalizeResult(processedCommand("DOC-COPY-FAIL", PriorityLevel.URGENT));

        assertEquals(FinalizationOutcome.Kind.FALLBACK_DURABLE, outcome.kind());
        assertEquals(StorageState.ERROR, persistence.stored("DOC-COPY-FAIL").getStorageState());
        assertEquals("recibidos/DOC-COPY-FAIL/original.pdf", persistence.stored("DOC-COPY-FAIL").getObjectKey());
        assertTrue(storage.contains("recibidos/DOC-COPY-FAIL/original.pdf"));
        assertFalse(storage.contains("procesados/urgentes/DOC-COPY-FAIL/original.pdf"));
        assertEquals(DocumentStatus.NEEDS_AUDIT.name(), persistence.historyOf("DOC-COPY-FAIL").getFirst().getResult().get("status"));
    }

    @Test
    void postgresFailureAfterOciPrepareRemovesUnconfirmedDestination() {
        seedReceived("DOC-PG-FAIL");
        persistence.failNextCommit();

        assertThrows(RuntimeException.class,
                () -> service.finalizeResult(processedCommand("DOC-PG-FAIL", PriorityLevel.URGENT)));

        assertEquals(DocumentStatus.RECEIVED, persistence.stored("DOC-PG-FAIL").getStatus());
        assertEquals("recibidos/DOC-PG-FAIL/original.pdf", persistence.stored("DOC-PG-FAIL").getObjectKey());
        assertTrue(storage.contains("recibidos/DOC-PG-FAIL/original.pdf"));
        assertFalse(storage.contains("procesados/urgentes/DOC-PG-FAIL/original.pdf"));
        assertFalse(storage.contains("procesados/urgentes/DOC-PG-FAIL/triage.json"));
        assertTrue(persistence.historyOf("DOC-PG-FAIL").isEmpty());
    }

    @Test
    void staleCompensationDoesNotDestroyNewerConfirmedResult() throws Exception {
        seedReceived("DOC-RACE");
        CountDownLatch prepared = new CountDownLatch(1);
        CountDownLatch newerDone = new CountDownLatch(1);

        persistence.failNextCommit();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Boolean> stale = pool.submit(() -> {
                try {
                    service.finalizeResult(processedCommand("DOC-RACE", PriorityLevel.URGENT));
                    return false;
                } catch (RuntimeException expected) {
                    return true;
                } finally {
                    prepared.countDown();
                }
            });

            Future<FinalizationOutcome> newer = pool.submit(() -> {
                assertTrue(prepared.await(5, TimeUnit.SECONDS));
                FinalizationOutcome outcome = service.finalizeResult(processedCommand("DOC-RACE", PriorityLevel.ROUTINE));
                newerDone.countDown();
                return outcome;
            });

            assertTrue(stale.get(10, TimeUnit.SECONDS));
            FinalizationOutcome confirmed = newer.get(10, TimeUnit.SECONDS);
            assertTrue(newerDone.await(5, TimeUnit.SECONDS));

            assertEquals(FinalizationOutcome.Kind.CONFIRMED, confirmed.kind());
            assertEquals(DocumentStatus.PROCESSED, persistence.stored("DOC-RACE").getStatus());
            assertEquals(PriorityLevel.ROUTINE, persistence.stored("DOC-RACE").getPriority());
            assertEquals("procesados/rutina/DOC-RACE/original.pdf", persistence.stored("DOC-RACE").getObjectKey());
            assertTrue(storage.contains("procesados/rutina/DOC-RACE/triage.json"));
            assertTrue(storage.contains("procesados/rutina/DOC-RACE/original.pdf"));
            String triage = storage.readUtf8("procesados/rutina/DOC-RACE/triage.json");
            assertTrue(triage.contains("\"sequence\":1") || triage.contains("\"sequence\": 1"));
            assertEquals(1, persistence.historyOf("DOC-RACE").size());
            assertEquals(persistence.stored("DOC-RACE").getUpdatedAt(),
                    persistence.historyOf("DOC-RACE").getFirst().getOccurredAt());
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void uncertainClientErrorAfterDurableCommitDoesNotCompensate() {
        seedReceived("DOC-UNCERTAIN");
        persistence.throwAfterSuccessfulCommit();

        FinalizationOutcome outcome = service.finalizeResult(processedCommand("DOC-UNCERTAIN", PriorityLevel.URGENT));

        assertEquals(FinalizationOutcome.Kind.CONFIRMED, outcome.kind());
        assertTrue(storage.contains("procesados/urgentes/DOC-UNCERTAIN/triage.json"));
        assertEquals(1, persistence.historyOf("DOC-UNCERTAIN").size());
        assertFalse(storage.deletedKeys().contains("procesados/urgentes/DOC-UNCERTAIN/triage.json"));
    }

    @Test
    void restoreFailureLeavesPreviousConfirmedPostgresStateAndMarksStorageError() {
        DocumentRecord document = sample("DOC-RESTORE", DocumentStatus.NEEDS_AUDIT, "auditoria_humana/DOC-RESTORE/original.pdf");
        persistence.seed(document);
        storage.seed("auditoria_humana/DOC-RESTORE/original.pdf", "pdf");
        storage.seed("auditoria_humana/DOC-RESTORE/triage.json", "{\"sequence\":1}");
        storage.failPutsMatching(key -> key.endsWith("triage.json"));

        assertThrows(ObjectStorageService.StorageOperationException.class,
                () -> service.finalizeResult(rejectedCommand("DOC-RESTORE")));

        assertEquals(DocumentStatus.NEEDS_AUDIT, persistence.stored("DOC-RESTORE").getStatus());
        assertEquals(StorageState.ERROR, persistence.stored("DOC-RESTORE").getStorageState());
        assertEquals("{\"sequence\":1}", storage.readUtf8("auditoria_humana/DOC-RESTORE/triage.json"));
    }

    @Test
    void postCommitDeleteFailureKeepsConfirmedDestination() {
        seedReceived("DOC-CLEAN");
        storage.failDeletesMatching(key -> key.startsWith("recibidos/"));

        FinalizationOutcome outcome = service.finalizeResult(processedCommand("DOC-CLEAN", PriorityLevel.URGENT));

        assertEquals(FinalizationOutcome.Kind.CONFIRMED, outcome.kind());
        assertTrue(storage.contains("procesados/urgentes/DOC-CLEAN/original.pdf"));
        assertTrue(storage.contains("procesados/urgentes/DOC-CLEAN/triage.json"));
        assertEquals("procesados/urgentes/DOC-CLEAN/original.pdf", persistence.stored("DOC-CLEAN").getObjectKey());
        assertEquals(StorageState.SUCCESS, persistence.stored("DOC-CLEAN").getStorageState());
    }

    @Test
    void concurrentFinalizationsDoNotOverlapOciWritesAndLeaveMatchingArtifact() throws Exception {
        seedReceived("DOC-CONC");
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<FinalizationOutcome> first = pool.submit(
                    () -> service.finalizeResult(processedCommand("DOC-CONC", PriorityLevel.URGENT)));
            Future<FinalizationOutcome> second = pool.submit(
                    () -> service.finalizeResult(needsAuditCommand("DOC-CONC")));

            FinalizationOutcome a = first.get(10, TimeUnit.SECONDS);
            FinalizationOutcome b = second.get(10, TimeUnit.SECONDS);
            assertEquals(FinalizationOutcome.Kind.CONFIRMED, a.kind());
            assertEquals(FinalizationOutcome.Kind.CONFIRMED, b.kind());
            assertEquals(1, storage.maxConcurrentPuts());

            DocumentRecord stored = persistence.stored("DOC-CONC");
            List<DocumentTriageHistory> entries = persistence.historyOf("DOC-CONC");
            assertEquals(2, entries.size());
            assertEquals(stored.getUpdatedAt(), entries.get(1).getOccurredAt());
            assertEquals(stored.getStatus().name(), entries.get(1).getResult().get("status"));

            String currentTriage = storage.contains("procesados/urgentes/DOC-CONC/triage.json")
                    ? storage.readUtf8("procesados/urgentes/DOC-CONC/triage.json")
                    : storage.readUtf8("auditoria_humana/DOC-CONC/triage.json");
            assertNotNull(currentTriage);
            assertTrue(currentTriage.contains("\"sequence\":2") || currentTriage.contains("\"sequence\": 2"));
            assertEquals(stored.getObjectKey().replaceAll("original\\.[a-z]+$", "triage.json").replace('\\', '/'),
                    deriveTriage(stored.getObjectKey()));
            assertTrue(storage.contains(stored.getObjectKey()));
            assertTrue(storage.contains(deriveTriage(stored.getObjectKey())));
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void originalRecoverableButArtifactMissingIsDistinguishedFromAccessFailure() {
        seedReceived("DOC-MISS");
        storage.missingGetsMatching(key -> key.endsWith("triage.json"));

        FinalizationOutcome outcome = service.finalizeResult(processedCommand("DOC-MISS", PriorityLevel.URGENT));
        assertEquals(FinalizationOutcome.Kind.CONFIRMED, outcome.kind());
        assertTrue(storage.contains("procesados/urgentes/DOC-MISS/triage.json"));
    }

    @Test
    void artifactReadAccessFailureDoesNotOverwrite() {
        DocumentRecord document = sample("DOC-PERM", DocumentStatus.NEEDS_AUDIT, "auditoria_humana/DOC-PERM/original.pdf");
        persistence.seed(document);
        storage.seed("auditoria_humana/DOC-PERM/original.pdf", "pdf");
        storage.seed("auditoria_humana/DOC-PERM/triage.json", "OLD");
        storage.failGetsMatching(key -> key.endsWith("triage.json"));

        assertThrows(ObjectStorageService.StorageOperationException.class,
                () -> service.finalizeResult(rejectedCommand("DOC-PERM")));

        assertEquals("OLD", storage.readUtf8("auditoria_humana/DOC-PERM/triage.json"));
        assertEquals(DocumentStatus.NEEDS_AUDIT, persistence.stored("DOC-PERM").getStatus());
        assertTrue(persistence.historyOf("DOC-PERM").isEmpty());
    }

    @Test
    void fallbackDurableDoesNotExposeInfrastructureKeysInSnapshot() {
        seedReceived("DOC-FB");
        storage.failPutsMatching(key -> key.contains("procesados") && key.endsWith("triage.json"));

        FinalizationOutcome outcome = service.finalizeResult(processedCommand("DOC-FB", PriorityLevel.URGENT));
        assertEquals(FinalizationOutcome.Kind.FALLBACK_DURABLE, outcome.kind());
        Map<String, Object> snapshot = persistence.historyOf("DOC-FB").getFirst().getResult();
        assertFalse(snapshot.containsKey("bucket"));
        assertFalse(snapshot.containsKey("object_key"));
        assertFalse(snapshot.containsKey("namespace"));
        @SuppressWarnings("unchecked")
        Map<String, Object> storageBlock = (Map<String, Object>) snapshot.get("storage");
        assertEquals("ERROR", storageBlock.get("state"));
        assertEquals("OCI_OBJECT_STORAGE", storageBlock.get("provider"));
        assertNull(storageBlock.get("bucket"));
    }

    @Test
    void confirmedStateAndHistoryRepresentTheSameResult() {
        seedReceived("DOC-MATCH");
        service.finalizeResult(processedCommand("DOC-MATCH", PriorityLevel.URGENT));

        DocumentRecord stored = persistence.stored("DOC-MATCH");
        DocumentTriageHistory entry = persistence.historyOf("DOC-MATCH").getFirst();
        assertEquals(stored.getUpdatedAt(), entry.getOccurredAt());
        assertEquals(stored.getStatus().name(), entry.getResult().get("status"));
        assertEquals(StorageState.SUCCESS, stored.getStorageState());
        String triage = storage.readUtf8("procesados/urgentes/DOC-MATCH/triage.json");
        assertTrue(triage.contains("\"status\":\"PROCESSED\"") || triage.contains("\"status\": \"PROCESSED\""));
        assertTrue(storage.contains(stored.getObjectKey()));
        assertTrue(storage.contains(deriveTriage(stored.getObjectKey())));
        assertFalse(storage.deletedKeys().contains("procesados/urgentes/DOC-MATCH/original.pdf"));
        assertTrue(storage.deletedKeys().contains("recibidos/DOC-MATCH/original.pdf"));
    }

    private void seedReceived(String id) {
        persistence.seed(sample(id, DocumentStatus.RECEIVED, "recibidos/" + id + "/original.pdf"));
        storage.seed("recibidos/" + id + "/original.pdf", "pdf-bytes");
    }

    private static String deriveTriage(String objectKey) {
        return objectKey.substring(0, objectKey.lastIndexOf('/') + 1) + "triage.json";
    }

    private static DocumentRecord sample(String id, DocumentStatus status, String objectKey) {
        DocumentRecord document = new DocumentRecord();
        document.setId(id);
        document.setStatus(status);
        document.setInputType(InputType.FILE);
        document.setMimeType("application/pdf");
        document.setFileName("doc.pdf");
        document.setBucket("mediflow-documentos-clinicos");
        document.setObjectKey(objectKey);
        document.setStorageState(StorageState.PENDING);
        document.setRoutingDestination(PrimaryDestination.HUMAN_REVIEW);
        document.setRoutingJustification("Procesamiento pendiente");
        document.setNotification(DocumentRecord.defaultNotification());
        document.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        document.setUpdatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        return document;
    }

    private static FinalizationCommand processedCommand(String id, PriorityLevel priority) {
        return new FinalizationCommand(
                id, DocumentStatus.PROCESSED, DocumentType.DISCHARGE_SUMMARY, "medicina_general",
                priority, 0.9, 0.9, 0.9, PrimaryDestination.MEDICAL_RECORD, "ok",
                List.of(AuditReason.LOW_CONFIDENCE), null, null,
                DocumentRecord.defaultNotification(), TriageEventType.INITIAL_TRIAGE, null);
    }

    private static FinalizationCommand needsAuditCommand(String id) {
        return new FinalizationCommand(
                id, DocumentStatus.NEEDS_AUDIT, DocumentType.DISCHARGE_SUMMARY, "medicina_general",
                PriorityLevel.ROUTINE, 0.4, 0.4, 0.4, PrimaryDestination.HUMAN_REVIEW, "audit",
                List.of(AuditReason.LOW_CONFIDENCE), null, null,
                DocumentRecord.defaultNotification(), TriageEventType.INITIAL_TRIAGE, null);
    }

    private static FinalizationCommand rejectedCommand(String id) {
        return new FinalizationCommand(
                id, DocumentStatus.REJECTED, DocumentType.DISCHARGE_SUMMARY, "medicina_general",
                null, 0.4, 0.4, 0.4, PrimaryDestination.HUMAN_REVIEW, "reject",
                List.of(AuditReason.LOW_CONFIDENCE), null, null,
                DocumentRecord.defaultNotification(), TriageEventType.HUMAN_REVIEW, HumanDecision.REJECT);
    }
}
