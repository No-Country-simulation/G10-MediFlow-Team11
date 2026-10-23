package com.mediflow.backend.persistence;

import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.entity.DocumentTriageHistory;
import com.mediflow.backend.entity.DocumentTriageHistoryId;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.BackendErrorCode;
import com.mediflow.backend.enums.HumanDecision;
import com.mediflow.backend.enums.StorageState;
import com.mediflow.backend.enums.TriageEventType;
import com.mediflow.backend.repository.DocumentRepository;
import com.mediflow.backend.repository.DocumentTriageHistoryRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Persistencia de documentos e historial. El historial solo se inserta (append-only);
 * {@code sequence} se asigna bajo bloqueo de la fila del documento (arquitectura §10).
 */
@Service
public class DocumentPersistenceService {

    private final DocumentRepository documentRepository;
    private final DocumentTriageHistoryRepository historyRepository;
    private final EntityManager entityManager;

    public DocumentPersistenceService(
            DocumentRepository documentRepository,
            DocumentTriageHistoryRepository historyRepository,
            EntityManager entityManager
    ) {
        this.documentRepository = documentRepository;
        this.historyRepository = historyRepository;
        this.entityManager = entityManager;
    }

    @Transactional
    public DocumentRecord saveDocument(DocumentRecord document) {
        return documentRepository.save(document);
    }

    @Transactional(readOnly = true)
    public boolean existsDocument(String documentId) {
        return documentRepository.existsById(documentId);
    }

    /** Usa {@code persist}, no {@code merge}: un id existente falla en lugar de sobrescribirse. */
    @Transactional
    public DocumentRecord createReceived(DocumentRecord document) {
        try {
            entityManager.persist(document);
            entityManager.flush();
            return document;
        } catch (PersistenceException exception) {
            if (isUniqueViolation(exception)) {
                throw new DuplicateDocumentException(document.getId(), exception);
            }
            throw exception;
        }
    }

    @Transactional
    public boolean markProcessing(String documentId) {
        DocumentRecord document = documentRepository.findById(documentId).orElse(null);
        if (document == null) {
            return false;
        }
        entityManager.lock(document, LockModeType.PESSIMISTIC_WRITE);
        if (document.getStatus() != DocumentStatus.RECEIVED) {
            return false;
        }
        document.setStatus(DocumentStatus.PROCESSING);
        documentRepository.save(document);
        return true;
    }

