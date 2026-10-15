package com.mediflow.backend.service;

import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.entity.DocumentTriageHistory;
import com.mediflow.backend.entity.DocumentTriageHistoryId;
import com.mediflow.backend.enums.HumanDecision;
import com.mediflow.backend.enums.StorageState;
import com.mediflow.backend.enums.TriageEventType;
import com.mediflow.backend.persistence.DocumentPersistenceService;
import com.mediflow.backend.persistence.DurableCommitInspection;
import com.mediflow.backend.persistence.FinalizedDocumentState;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

final class FakeDocumentPersistenceService extends DocumentPersistenceService {

    private final ConcurrentHashMap<String, DocumentRecord> documents = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Object> mutexes = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, List<DocumentTriageHistory>> history = new ConcurrentHashMap<>();
    private final AtomicInteger failingCommits = new AtomicInteger();
    private final AtomicBoolean throwAfterSuccessfulCommit = new AtomicBoolean(false);
    private final AtomicInteger commitAttempts = new AtomicInteger();
    private final AtomicBoolean failInspection = new AtomicBoolean(false);

    FakeDocumentPersistenceService() {
        super(null, null, null);
    }

    void seed(DocumentRecord document) {
        documents.put(document.getId(), document);
        history.putIfAbsent(document.getId(), new CopyOnWriteArrayList<>());
    }

    void failNextCommit() {
        failNextCommits(1);
    }

    void failNextCommits(int count) {
        failingCommits.set(count);
    }

    void failInspection() {
        failInspection.set(true);
    }

    void throwAfterSuccessfulCommit() {
        throwAfterSuccessfulCommit.set(true);
    }

    DocumentRecord stored(String documentId) {
        return documents.get(documentId);
    }

    List<DocumentTriageHistory> historyOf(String documentId) {
        return new ArrayList<>(history.getOrDefault(documentId, List.of()));
    }

    int commitAttempts() {
        return commitAttempts.get();
    }

    @Override
    public DocumentRecord getDocument(String documentId) {
        DocumentRecord stored = documents.get(documentId);
        if (stored == null) {
            throw new IllegalArgumentException("Documento no encontrado: " + documentId);
        }
        return stored;
    }

    @Override
    public int nextSequenceFor(String documentId) {
        return history.getOrDefault(documentId, List.of()).size() + 1;
    }

    @Override
    public DocumentTriageHistory commitHumanReview(String documentId, int expectedHistorySequence,
            Runnable prepareStorage, FinalizedDocumentState state, HumanDecision decision,
            Map<String, Object> snapshot, Instant time) {
        synchronized (lock(documentId)) {
            DocumentRecord document = getDocument(documentId);
            int current = nextSequenceFor(documentId) - 1;
            if (document.getStatus() != com.mediflow.backend.enums.DocumentStatus.NEEDS_AUDIT
                    || current != expectedHistorySequence) {
                throw new ReviewConflictException(documentId, document.getStatus(), expectedHistorySequence, current);
            }
            prepareStorage.run();
            return commitFinalization(documentId, state, TriageEventType.HUMAN_REVIEW, decision,
                    snapshot, time, expectedHistorySequence + 1);
        }
    }

    @Override
    public DocumentTriageHistory commitFinalization(
            String documentId,
            FinalizedDocumentState state,
            TriageEventType eventType,
            HumanDecision decision,
            Map<String, Object> resultSnapshot,
            Instant confirmationTime,
            int expectedNextSequence
    ) {
        commitAttempts.incrementAndGet();
        synchronized (lock(documentId)) {
            if (failingCommits.getAndUpdate(n -> n > 0 ? n - 1 : 0) > 0) {
                throw new RuntimeException("induced postgres failure");
            }
            int actual = nextSequenceFor(documentId);
            if (actual != expectedNextSequence) {
                throw new ConcurrentFinalizationException(documentId, expectedNextSequence, actual);
            }
            DocumentRecord document = getDocument(documentId);
            document.setStatus(state.status());
            document.setObjectKey(state.objectKey());
            document.setStorageState(state.storageState());
            document.setDocumentType(state.documentType());
            document.setSpecialty(state.specialty());
            document.setPriority(state.priority());
            document.setConfidenceClassification(state.confidenceClassification());
            document.setConfidenceExtraction(state.confidenceExtraction());
            document.setConfidenceGlobal(state.confidenceGlobal());
            document.setRoutingDestination(state.routingDestination());
            document.setRoutingJustification(state.routingJustification());
            document.setAuditReasons(state.auditReasons());
            document.setExtractedData(state.extractedData());
            document.setValidation(state.validation());
            document.setNotification(state.notification());
            document.touchUpdatedAt(confirmationTime);

            DocumentTriageHistory entry = new DocumentTriageHistory();
            entry.setId(new DocumentTriageHistoryId(documentId, expectedNextSequence));
            entry.setEventType(eventType);
            entry.setDecision(decision);
            entry.setOccurredAt(confirmationTime);
            entry.setResult(resultSnapshot);
            history.computeIfAbsent(documentId, ignored -> new CopyOnWriteArrayList<>()).add(entry);

            if (throwAfterSuccessfulCommit.compareAndSet(true, false)) {
                throw new RuntimeException("client timeout after durable commit");
            }
            return entry;
        }
    }

    @Override
    public DurableCommitInspection inspectDurableCommit(String documentId, int expectedNextSequence) {
        if (failInspection.get()) {
            throw new RuntimeException("induced inspection failure");
        }
        synchronized (lock(documentId)) {
            if (!documents.containsKey(documentId)) {
                return DurableCommitInspection.DOCUMENT_MISSING;
            }
            int currentMax = history.getOrDefault(documentId, List.of()).size();
            if (currentMax > expectedNextSequence) {
                return DurableCommitInspection.NEWER_CONFIRMED;
            }
            if (currentMax == expectedNextSequence) {
                return DurableCommitInspection.THIS_ATTEMPT_COMMITTED;
            }
            return DurableCommitInspection.NOT_COMMITTED;
        }
    }

    @Override
    public void markStorageErrorPreservingResult(String documentId) {
        DocumentRecord document = documents.get(documentId);
        if (document != null) {
            document.setStorageState(StorageState.ERROR);
        }
    }

    @Override
    public Optional<DocumentTriageHistory> findHistoryEntry(String documentId, int sequence) {
        return history.getOrDefault(documentId, List.of()).stream()
                .filter(entry -> entry.getId().getSequence() == sequence)
                .findFirst();
    }

    private Object lock(String documentId) {
        return mutexes.computeIfAbsent(documentId, ignored -> new Object());
    }
}
