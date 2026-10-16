package com.mediflow.backend.service;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.entity.DocumentTriageHistory;
import com.mediflow.backend.enums.*;
import com.mediflow.backend.persistence.DocumentPersistenceService;
import com.mediflow.backend.persistence.DurableCommitInspection;
import com.mediflow.backend.persistence.FinalizedDocumentState;
import com.oracle.bmc.auth.BasicAuthenticationDetailsProvider;
import com.oracle.bmc.objectstorage.ObjectStorageClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.json.JsonMapper;

import javax.sql.DataSource;
import java.sql.DriverManager;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.verifyNoInteractions;

/** Real PostgreSQL transactions/locks; external clients are isolated. No test transaction wraps the service. */
@Testcontainers
@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create",
        "spring.datasource.hikari.maximum-pool-size=2",
        "spring.datasource.hikari.connection-timeout=1000"
})
class DocumentFinalizationPostgresIT {
    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @MockitoBean BasicAuthenticationDetailsProvider authenticationDetailsProvider;
    @MockitoBean ObjectStorageClient objectStorageClient;
    @MockitoBean AiCoreClient aiCoreClient;
    @Autowired DocumentPersistenceService persistence;
    @Autowired DocumentExclusiveLock lock;
    @Autowired DataSource dataSource;
    @Autowired JdbcTemplate jdbc;
    @Autowired JsonMapper json;
    @Autowired DocumentResponseMapper mapper;
    @Autowired DocumentFinalizationService springFinalizer;
    @Autowired PlatformTransactionManager transactionManager;

    InMemoryObjectStorageService storage;
    DocumentFinalizationService service;
    String id;

    @BeforeEach
    void setUp() {
        id = "IT-" + UUID.randomUUID();
        storage = new InMemoryObjectStorageService();
        service = service(persistence, storage);
        DocumentRecord document = new DocumentRecord();
        document.setId(id);
        document.setStatus(DocumentStatus.RECEIVED);
        document.setInputType(InputType.FILE);
        document.setMimeType("application/pdf");
        document.setObjectKey("recibidos/" + id + "/original.pdf");
        document.setBucket("test-bucket");
        document.setStorageState(StorageState.PENDING);
        document.setRoutingDestination(PrimaryDestination.HUMAN_REVIEW);
        document.setRoutingJustification("Procesamiento pendiente");
        document.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        document.setUpdatedAt(document.getCreatedAt());
        persistence.saveDocument(document);
        storage.seed(document.getObjectKey(), "original-bytes");
    }

    @Test
    void springBeanRejectsExternalTransactionBeforeAnyStorageOrConfirmation() {
        FinalizationCommand result = command(DocumentStatus.PROCESSED, PriorityLevel.URGENT);
        DocumentRecord before = persistence.getDocument(id);
        new TransactionTemplate(transactionManager).executeWithoutResult(transaction -> {
            assertThrows(IllegalTransactionStateException.class, () -> springFinalizer.finalizeResult(result));
            assertTrue(persistence.listHistory(id).isEmpty());
            transaction.setRollbackOnly();
        });
        verifyNoInteractions(objectStorageClient);
        DocumentRecord after = persistence.getDocument(id);
        assertEquals(before.getStatus(), after.getStatus());
        assertEquals(before.getObjectKey(), after.getObjectKey());
        assertEquals(before.getUpdatedAt(), after.getUpdatedAt());
        assertTrue(persistence.listHistory(id).isEmpty());
        assertTrue(storage.putKeys().isEmpty());
        assertTrue(storage.deletedKeys().isEmpty());
    }