    private static boolean isUniqueViolation(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql && "23505".equals(sql.getSQLState())) {
                return true;
            }
            if (cause.getCause() == cause) {
                break;
            }
        }
        return false;
    }

    @Transactional(readOnly = true)
    public DocumentRecord getDocument(String documentId) {
        return documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Documento no encontrado: " + documentId));
    }

    @Transactional(readOnly = true)
    public Optional<DocumentRecord> findDocument(String documentId) {
        return documentRepository.findById(documentId);
    }

    @Transactional(readOnly = true)
    public List<DocumentRecord> listAuditDocuments() {
        return documentRepository.findByStatusOrderByCreatedAtAscIdAsc(DocumentStatus.NEEDS_AUDIT);
    }

    @Transactional(readOnly = true)
    public List<DocumentRecord> listDocuments() {
        return documentRepository.findAllByOrderByCreatedAtDescIdAsc();
    }

    @Transactional(readOnly = true)
    public List<DocumentTriageHistory> listHistory(String documentId) {
        return historyRepository.findByIdDocumentIdOrderByIdSequenceAsc(documentId);
    }

    /**
     * Inserta la siguiente entrada de historial. No actualiza ni borra entradas previas.
     * {@code occurred_at} coincide con {@code documents.updated_at} del resultado confirmado.
     */
    @Transactional
    public DocumentTriageHistory appendHistory(
            String documentId,
            TriageEventType eventType,
            HumanDecision decision,
            Map<String, Object> resultSnapshot
    ) {
        if (eventType == TriageEventType.INITIAL_TRIAGE && decision != null) {
            throw new IllegalArgumentException("INITIAL_TRIAGE no admite decision");
        }
        if (eventType == TriageEventType.HUMAN_REVIEW && decision == null) {
            throw new IllegalArgumentException("HUMAN_REVIEW requiere decision APPROVE o REJECT");
        }

        DocumentRecord document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Documento no encontrado: " + documentId));
        entityManager.lock(document, LockModeType.PESSIMISTIC_WRITE);

        int nextSequence = historyRepository.findMaxSequence(documentId) + 1;
        Instant tentativeOccurredAt = Instant.now();
        document.touchUpdatedAt(tentativeOccurredAt);
        documentRepository.save(document);
        historyRepository.flush();
        entityManager.refresh(document);
        Instant persistedUpdatedAt = document.getUpdatedAt();

        DocumentTriageHistory entry = new DocumentTriageHistory();
        entry.setId(new DocumentTriageHistoryId(documentId, nextSequence));
        entry.setDocument(document);
        entry.setEventType(eventType);
        entry.setDecision(decision);
        entry.setOccurredAt(persistedUpdatedAt);
        entry.setResult(resultSnapshot);
        return historyRepository.save(entry);
    }

    /**
     * Devuelve la próxima secuencia que se asignaría a una entrada de historial
     * para el documento indicado ({@code max(sequence) + 1}; 1 si no hay entradas).
     * <p>
     * Lectura no bloqueante; el valor debe revalidarse bajo bloqueo dentro de
     * {@link #commitFinalization} para detectar concurrencia.
     */
    @Transactional(readOnly = true)
    public int nextSequenceFor(String documentId) {
        return historyRepository.findMaxSequence(documentId) + 1;
    }

    /**
     * #31 posee esta transacción: valida la versión preparada por #71 y retiene
     * la fila hasta terminar OCI y confirmar la decisión. El llamador retiene
     * además el advisory lock hasta el commit/rollback y su compensación.
     */
    @Transactional
    public DocumentTriageHistory commitHumanReview(
            String documentId, int expectedHistorySequence, Runnable prepareStorage,
            FinalizedDocumentState state, HumanDecision decision,
            Map<String, Object> snapshot, Instant confirmationTime
    ) {
        DocumentRecord document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Documento no encontrado: " + documentId));
        entityManager.refresh(document, LockModeType.PESSIMISTIC_WRITE);
        int currentSequence = historyRepository.findMaxSequence(documentId);
        if (document.getStatus() != DocumentStatus.NEEDS_AUDIT || currentSequence != expectedHistorySequence) {
            throw new ReviewConflictException(documentId, document.getStatus(), expectedHistorySequence, currentSequence);
        }
        prepareStorage.run();
        // Participa en la transacción de este método; el proxy confirma al retornar.
        return commitFinalization(documentId, state, TriageEventType.HUMAN_REVIEW, decision,
                snapshot, confirmationTime, expectedHistorySequence + 1);
    }

    /**
     * Confirma de forma atómica el resultado actual del documento y su entrada
     * de historial asociada (arquitectura §10 y §12 Paso 3).
     * <p>
     * En una única transacción:
     * <ol>
     *   <li>Bloquea la fila del documento con {@code PESSIMISTIC_WRITE}.</li>
     *   <li>Verifica que la secuencia esperada siga siendo la vigente
     *       (protección contra confirmaciones concurrentes).</li>
     *   <li>Actualiza todos los campos persistentes del resultado y
     *       {@code updated_at = confirmationTime}.</li>
     *   <li>Inserta la entrada de historial con {@code occurred_at = confirmationTime}.</li>
     * </ol>
     * Si la secuencia esperada no coincide, lanza {@link ConcurrentFinalizationException}
     * para que el llamador no confirme un resultado inconsistente.
     *
     * @return la entrada de historial insertada, cuyo {@code occurredAt} coincide
     *         exactamente con el {@code updatedAt} persistido del documento.
     */
    @Transactional
    public DocumentTriageHistory commitFinalization(
            String documentId,
            FinalizedDocumentState state,
            TriageEventType eventType,
            HumanDecision decision,
            Map<String, Object> resultSnapshot,
            Instant confirmationTime,
            int expectedNextSequence
    ) {
        validateEvent(eventType, decision);

        DocumentRecord document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Documento no encontrado: " + documentId));
        entityManager.lock(document, LockModeType.PESSIMISTIC_WRITE);

        int actualNextSequence = historyRepository.findMaxSequence(documentId) + 1;
        if (actualNextSequence != expectedNextSequence) {
            throw new ConcurrentFinalizationException(
                    documentId, expectedNextSequence, actualNextSequence
            );
        }

        applyState(document, state);
        document.touchUpdatedAt(confirmationTime);
        documentRepository.save(document);
        documentRepository.flush();

        DocumentTriageHistory entry = new DocumentTriageHistory();
        entry.setId(new DocumentTriageHistoryId(documentId, expectedNextSequence));
        entry.setDocument(document);
        entry.setEventType(eventType);
        entry.setDecision(decision);
        entry.setOccurredAt(confirmationTime);
        entry.setResult(resultSnapshot);
        historyRepository.save(entry);
        historyRepository.flush();
        return entry;
    }

    /**
     * Inspecciona el estado durable bajo {@code SELECT ... FOR UPDATE} en una
     * transacción corta e independiente del intento fallido (arquitectura §12.4).
     * <p>
     * No ejecuta operaciones OCI: solo permite decidir si una compensación
     * destructiva sigue siendo de este intento.
     */
    @Transactional
    public DurableCommitInspection inspectDurableCommit(String documentId, int expectedNextSequence) {
        DocumentRecord document = documentRepository.findById(documentId).orElse(null);
        if (document == null) {
            return DurableCommitInspection.DOCUMENT_MISSING;
        }
        entityManager.lock(document, LockModeType.PESSIMISTIC_WRITE);
        int currentMax = historyRepository.findMaxSequence(documentId);
        if (currentMax > expectedNextSequence) {
            return DurableCommitInspection.NEWER_CONFIRMED;
        }
        if (currentMax == expectedNextSequence) {
            return DurableCommitInspection.THIS_ATTEMPT_COMMITTED;
        }
        return DurableCommitInspection.NOT_COMMITTED;
    }

    @Transactional(readOnly = true)
    public Optional<DocumentTriageHistory> findHistoryEntry(String documentId, int sequence) {
        return historyRepository.findById(new DocumentTriageHistoryId(documentId, sequence));
    }

    /**
     * Marca {@code storage_state = ERROR} sin alterar el resultado de negocio
     * ni {@code updated_at}, cuando una restauración/compensación dejó OCI
     * inconsistente y PostgreSQL sigue disponible (arquitectura §12.5).
     */
    @Transactional
    public void markStorageErrorPreservingResult(String documentId) {
        DocumentRecord document = documentRepository.findById(documentId).orElse(null);
        if (document == null) {
            return;
        }
        entityManager.lock(document, LockModeType.PESSIMISTIC_WRITE);
        document.setStorageState(StorageState.ERROR);
        document.preserveCurrentUpdatedAt();
        documentRepository.save(document);
    }

    private void validateEvent(TriageEventType eventType, HumanDecision decision) {
        if (eventType == TriageEventType.INITIAL_TRIAGE && decision != null) {
            throw new IllegalArgumentException("INITIAL_TRIAGE no admite decision");
        }
        if (eventType == TriageEventType.HUMAN_REVIEW && decision == null) {
            throw new IllegalArgumentException("HUMAN_REVIEW requiere decision APPROVE o REJECT");
        }
    }

    private void applyState(DocumentRecord document, FinalizedDocumentState state) {
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
    }

    /**
     * Se lanza cuando la secuencia esperada de historial no coincide con la
     * vigente al momento de confirmar, indicando que otra operación concurrente
     * ya modificó el documento.
     */
    public static class ConcurrentFinalizationException extends RuntimeException {
        private final String documentId;
        private final int expectedSequence;
        private final int actualSequence;

        public ConcurrentFinalizationException(String documentId, int expectedSequence, int actualSequence) {
            super("Secuencia de historial inconsistente para " + documentId
                    + ": esperada=" + expectedSequence + ", actual=" + actualSequence);
            this.documentId = documentId;
            this.expectedSequence = expectedSequence;
            this.actualSequence = actualSequence;
        }

        public String getDocumentId() { return documentId; }
        public int getExpectedSequence() { return expectedSequence; }
        public int getActualSequence() { return actualSequence; }
    }

    public static class DuplicateDocumentException extends RuntimeException {
        public DuplicateDocumentException(String documentId, Throwable cause) {
            super("Ya existe un documento con id " + documentId, cause);
        }
    }

    /** #71 traduce este conflicto de estado o versión a HTTP 409 INVALID_REVIEW_STATE. */
    public static class ReviewConflictException extends IllegalStateException {
        public ReviewConflictException(String id, DocumentStatus status, int expected, int actual) {
            super("Revisión desactualizada para " + id + ": estado=" + status
                    + ", secuencia esperada=" + expected + ", actual=" + actual);
        }

        public BackendErrorCode getErrorCode() { return BackendErrorCode.INVALID_REVIEW_STATE; }
    }
}
