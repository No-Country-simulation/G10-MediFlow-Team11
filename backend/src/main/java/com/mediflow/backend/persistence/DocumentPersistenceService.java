package com.mediflow.backend.persistence;

import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.entity.DocumentTriageHistory;
import com.mediflow.backend.entity.DocumentTriageHistoryId;
import com.mediflow.backend.enums.HumanDecision;
import com.mediflow.backend.enums.TriageEventType;
import com.mediflow.backend.repository.DocumentRepository;
import com.mediflow.backend.repository.DocumentTriageHistoryRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

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
    public DocumentRecord getDocument(String documentId) {
        return documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Documento no encontrado: " + documentId));
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
}