    @Test
    void concurrentHumanDecisionsFromSameVersionConfirmOnlyOne() throws Exception {
        service.finalizeResult(command(DocumentStatus.NEEDS_AUDIT, PriorityLevel.ROUTINE));
        FinalizationCommand approve = command(DocumentStatus.APPROVED, PriorityLevel.ROUTINE);
        FinalizationCommand reject = command(DocumentStatus.REJECTED, PriorityLevel.ROUTINE);
        int writesBefore = storage.putKeys().size();
        int deletesBefore = storage.deletedKeys().size();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            Callable<Object> approval = () -> humanDecision(start, approve);
            Callable<Object> rejection = () -> humanDecision(start, reject);
            Future<Object> a = workers.submit(approval);
            Future<Object> b = workers.submit(rejection);
            start.countDown();
            List<Object> outcomes = List.of(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS));
            assertEquals(1, outcomes.stream().filter(FinalizationOutcome.class::isInstance).count());
            assertEquals(1, outcomes.stream().filter(DocumentPersistenceService.ReviewConflictException.class::isInstance).count());
            assertEquals(2, persistence.listHistory(id).size());
            assertEquals(TriageEventType.HUMAN_REVIEW, persistence.listHistory(id).getLast().getEventType());
            FinalizationOutcome winner = outcomes.stream().filter(FinalizationOutcome.class::isInstance)
                    .map(FinalizationOutcome.class::cast).findFirst().orElseThrow();
            boolean moved = winner.status() == DocumentStatus.APPROVED;
            assertEquals(writesBefore + (moved ? 2 : 1), storage.putKeys().size(), "only winner's copy and artifact");
            assertEquals(deletesBefore + (moved ? 2 : 0), storage.deletedKeys().size(), "loser must not compensate");
            assertCurrentMatchesArtifact();
        } finally { workers.shutdownNow(); }
    }

    private Object humanDecision(CountDownLatch start, FinalizationCommand decision) {
        await(start);
        try { return service.finalizeResult(decision); }
        catch (DocumentPersistenceService.ReviewConflictException conflict) {
            assertEquals(BackendErrorCode.INVALID_REVIEW_STATE, conflict.getErrorCode());
            return conflict;
        }
    }

    @ParameterizedTest
    @CsvSource({"PROCESSED,PROCESSED", "PROCESSED,NEEDS_AUDIT", "APPROVED,NEEDS_AUDIT", "REJECTED,PROCESSED", "FAILED,PROCESSED"})
    void initialTriageCannotOverwriteTerminalResult(DocumentStatus terminal, DocumentStatus repeated) {
        reachTerminal(terminal);
        DocumentRecord before = persistence.getDocument(id);
        assertEquals(terminal, before.getStatus());
        String artifact = storage.readUtf8(triageKey(before));
        int writes = storage.putKeys().size();
        int deletes = storage.deletedKeys().size();
        int history = persistence.listHistory(id).size();

        assertThrows(DocumentFinalizationService.InitialTriageConflictException.class,
                () -> service.finalizeResult(command(repeated, PriorityLevel.URGENT)));

        DocumentRecord after = persistence.getDocument(id);
        assertEquals(terminal, after.getStatus());
        assertEquals(before.getObjectKey(), after.getObjectKey());
        assertEquals(before.getStorageState(), after.getStorageState());
        assertEquals(before.getUpdatedAt(), after.getUpdatedAt());
        assertEquals(history, persistence.listHistory(id).size());
        assertEquals(writes, storage.putKeys().size());
        assertEquals(deletes, storage.deletedKeys().size());
        assertEquals(artifact, storage.readUtf8(triageKey(after)));
        assertTrue(storage.contains(after.getObjectKey()));
    }

    @Test
    void concurrentInitialTriagesConfirmOnlyOne() throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            Callable<Object> attempt = () -> {
                await(start);
                try { return service.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT)); }
                catch (DocumentFinalizationService.InitialTriageConflictException conflict) { return conflict; }
            };
            Future<Object> a = workers.submit(attempt);
            Future<Object> b = workers.submit(attempt);
            start.countDown();
            List<Object> outcomes = List.of(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS));
            assertEquals(1, outcomes.stream().filter(FinalizationOutcome.class::isInstance).count());
            assertEquals(1, outcomes.stream()
                    .filter(DocumentFinalizationService.InitialTriageConflictException.class::isInstance).count());
            assertEquals(1, persistence.listHistory(id).size());
            assertEquals(2, storage.putKeys().size(), "only the winner copies the original and writes the artifact");
            assertCurrentMatchesArtifact();
        } finally { workers.shutdownNow(); }
    }

    private void reachTerminal(DocumentStatus terminal) {
        switch (terminal) {
            case PROCESSED -> service.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT));
            case APPROVED, REJECTED -> {
                service.finalizeResult(command(DocumentStatus.NEEDS_AUDIT, PriorityLevel.ROUTINE));
                service.finalizeResult(command(terminal, PriorityLevel.ROUTINE));
            }
            case FAILED -> {
                storage.failPutsMatching(key -> key.startsWith("procesados/"));
                storage.missingGetsMatching(key -> key.endsWith("original.pdf"));
                service.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT));
                storage.failPutsMatching(key -> false);
                storage.missingGetsMatching(key -> false);
            }
            default -> throw new IllegalArgumentException(terminal.name());
        }
    }

    @Test
    void staleHumanVersionIsRejectedEvenWhenStatusRemainsNeedsAudit() {
        service.finalizeResult(command(DocumentStatus.NEEDS_AUDIT, PriorityLevel.ROUTINE));
        FinalizationCommand stale = command(DocumentStatus.APPROVED, PriorityLevel.ROUTINE);
        service.finalizeResult(command(DocumentStatus.NEEDS_AUDIT, PriorityLevel.ROUTINE));
        DocumentRecord before = persistence.getDocument(id);
        String artifact = storage.readUtf8(triageKey(before));
        int writes = storage.putKeys().size();
        int deletes = storage.deletedKeys().size();
        assertThrows(DocumentPersistenceService.ReviewConflictException.class, () -> service.finalizeResult(stale));
        assertEquals(writes, storage.putKeys().size());
        assertEquals(deletes, storage.deletedKeys().size());
        assertEquals(2, persistence.listHistory(id).size());
        assertEquals(before.getUpdatedAt(), persistence.getDocument(id).getUpdatedAt());
        assertEquals(artifact, storage.readUtf8(triageKey(before)));
        assertCurrentMatchesArtifact();
    }

    @ParameterizedTest
    @CsvSource({"false", "true"})
    void uncertainHumanCommitPreservesConfirmedDecision(boolean inspectionUnavailable) {
        service.finalizeResult(command(DocumentStatus.NEEDS_AUDIT, PriorityLevel.ROUTINE));
        FaultingPersistence faults = new FaultingPersistence();
        faults.throwAfterCommit = true;
        faults.inspectionUnavailable = inspectionUnavailable;
        service = service(faults, storage);
        String supersededOriginal = persistence.getDocument(id).getObjectKey();
        String supersededArtifact = triageKey(persistence.getDocument(id));
        int deletesBefore = storage.deletedKeys().size();
        if (inspectionUnavailable) {
            IllegalStateException failure = assertThrows(IllegalStateException.class,
                    () -> service.finalizeResult(command(DocumentStatus.APPROVED, PriorityLevel.URGENT)));
            assertEquals("client error after real commit", failure.getMessage());
        } else {
            assertEquals(FinalizationOutcome.Kind.CONFIRMED,
                    service.finalizeResult(command(DocumentStatus.APPROVED, PriorityLevel.URGENT)).kind());
        }
        assertEquals(DocumentStatus.APPROVED, persistence.getDocument(id).getStatus());
        assertEquals(2, persistence.listHistory(id).size());
        assertEquals(HumanDecision.APPROVE, persistence.listHistory(id).getLast().getDecision());
        assertTrue(storage.contains(persistence.getDocument(id).getObjectKey()));
        assertFalse(storage.deletedKeys().contains(triageKey(persistence.getDocument(id))));
        assertCurrentMatchesArtifact();
        if (inspectionUnavailable) {
            assertEquals(deletesBefore, storage.deletedKeys().size(), "unverified commit must stay non-destructive");
            assertTrue(storage.contains(supersededOriginal));
            assertTrue(storage.contains(supersededArtifact));
        } else {
            assertFalse(storage.contains(supersededOriginal));
            assertFalse(storage.contains(supersededArtifact));
        }
    }

    @Test
    void humanReviewRetainsRowLockDuringStorageAndRollsBackBeforeCompensation() {
        service.finalizeResult(command(DocumentStatus.NEEDS_AUDIT, PriorityLevel.ROUTINE));
        DocumentRecord before = persistence.getDocument(id);
        String previousArtifact = storage.readUtf8(triageKey(before));
        AtomicInteger checks = new AtomicInteger();
        InMemoryObjectStorageService checked = new InMemoryObjectStorageService() {
            @Override public void putJson(String key, String value) {
                try (var observer = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
                     var sql = observer.createStatement()) {
                    sql.execute("set lock_timeout = '200ms'");
                    var blocked = assertThrows(java.sql.SQLException.class,
                            () -> sql.executeQuery("select id from documents where id = '" + id + "' for update"));
                    assertEquals("55P03", blocked.getSQLState(), "row must remain locked during OCI preparation");
                    checks.incrementAndGet();
                } catch (java.sql.SQLException e) { throw new AssertionError(e); }
                super.putJson(key, value);
            }
        };
        checked.seed(before.getObjectKey(), "original-bytes");
        checked.seed(triageKey(before), previousArtifact);
        storage = checked;
        service = service(persistence, storage);
        rejectHistory();
        try {
            assertSqlFailure("23514", () -> service.finalizeResult(command(DocumentStatus.APPROVED, PriorityLevel.URGENT)));
            assertEquals(1, checks.get());
            assertEquals(DocumentStatus.NEEDS_AUDIT, persistence.getDocument(id).getStatus());
            assertEquals(before.getUpdatedAt(), persistence.getDocument(id).getUpdatedAt());
            assertEquals(1, persistence.listHistory(id).size());
            assertEquals(previousArtifact, storage.readUtf8(triageKey(before)));
            assertTrue(storage.contains(before.getObjectKey()));
            assertFalse(storage.contains("procesados/urgentes/" + id + "/original.pdf"));
            assertFalse(storage.contains("procesados/urgentes/" + id + "/triage.json"));
            assertCurrentMatchesArtifact();
        } finally { allowHistory(); }
    }

    @Test
    void transientPostgresFailurePersistsRecoverableFallbackButPropagatesPersistenceError() {
        // nextval survives rollback: the actual PostgreSQL trigger rejects only the first insert.
        jdbc.execute("create sequence it_transient_commit");
        jdbc.execute("create function it_transient_failure() returns trigger language plpgsql as $$ begin "
                + "if NEW.document_id = '" + id + "' and nextval('it_transient_commit') = 1 then "
                + "raise exception 'transient persistence failure' using errcode = '40001'; end if; return NEW; end $$");
        jdbc.execute("create trigger it_transient_failure before insert on document_triage_history "
                + "for each row execute function it_transient_failure()");
        try {
            assertSqlFailure("40001", () -> service.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT)));
            DocumentRecord current = persistence.getDocument(id);
            assertEquals(DocumentStatus.NEEDS_AUDIT, current.getStatus());
            assertEquals(StorageState.SUCCESS, current.getStorageState());
            assertEquals("recibidos/" + id + "/original.pdf", current.getObjectKey());
            assertTrue(current.getRoutingJustification().contains("Fallo de persistencia PostgreSQL"));
            assertEquals(PrimaryDestination.HUMAN_REVIEW, current.getRoutingDestination());
            assertEquals(DocumentRecord.defaultNotification(), current.getNotification());
            assertEquals(List.of(AuditReason.LOW_CONFIDENCE), current.getAuditReasons());
            assertEquals(1, persistence.listHistory(id).size());
            assertEquals(TriageEventType.INITIAL_TRIAGE, persistence.listHistory(id).getFirst().getEventType());
            assertTrue(storage.contains(current.getObjectKey()));
            assertFalse(storage.contains("procesados/urgentes/" + id + "/original.pdf"));
            assertFalse(storage.contains("procesados/urgentes/" + id + "/triage.json"));
            assertCurrentMatchesArtifact();
        } finally {
            jdbc.execute("drop trigger it_transient_failure on document_triage_history");
            jdbc.execute("drop function it_transient_failure()");
            jdbc.execute("drop sequence it_transient_commit");
        }
    }

    private RuntimeException assertSqlFailure(String sqlState, org.junit.jupiter.api.function.Executable action) {
        RuntimeException failure = assertThrows(RuntimeException.class, action);
        Throwable cause = failure;
        while (cause != null && !(cause instanceof java.sql.SQLException)) cause = cause.getCause();
        java.sql.SQLException sql = assertInstanceOf(java.sql.SQLException.class, cause, failure.toString());
        assertEquals(sqlState, sql.getSQLState());
        return failure;
    }

    @Test
    void postgres17IsActuallyUsed() throws Exception {
        assertTrue(jdbc.queryForObject("show server_version", String.class).startsWith("17."));
        assertEquals(2, dataSource.unwrap(com.zaxxer.hikari.HikariDataSource.class).getMaximumPoolSize());
        assertInstanceOf(PostgresDocumentExclusiveLock.class, lock);
    }

    @ParameterizedTest
    @CsvSource({
            "PROCESSED,URGENT,procesados/urgentes/",
            "PROCESSED,ROUTINE,procesados/rutina/",
            "NEEDS_AUDIT,ROUTINE,auditoria_humana/",
            "APPROVED,URGENT,procesados/urgentes/",
            "APPROVED,ROUTINE,procesados/rutina/",
            "REJECTED,ROUTINE,auditoria_humana/"
    })
    void commitsDocumentHistoryAndArtifactTogether(DocumentStatus status, PriorityLevel priority, String prefix) {
        if (status == DocumentStatus.APPROVED || status == DocumentStatus.REJECTED) {
            service.finalizeResult(command(DocumentStatus.NEEDS_AUDIT, PriorityLevel.ROUTINE));
        }
        String oldOriginal = persistence.getDocument(id).getObjectKey();
        service.finalizeResult(command(status, priority));
        DocumentRecord current = persistence.getDocument(id);
        assertEquals(prefix + id + "/original.pdf", current.getObjectKey());
        assertEquals(StorageState.SUCCESS, current.getStorageState());
        assertTrue(storage.contains(current.getObjectKey()));
        assertEquals("original-bytes", storage.readUtf8(current.getObjectKey()));
        if (!oldOriginal.equals(current.getObjectKey())) assertFalse(storage.contains(oldOriginal));
        assertCurrentMatchesArtifact();
    }

    @Test
    void historyInsertFailureRollsBackDocumentAndCompensatesOci() {
        Instant before = persistence.getDocument(id).getUpdatedAt();
        rejectHistory();
        try {
            assertSqlFailure("23514",
                    () -> service.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT)));
            assertEquals(DocumentStatus.RECEIVED, persistence.getDocument(id).getStatus());
            assertEquals(before, persistence.getDocument(id).getUpdatedAt());
            assertTrue(persistence.listHistory(id).isEmpty());
            assertTrue(storage.contains("recibidos/" + id + "/original.pdf"));
            assertFalse(storage.contains("procesados/urgentes/" + id + "/original.pdf"));
            assertFalse(storage.contains("procesados/urgentes/" + id + "/triage.json"));
        } finally {
            allowHistory();
        }
    }

    @Test
    void fallbackHistoryFailureRemovesArtifactNotConfirmedInPostgres() {
        rejectHistory();
        storage.failPutsMatching(key -> key.startsWith("procesados/"));
        try {
            assertSqlFailure("23514",
                    () -> service.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT)));
            assertEquals(DocumentStatus.RECEIVED, persistence.getDocument(id).getStatus());
            assertTrue(persistence.listHistory(id).isEmpty());
            assertTrue(storage.putKeys().contains("recibidos/" + id + "/triage.json"), "fallback was written");
            assertTrue(storage.contains("recibidos/" + id + "/original.pdf"));
            assertFalse(storage.contains("recibidos/" + id + "/triage.json"), "uncommitted fallback must be removed");
        } finally {
            allowHistory();
        }
    }

    @Test
    void staleExpectedSequenceChangesNeitherDocumentNorHistory() {
        service.finalizeResult(command(DocumentStatus.NEEDS_AUDIT, PriorityLevel.ROUTINE));
        DocumentRecord current = persistence.getDocument(id);
        assertThrows(DocumentPersistenceService.ConcurrentFinalizationException.class,
                () -> persistence.commitFinalization(id, null, TriageEventType.INITIAL_TRIAGE, null,
                        Map.of(), Instant.now(), 1));
        assertEquals(current.getUpdatedAt(), persistence.getDocument(id).getUpdatedAt());
        assertEquals(1, persistence.listHistory(id).size());
        assertCurrentMatchesArtifact();
    }

    @Test
    void storageErrorPreservesBusinessResultAndTimestampAndOrdinaryUpdatesStillTouchTimestamp() {
        service.finalizeResult(command(DocumentStatus.NEEDS_AUDIT, PriorityLevel.ROUTINE));
        DocumentRecord current = persistence.getDocument(id);
        persistence.markStorageErrorPreservingResult(id);
        DocumentRecord error = persistence.getDocument(id);
        assertEquals(StorageState.ERROR, error.getStorageState());
        assertEquals(current.getUpdatedAt(), error.getUpdatedAt());
        assertEquals(current.getStatus(), error.getStatus());
        assertEquals(1, persistence.listHistory(id).size());
        error.setSpecialty("changed");
        persistence.saveDocument(error);
        assertTrue(persistence.getDocument(id).getUpdatedAt().isAfter(current.getUpdatedAt()));
    }

    @Test
    void advisoryLockIsReleasedAfterWorkThrows() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> lock.execute(id, () -> {
            throw new IllegalArgumentException("induced");
        }));
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var statement = connection.prepareStatement("select pg_try_advisory_lock(hashtext(?))")) {
            statement.setString(1, id);
            try (var result = statement.executeQuery()) {
                assertTrue(result.next());
                assertTrue(result.getBoolean(1));
            }
        }
    }

    @Test
    void waitingFinalizationDoesNotExhaustTwoConnectionPool() throws Exception {
        CountDownLatch firstInside = new CountDownLatch(1);
        CountDownLatch queryNow = new CountDownLatch(1);
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> first = workers.submit(() -> lock.execute(id, () -> {
                firstInside.countDown();
                await(queryNow);
                return jdbc.queryForObject("select 1", Integer.class);
            }));
            assertTrue(firstInside.await(5, TimeUnit.SECONDS));
            Future<Integer> second = workers.submit(() -> lock.execute(id,
                    () -> jdbc.queryForObject("select 2", Integer.class)));
            // Observe the real waiter without borrowing a connection from the pool under test.
            awaitAdvisoryWaiter();
            queryNow.countDown();
            assertEquals(1, first.get(10, TimeUnit.SECONDS));
            assertEquals(2, second.get(10, TimeUnit.SECONDS));
        } finally {
            queryNow.countDown();
            workers.shutdownNow();
        }
    }

    @Test
    void concurrentFinalizationsSerializeStorageAndKeepPostgresSnapshot() throws Exception {
        CountDownLatch writing = new CountDownLatch(1);
        CountDownLatch finishWrite = new CountDownLatch(1);
        AtomicInteger active = new AtomicInteger();
        AtomicInteger maximum = new AtomicInteger();
        InMemoryObjectStorageService slow = new InMemoryObjectStorageService() {
            @Override public void putJson(String key, String value) {
                maximum.accumulateAndGet(active.incrementAndGet(), Math::max);
                try {
                    if (writing.getCount() != 0) {
                        assertTrue(contains("recibidos/" + id + "/original.pdf"));
                        writing.countDown();
                        await(finishWrite);
                    }
                    super.putJson(key, value);
                } finally { active.decrementAndGet(); }
            }
        };
        slow.seed("recibidos/" + id + "/original.pdf", "original-bytes");
        service = service(persistence, slow);
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            Future<FinalizationOutcome> a = workers.submit(() -> service.finalizeResult(command(DocumentStatus.NEEDS_AUDIT, PriorityLevel.ROUTINE)));
            assertTrue(writing.await(5, TimeUnit.SECONDS));
            Future<FinalizationOutcome> b = workers.submit(() -> service.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT)));
            awaitAdvisoryWaiter();
            finishWrite.countDown();
            assertEquals(1, a.get(10, TimeUnit.SECONDS).sequence());
            assertEquals(2, b.get(10, TimeUnit.SECONDS).sequence());
            assertEquals(1, maximum.get());
            storage = slow;
            assertCurrentMatchesArtifact();
        } finally {
            finishWrite.countDown();
            workers.shutdownNow();
        }
    }

    @ParameterizedTest
    @CsvSource({"false,false", "true,false", "false,true", "true,true"})
    void errorAfterRealCommitNeverDestroysConfirmedArtifact(boolean fallback, boolean inspectionUnavailable) {
        if (fallback) storage.failPutsMatching(key -> key.startsWith("procesados/"));
        FaultingPersistence faults = new FaultingPersistence();
        faults.throwAfterCommit = true;
        faults.inspectionUnavailable = inspectionUnavailable;
        service = service(faults, storage);
        if (inspectionUnavailable) {
            IllegalStateException failure = assertThrows(IllegalStateException.class,
                    () -> service.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT)));
            assertEquals("client error after real commit", failure.getMessage());
        } else {
            FinalizationOutcome outcome = service.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT));
            assertEquals(fallback ? FinalizationOutcome.Kind.FALLBACK_DURABLE : FinalizationOutcome.Kind.CONFIRMED, outcome.kind());
        }
        assertEquals(fallback ? DocumentStatus.NEEDS_AUDIT : DocumentStatus.PROCESSED, persistence.getDocument(id).getStatus());
        assertCurrentMatchesArtifact();
        assertFalse(storage.deletedKeys().contains(triageKey(persistence.getDocument(id))));
        String supersededOriginal = "recibidos/" + id + "/original.pdf";
        if (fallback) {
            assertTrue(storage.contains(supersededOriginal));
        } else if (inspectionUnavailable) {
            assertTrue(storage.contains(supersededOriginal));
            assertTrue(storage.deletedKeys().isEmpty(), "unverified commit must stay non-destructive");
        } else {
            assertTrue(storage.contains(persistence.getDocument(id).getObjectKey()));
            assertFalse(storage.contains(supersededOriginal));
            assertTrue(storage.deletedKeys().containsAll(List.of(supersededOriginal, "recibidos/" + id + "/triage.json")));
        }
    }

    @Test
    void failedCleanupAfterUncertainCommitKeepsConfirmedResultAndIsLogged() {
        FaultingPersistence faults = new FaultingPersistence();
        faults.throwAfterCommit = true;
        service = service(faults, storage);
        storage.failDeletesMatching(key -> key.startsWith("recibidos/"));
        Logger logger = (Logger) LoggerFactory.getLogger(DocumentFinalizationService.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            FinalizationOutcome outcome = service.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT));

            assertEquals(FinalizationOutcome.Kind.CONFIRMED, outcome.kind());
            DocumentRecord current = persistence.getDocument(id);
            assertEquals(DocumentStatus.PROCESSED, current.getStatus());
            assertEquals(StorageState.SUCCESS, current.getStorageState());
            assertEquals("procesados/urgentes/" + id + "/original.pdf", current.getObjectKey());
            assertEquals(1, persistence.listHistory(id).size());
            assertTrue(storage.contains(current.getObjectKey()));
            assertTrue(storage.contains(triageKey(current)));
            assertTrue(storage.contains("recibidos/" + id + "/original.pdf"), "failed cleanup leaves the superseded copy");
            assertCurrentMatchesArtifact();
            List<String> pending = appender.list.stream()
                    .filter(event -> event.getFormattedMessage().contains("Limpieza post-commit pendiente"))
                    .map(ILoggingEvent::getFormattedMessage)
                    .toList();
            assertTrue(pending.stream().anyMatch(message -> message.contains(id)
                    && message.contains("recibidos/" + id + "/original.pdf")), pending.toString());
        } finally {
            logger.detachAppender(appender);
        }
    }

    @Test
    void fallbackWriteThatReachesStorageThenThrowsIsCompensatedAfterRealRollback() {
        InMemoryObjectStorageService ambiguous = new InMemoryObjectStorageService() {
            @Override public void putJson(String key, String value) {
                super.putJson(key, value);
                throw new StorageOperationException("response lost after write", new RuntimeException("induced"));
            }
        };
        ambiguous.seed("recibidos/" + id + "/original.pdf", "original-bytes");
        storage = ambiguous;
        service = service(persistence, storage);
        rejectHistory();
        try {
            assertSqlFailure("23514",
                    () -> service.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT)));
            assertEquals(DocumentStatus.RECEIVED, persistence.getDocument(id).getStatus());
            assertTrue(persistence.listHistory(id).isEmpty());
            assertTrue(storage.putKeys().contains("recibidos/" + id + "/triage.json"));
            assertFalse(storage.contains("recibidos/" + id + "/triage.json"));
        } finally { allowHistory(); }
    }

    @ParameterizedTest
    @CsvSource({"false", "true"})
    void fallbackRollbackRestoresPreviousDurableArtifactOrMarksStorageError(boolean restoreFails) {
        service.finalizeResult(command(DocumentStatus.NEEDS_AUDIT, PriorityLevel.ROUTINE));
        DocumentRecord before = persistence.getDocument(id);
        String previous = storage.readUtf8(triageKey(before));
        AtomicInteger fallbackPuts = new AtomicInteger();
        storage.failPutsMatching(key -> key.startsWith("procesados/")
                || (key.equals(triageKey(before)) && fallbackPuts.incrementAndGet() > 1 && restoreFails));
        rejectHistory();
        try {
            assertSqlFailure("23514",
                    () -> service.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT)));
            DocumentRecord after = persistence.getDocument(id);
            assertEquals(before.getStatus(), after.getStatus());
            assertEquals(before.getObjectKey(), after.getObjectKey());
            assertEquals(before.getUpdatedAt(), after.getUpdatedAt());
            assertEquals(1, persistence.listHistory(id).size());
            if (restoreFails) {
                assertEquals(StorageState.ERROR, after.getStorageState());
            } else {
                assertEquals(previous, storage.readUtf8(triageKey(after)));
                assertCurrentMatchesArtifact();
            }
        } finally { allowHistory(); }
    }

    @Test
    void failedRemovalOfUnconfirmedFallbackMarksStorageError() {
        storage.failPutsMatching(key -> key.startsWith("procesados/"));
        storage.failDeletesMatching(key -> key.equals("recibidos/" + id + "/triage.json"));
        rejectHistory();
        try {
            assertSqlFailure("23514",
                    () -> service.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT)));
            assertTrue(persistence.listHistory(id).isEmpty());
            assertEquals(DocumentStatus.RECEIVED, persistence.getDocument(id).getStatus());
            assertEquals(StorageState.ERROR, persistence.getDocument(id).getStorageState());
        } finally { allowHistory(); }
    }

    @ParameterizedTest
    @CsvSource({"false", "true"})
    void storageFailureDoesNotConfirmAnUrgentNotification(boolean originalLost) {
        storage.failPutsMatching(key -> key.startsWith("procesados/"));
        if (originalLost) storage.missingGetsMatching(key -> key.endsWith("original.pdf"));
        FinalizationCommand normal = command(DocumentStatus.PROCESSED, PriorityLevel.URGENT);
        FinalizationCommand urgent = new FinalizationCommand(id, normal.status(), normal.documentType(), normal.specialty(),
                normal.priority(), normal.confidenceClassification(), normal.confidenceExtraction(), normal.confidenceGlobal(),
                PrimaryDestination.MEDICAL_EMERGENCY, normal.routingJustification(), normal.auditReasons(),
                normal.extractedData(), normal.validation(),
                Map.of("generated", true, "type", "MEDICAL_EMERGENCY", "message", "Urgent test"),
                normal.eventType(), null, null);
        service.finalizeResult(urgent);
        DocumentRecord current = persistence.getDocument(id);
        assertEquals(originalLost ? DocumentStatus.FAILED : DocumentStatus.NEEDS_AUDIT, current.getStatus());
        assertEquals(DocumentRecord.defaultNotification(), current.getNotification());
        assertEquals(DocumentRecord.defaultNotification(), persistence.listHistory(id).getFirst().getResult().get("notification"));
    }

    @Test
    void finalizationsOfDifferentDocumentsDoNotHoldTheJpaPool() throws Exception {
        CountDownLatch bothInside = new CountDownLatch(2);
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> task = () -> lock.execute(UUID.randomUUID().toString(), () -> {
                bothInside.countDown();
                await(bothInside);
                return jdbc.queryForObject("select 1", Integer.class);
            });
            Future<Integer> a = workers.submit(task);
            Future<Integer> b = workers.submit(task);
            assertEquals(1, a.get(10, TimeUnit.SECONDS));
            assertEquals(1, b.get(10, TimeUnit.SECONDS));
        } finally { workers.shutdownNow(); }
    }

    @Test
    void compensationCompletesUnderAdvisoryLockBeforeWaitingFinalizationCanWrite() throws Exception {
        CountDownLatch inspecting = new CountDownLatch(1);
        CountDownLatch compensateNow = new CountDownLatch(1);
        FaultingPersistence faults = new FaultingPersistence();
        faults.beforeInspection = () -> { inspecting.countDown(); await(compensateNow); };
        DocumentFinalizationService failing = service(faults, storage);
        ExecutorService workers = Executors.newFixedThreadPool(2);
        rejectHistory();
        boolean constraintPresent = true;
        try {
            Future<FinalizationOutcome> first = workers.submit(() -> failing.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT)));
            assertTrue(inspecting.await(5, TimeUnit.SECONDS)); // The real history insert already rolled back.
            allowHistory();
            constraintPresent = false;
            Future<FinalizationOutcome> second = workers.submit(() -> service.finalizeResult(command(DocumentStatus.PROCESSED, PriorityLevel.URGENT)));
            awaitAdvisoryWaiter();
            compensateNow.countDown();
            assertThrows(ExecutionException.class, () -> first.get(10, TimeUnit.SECONDS));
            assertEquals(FinalizationOutcome.Kind.CONFIRMED, second.get(10, TimeUnit.SECONDS).kind());
            assertEquals(2, persistence.listHistory(id).size());
            assertEquals("NEEDS_AUDIT", persistence.listHistory(id).getFirst().getResult().get("status"));
            assertTrue(storage.contains(persistence.getDocument(id).getObjectKey()));
            assertCurrentMatchesArtifact();
        } finally {
            compensateNow.countDown();
            workers.shutdownNow();
            if (constraintPresent) allowHistory();
        }
    }

    @Test
    void durableInspectionDistinguishesUncommittedCurrentAndNewerSequences() {
        assertEquals(DurableCommitInspection.NOT_COMMITTED, persistence.inspectDurableCommit(id, 1));
        service.finalizeResult(command(DocumentStatus.NEEDS_AUDIT, PriorityLevel.ROUTINE));
        assertEquals(DurableCommitInspection.THIS_ATTEMPT_COMMITTED, persistence.inspectDurableCommit(id, 1));
        service.finalizeResult(command(DocumentStatus.REJECTED, PriorityLevel.ROUTINE));
        assertEquals(DurableCommitInspection.NEWER_CONFIRMED, persistence.inspectDurableCommit(id, 1));
        assertCurrentMatchesArtifact();
    }

    /** Fault injection surrounds the real transactional Spring proxy; no database operation is faked. */
    private class FaultingPersistence extends DocumentPersistenceService {
        boolean throwAfterCommit;
        boolean inspectionUnavailable;
        Runnable beforeInspection = () -> {};
        FaultingPersistence() { super(null, null, null); }
        @Override public DocumentRecord getDocument(String documentId) { return persistence.getDocument(documentId); }
        @Override public int nextSequenceFor(String documentId) { return persistence.nextSequenceFor(documentId); }
        @Override public void markStorageErrorPreservingResult(String documentId) { persistence.markStorageErrorPreservingResult(documentId); }
        @Override public DurableCommitInspection inspectDurableCommit(String documentId, int sequence) {
            beforeInspection.run();
            if (inspectionUnavailable) throw new IllegalStateException("inspection unavailable after commit");
            return persistence.inspectDurableCommit(documentId, sequence);
        }
        @Override public DocumentTriageHistory commitFinalization(String documentId, FinalizedDocumentState state,
                TriageEventType type, HumanDecision decision, Map<String, Object> snapshot, Instant time, int sequence) {
            DocumentTriageHistory result = persistence.commitFinalization(documentId, state, type, decision, snapshot, time, sequence);
            if (throwAfterCommit) throw new IllegalStateException("client error after real commit");
            return result;
        }
        @Override public DocumentTriageHistory commitHumanReview(String documentId, int expectedHistorySequence,
                Runnable prepareStorage, FinalizedDocumentState state, HumanDecision decision,
                Map<String, Object> snapshot, Instant time) {
            DocumentTriageHistory result = persistence.commitHumanReview(documentId, expectedHistorySequence,
                    prepareStorage, state, decision, snapshot, time);
            if (throwAfterCommit) throw new IllegalStateException("client error after real commit");
            return result;
        }
    }

    private void assertCurrentMatchesArtifact() {
        DocumentRecord current = persistence.getDocument(id);
        List<DocumentTriageHistory> history = persistence.listHistory(id);
        DocumentTriageHistory last = history.getLast();
        Map<?, ?> artifact = json.readValue(storage.readUtf8(triageKey(current)), Map.class);
        assertEquals(current.getUpdatedAt(), last.getOccurredAt());
        assertEquals(current.getUpdatedAt(), Instant.parse((String) artifact.remove("updated_at")));
        assertEquals(current.getCreatedAt(), Instant.parse((String) artifact.remove("created_at")));
        assertEquals(last.getId().getSequence(), artifact.remove("sequence"));
        Object review = artifact.remove("human_review");
        assertEquals(last.getDecision() == null ? null : Map.of("decision", last.getDecision().name()), review);
        assertEquals(last.getResult(), artifact);
        assertEquals(json.convertValue(mapper.toResponse(current), Map.class), last.getResult());
        String snapshot = json.writeValueAsString(last.getResult());
        for (String internal : List.of("object_key", "namespace", "bucket", "test-bucket")) assertFalse(snapshot.contains(internal));
        for (int i = 0; i < history.size(); i++) assertEquals(i + 1, history.get(i).getId().getSequence());
    }

    private void rejectHistory() {
        int confirmed = persistence.listHistory(id).size();
        jdbc.execute("alter table document_triage_history add constraint it_reject_history check (document_id <> '" + id + "' or sequence <= " + confirmed + ")");
    }

    private void allowHistory() { jdbc.execute("alter table document_triage_history drop constraint it_reject_history"); }

    private void awaitAdvisoryWaiter() throws Exception {
        try (var observer = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var statement = observer.createStatement()) {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (System.nanoTime() < deadline) {
                try (var rows = statement.executeQuery("select count(*) from pg_locks where locktype = 'advisory' and not granted")) {
                    rows.next();
                    if (rows.getInt(1) > 0) return;
                }
                Thread.sleep(10);
            }
            fail("second session did not wait for the advisory lock");
        }
    }

    private static void await(CountDownLatch latch) {
        try { assertTrue(latch.await(10, TimeUnit.SECONDS)); }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
    }

    private static String triageKey(DocumentRecord record) {
        return record.getObjectKey().substring(0, record.getObjectKey().lastIndexOf('/') + 1) + "triage.json";
    }

    private DocumentFinalizationService service(DocumentPersistenceService database, ObjectStorageService objects) {
        return new DocumentFinalizationService(database, objects, new ObjectKeyGenerator(), mapper, json, lock);
    }

    private FinalizationCommand command(DocumentStatus status, PriorityLevel priority) {
        boolean review = status == DocumentStatus.APPROVED || status == DocumentStatus.REJECTED;
        return new FinalizationCommand(id, status, DocumentType.DISCHARGE_SUMMARY, "general", priority,
                0.9, 0.8, 0.85, PrimaryDestination.MEDICAL_RECORD, "test", List.of(AuditReason.LOW_CONFIDENCE),
                Map.of("patient", Map.of("name", "Synthetic")), DocumentRecord.emptyValidation(),
                DocumentRecord.defaultNotification(), review ? TriageEventType.HUMAN_REVIEW : TriageEventType.INITIAL_TRIAGE,
                review ? (status == DocumentStatus.APPROVED ? HumanDecision.APPROVE : HumanDecision.REJECT) : null,
                review ? persistence.nextSequenceFor(id) - 1 : null);
    }
}
