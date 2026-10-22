package com.mediflow.backend.service;

import com.mediflow.backend.dto.response.DocumentoCanonicoResponse;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.entity.DocumentTriageHistory;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.HumanDecision;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import com.mediflow.backend.enums.StorageState;
import com.mediflow.backend.enums.TriageEventType;
import com.mediflow.backend.persistence.DocumentPersistenceService;
import com.mediflow.backend.persistence.DurableCommitInspection;
import com.mediflow.backend.persistence.FinalizedDocumentState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Orquesta la finalización de un resultado de triaje garantizando la
 * consistencia entre PostgreSQL y OCI (arquitectura §11-12).
 * <p>
 * Protocolo de confirmación (en orden), serializado por documento:
 * <ol>
 *   <li>Preparar resultado: definir prefijo destino, claves OCI, snapshot canónico,
 *       artefacto {@code triage.json} e instante de confirmación.</li>
 *   <li>Preparar OCI: copiar original y escribir {@code triage.json} en el
 *       prefijo destino (o retener artefacto previo si el prefijo no cambia).</li>
 *   <li>Confirmar PostgreSQL: actualizar el documento e insertar la entrada de
 *       historial en una única transacción.</li>
 *   <li>Limpiar OCI post-commit: eliminar original y artefacto anteriores.</li>
 * </ol>
 * Una compensación destructiva solo se ejecuta si, con el lock exclusivo aún
 * retenido, la inspección durable demuestra que el intento no se confirmó y
 * que no existe un resultado más reciente.
 */
@Service
public class DocumentFinalizationService {

    private static final Logger log = LoggerFactory.getLogger(DocumentFinalizationService.class);

    private final DocumentPersistenceService persistenceService;
    private final ObjectStorageService storageService;
    private final ObjectKeyGenerator keyGenerator;
    private final DocumentResponseMapper responseMapper;
    private final JsonMapper jsonMapper;
    private final DocumentExclusiveLock exclusiveLock;

    public DocumentFinalizationService(
            DocumentPersistenceService persistenceService,
            ObjectStorageService storageService,
            ObjectKeyGenerator keyGenerator,
            DocumentResponseMapper responseMapper,
            JsonMapper jsonMapper,
            DocumentExclusiveLock exclusiveLock
    ) {
        this.persistenceService = persistenceService;
        this.storageService = storageService;
        this.keyGenerator = keyGenerator;
        this.responseMapper = responseMapper;
        this.jsonMapper = jsonMapper;
        this.exclusiveLock = exclusiveLock;
    }

    public FinalizationOutcome finalizeResult(FinalizationCommand comando) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalTransactionStateException("La finalización debe invocarse sin transacción externa");
        }
        validateCommand(comando);
        return exclusiveLock.execute(comando.documentId(), () -> finalizeLocked(comando));
    }

    private FinalizationOutcome finalizeLocked(FinalizationCommand comando) {
        DocumentRecord document = persistenceService.getDocument(comando.documentId());
        if (comando.eventType() == TriageEventType.INITIAL_TRIAGE && isTerminal(document.getStatus())) {
            throw new InitialTriageConflictException(comando.documentId(), document.getStatus());
        }

        String destinationPrefix = resolvePrefix(comando.status(), comando.priority());
        String extension = keyGenerator.extensionForMime(document.getMimeType());

        String sourceObjectKey = document.getObjectKey();
        String sourceTriageKey = deriveTriageKey(sourceObjectKey);
        String destinationOriginalKey = keyGenerator.originalKey(destinationPrefix, comando.documentId(), extension);
        String destinationTriageKey = keyGenerator.triageKey(destinationPrefix, comando.documentId());
        boolean prefixChanged = !samePrefix(sourceObjectKey, destinationOriginalKey);

        Instant confirmationTime = Instant.now().truncatedTo(ChronoUnit.MICROS);
        int nextSequence = persistenceService.nextSequenceFor(comando.documentId());

        Map<String, Object> canonicalSnapshot = buildCanonicalSnapshot(document, comando, StorageState.SUCCESS);
        String triageJson = buildTriageJson(
                canonicalSnapshot, document.getCreatedAt(), confirmationTime, nextSequence, comando.eventType(), comando.decision());

        // El artefacto anterior se lee ANTES de cualquier escritura OCI para que,
        // si putJson falla, la compensación disponga del contenido previo y pueda
        // restaurarlo. Si se leyera dentro de prepareOci, una excepción en putJson
        // dejaría previousArtifact en UNREAD y la compensación no haría nada.
        PreviousArtifact previousArtifact = prefixChanged
                ? PreviousArtifact.none()
                : readPreviousArtifact(sourceTriageKey);
        FinalizedDocumentState state = buildState(comando, destinationOriginalKey, StorageState.SUCCESS);
        DocumentTriageHistory history;
        Runnable prepareStorage = () -> prepareOci(prefixChanged, sourceObjectKey,
                destinationOriginalKey, destinationTriageKey, triageJson);
        try {
            if (comando.eventType() == TriageEventType.HUMAN_REVIEW) {
                history = persistenceService.commitHumanReview(comando.documentId(),
                        comando.expectedHistorySequence(), prepareStorage, state, comando.decision(),
                        canonicalSnapshot, confirmationTime);
            } else {
                prepareStorage.run();
                history = persistenceService.commitFinalization(comando.documentId(), state, comando.eventType(),
                        comando.decision(), canonicalSnapshot, confirmationTime, nextSequence);
            }
        } catch (DocumentPersistenceService.ReviewConflictException conflict) {
            // Se rechazó antes de cualquier escritura; no compensar objetos de otro resultado.
            throw conflict;
        } catch (ObjectStorageService.StorageOperationException ociError) {
            compensateOciFailure(
                    prefixChanged,
                    sourceTriageKey,
                    destinationOriginalKey,
                    destinationTriageKey,
                    previousArtifact,
                    document.getId()
            );

            if (comando.eventType() == TriageEventType.INITIAL_TRIAGE) {
                return persistStorageFallback(comando, document, ociError);
            }
            throw ociError;
        } catch (RuntimeException pgError) {
            FinalizationOutcome recovered = compensatePgFailure(
                    comando,
                    nextSequence,
                    confirmationTime,
                    prefixChanged,
                    sourceObjectKey,
                    sourceTriageKey,
                    destinationOriginalKey,
                    destinationTriageKey,
                    previousArtifact,
                    pgError
            );
            if (recovered != null) {
                return recovered;
            }
            throw pgError;
        }

        cleanupSupersededCopies(comando.documentId(), prefixChanged, sourceObjectKey, sourceTriageKey);

        return FinalizationOutcome.confirmed(
                comando.documentId(),
                comando.status(),
                nextSequence,
                history.getOccurredAt()
        );
    }

    private boolean isTerminal(DocumentStatus status) {
        return status == DocumentStatus.PROCESSED
                || status == DocumentStatus.APPROVED
                || status == DocumentStatus.REJECTED
                || status == DocumentStatus.FAILED;
    }

    String resolvePrefix(DocumentStatus status, PriorityLevel priority) {
        return switch (status) {
            case PROCESSED, APPROVED -> {
                if (priority == PriorityLevel.URGENT) {
                    yield ObjectKeyGenerator.PREFIJO_URGENTES;
                }
                if (priority == PriorityLevel.ROUTINE) {
                    yield ObjectKeyGenerator.PREFIJO_RUTINA;
                }
                throw new IllegalStateException(
                        "Prioridad obligatoria para determinar prefijo de PROCESSED/APPROVED: " + priority);
            }
            case NEEDS_AUDIT, REJECTED -> ObjectKeyGenerator.PREFIJO_AUDITORIA;
            default -> throw new IllegalStateException(
                    "Estado sin prefijo de finalización: " + status);
        };
    }

    /**
     * Prepara los artefactos en OCI sin destruir el original vigente.
     * El artefacto anterior ya fue leído por {@link #finalizeLocked} y se pasa
     * por referencia fuera de este método; aquí solo se escriben la copia del
     * original (si cambia el prefijo) y el nuevo {@code triage.json}.
     */
    private void prepareOci(
            boolean prefixChanged,
            String sourceObjectKey,
            String destinationOriginalKey,
            String destinationTriageKey,
            String triageJson
    ) {
        if (prefixChanged) {
            storageService.copyWithinBucket(sourceObjectKey, destinationOriginalKey);
        }
        storageService.putJson(destinationTriageKey, triageJson);
    }

    private PreviousArtifact readPreviousArtifact(String triageKey) {
        try {
            String content = new String(storageService.getObject(triageKey), StandardCharsets.UTF_8);
            return PreviousArtifact.present(content);
        } catch (ObjectStorageService.ObjectNotFoundException missing) {
            return PreviousArtifact.absent();
        } catch (ObjectStorageService.StorageOperationException readError) {
            log.error("No se pudo leer el artefacto anterior en {}; se aborta el overwrite", triageKey, readError);
            throw readError;
        }
    }

    private Map<String, Object> buildCanonicalSnapshot(
            DocumentRecord source,
            FinalizationCommand comando,
            StorageState storageState
    ) {
        DocumentRecord view = new DocumentRecord();
        view.setId(comando.documentId());
        view.setStatus(comando.status());
        view.setDocumentType(comando.documentType());
        view.setSpecialty(comando.specialty());
        view.setPriority(comando.priority());
        view.setConfidenceClassification(comando.confidenceClassification());
        view.setConfidenceExtraction(comando.confidenceExtraction());
        view.setConfidenceGlobal(comando.confidenceGlobal());
        view.setRoutingDestination(comando.routingDestination());
        view.setRoutingJustification(comando.routingJustification());
        view.setAuditReasons(comando.auditReasons());
        view.setExtractedData(comando.extractedData());
        view.setValidation(comando.validation());
        view.setNotification(comando.notification());
        view.setStorageState(storageState);
        DocumentoCanonicoResponse canonical = responseMapper.toResponse(view);
        return jsonMapper.convertValue(canonical, new TypeReference<Map<String, Object>>() {});
    }

    private String buildTriageJson(
            Map<String, Object> canonicalSnapshot,
            Instant createdAt,
            Instant updatedAt,
            int sequence,
            TriageEventType eventType,
            HumanDecision decision
    ) {
        Map<String, Object> artifact = new LinkedHashMap<>(canonicalSnapshot);
        artifact.put("sequence", sequence);
        artifact.put("created_at", createdAt.toString());
        artifact.put("updated_at", updatedAt.toString());

        if (eventType == TriageEventType.HUMAN_REVIEW) {
            Map<String, Object> humanReview = new LinkedHashMap<>();
            humanReview.put("decision", decision == null ? null : decision.name());
            artifact.put("human_review", humanReview);
        } else {
            artifact.put("human_review", null);
        }

        try {
            return jsonMapper.writeValueAsString(artifact);
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo serializar triage.json", e);
        }
    }

    private FinalizedDocumentState buildState(
            FinalizationCommand comando,
            String objectKey,
            StorageState storageState
    ) {
        return new FinalizedDocumentState(
                comando.status(),
                objectKey,
                storageState,
                comando.documentType(),
                comando.specialty(),
                comando.priority(),
                comando.confidenceClassification(),
                comando.confidenceExtraction(),
                comando.confidenceGlobal(),
                comando.routingDestination(),
                comando.routingJustification(),
                comando.auditReasons(),
                comando.extractedData(),
                comando.validation(),
                comando.notification()
        );
    }

    private String deriveTriageKey(String objectKey) {
        int lastSlash = objectKey.lastIndexOf('/');
        return objectKey.substring(0, lastSlash + 1) + "triage.json";
    }

    private boolean samePrefix(String sourceKey, String destinationKey) {
        return extractPrefix(sourceKey).equals(extractPrefix(destinationKey));
    }

    private String extractPrefix(String key) {
        int firstSlash = key.indexOf('/');
        if (firstSlash < 0) {
            return key;
        }
        String first = key.substring(0, firstSlash);
        if (first.equals("procesados")) {
            int secondSlash = key.indexOf('/', firstSlash + 1);
            if (secondSlash < 0) {
                return key;
            }
            return key.substring(0, secondSlash);
        }
        return first;
    }

    private void compensateOciFailure(
            boolean prefixChanged,
            String sourceTriageKey,
            String destinationOriginalKey,
            String destinationTriageKey,
            PreviousArtifact previousArtifact,
            String documentId
    ) {
        try {
            if (prefixChanged) {
                safeDelete(destinationOriginalKey);
                safeDelete(destinationTriageKey);
            } else if (previousArtifact.status() != PreviousArtifact.Status.UNREAD) {
                restoreOrRemovePreparedArtifact(sourceTriageKey, previousArtifact, documentId);
            }
        } catch (Exception e) {
            log.error("Error durante compensación de fallo OCI documentId={} destinationTriageKey={}",
                    documentId, destinationTriageKey, e);
        }
    }

    private FinalizationOutcome compensatePgFailure(
            FinalizationCommand comando,
            int expectedNextSequence,
            Instant confirmationTime,
            boolean prefixChanged,
            String sourceObjectKey,
            String sourceTriageKey,
            String destinationOriginalKey,
            String destinationTriageKey,
            PreviousArtifact previousArtifact,
            RuntimeException pgError
    ) {
        DurableCommitInspection inspection;
        try {
            inspection = persistenceService.inspectDurableCommit(comando.documentId(), expectedNextSequence);
        } catch (RuntimeException inspectionError) {
            log.error(
                    "Commit PostgreSQL incierto para {}; no se ejecuta compensación destructiva. "
                            + "Claves afectadas: destinationOriginal={}, destinationTriage={}",
                    comando.documentId(), destinationOriginalKey, destinationTriageKey, inspectionError);
            throw pgError;
        }

        if (inspection == DurableCommitInspection.THIS_ATTEMPT_COMMITTED) {
            log.warn("Commit PostgreSQL reportó error pero la secuencia {} quedó confirmada para {}",
                    expectedNextSequence, comando.documentId());
            cleanupSupersededCopies(comando.documentId(), prefixChanged, sourceObjectKey, sourceTriageKey);
            return FinalizationOutcome.confirmed(
                    comando.documentId(),
                    comando.status(),
                    expectedNextSequence,
                    confirmationTime
            );
        }

        if (inspection != DurableCommitInspection.NOT_COMMITTED) {
            log.warn(
                    "Compensación OCI omitida para {}: inspección={} expectedSequence={}. "
                            + "Un resultado más reciente permanece intacto. Claves no modificadas: {}, {}",
                    comando.documentId(), inspection, expectedNextSequence,
                    destinationOriginalKey, destinationTriageKey
            );
            return null;
        }

        try {
            if (prefixChanged) {
                safeDelete(destinationOriginalKey);
                safeDelete(destinationTriageKey);
            } else {
                restoreOrRemovePreparedArtifact(sourceTriageKey, previousArtifact, comando.documentId());
            }
        } catch (Exception e) {
            log.error("Error durante compensación de fallo PostgreSQL documentId={} keys={}, {}",
                    comando.documentId(), destinationOriginalKey, destinationTriageKey, e);
        }
        if (comando.eventType() == TriageEventType.INITIAL_TRIAGE) {
            try {
                DocumentRecord current = persistenceService.getDocument(comando.documentId());
                if ((current.getStatus() == DocumentStatus.RECEIVED || current.getStatus() == DocumentStatus.PROCESSING)
                        && isOriginalRecoverable(current.getObjectKey())) {
                    persistRecoverableFallback(comando, current,
                            "Fallo de persistencia PostgreSQL durante la finalización; resultado recuperado para revisión", true);
                }
            } catch (RuntimeException fallbackError) {
                if (fallbackError != pgError) pgError.addSuppressed(fallbackError);
                log.error("No se pudo confirmar el fallback de persistencia para {}; se conserva el último estado durable",
                        comando.documentId(), fallbackError);
            }
        }
        // Incluso con fallback durable, #25 debe conservar HTTP 500 PERSISTENCE_ERROR.
        return null;
    }

    private void restoreOrRemovePreparedArtifact(
            String triageKey,
            PreviousArtifact previousArtifact,
            String documentId
    ) {
        if (previousArtifact.status() == PreviousArtifact.Status.UNREAD) {
            log.error("Compensación abortada para {}: el artefacto anterior no se leyó de forma fiable; clave={}",
                    documentId, triageKey);
            markStorageErrorQuietly(documentId);
            return;
        }
        if (previousArtifact.status() == PreviousArtifact.Status.PRESENT) {
            try {
                storageService.putJson(triageKey, previousArtifact.content());
            } catch (ObjectStorageService.StorageOperationException restoreError) {
                log.error("No se pudo restaurar el artefacto anterior documentId={} key={}",
                        documentId, triageKey, restoreError);
                markStorageErrorQuietly(documentId);
            }
            return;
        }
        if (!safeDelete(triageKey)) {
            markStorageErrorQuietly(documentId);
        }
    }

    private void markStorageErrorQuietly(String documentId) {
        try {
            persistenceService.markStorageErrorPreservingResult(documentId);
        } catch (RuntimeException e) {
            log.error("No se pudo marcar storage_state=ERROR para {}", documentId, e);
        }
    }

    private boolean safeDelete(String key) {
        try {
            storageService.deleteObject(key);
            return true;
        } catch (ObjectStorageService.StorageOperationException e) {
            log.warn("No se pudo eliminar objeto OCI {} durante compensación", key, e);
            return false;
        }
    }

    private void cleanupSupersededCopies(
            String documentId,
            boolean prefixChanged,
            String sourceObjectKey,
            String sourceTriageKey
    ) {
        if (prefixChanged) {
            safeDeleteAfterCommit(documentId, sourceObjectKey);
            safeDeleteAfterCommit(documentId, sourceTriageKey);
        }
    }

    private void safeDeleteAfterCommit(String documentId, String key) {
        try {
            storageService.deleteObject(key);
        } catch (ObjectStorageService.StorageOperationException e) {
            log.warn(
                    "Limpieza post-commit pendiente para {} clave={}; el resultado confirmado se conserva",
                    documentId, key, e);
        }
    }

    private FinalizationOutcome persistStorageFallback(
            FinalizationCommand comando,
            DocumentRecord document,
            ObjectStorageService.StorageOperationException cause
    ) {
        boolean originalRecoverable = isOriginalRecoverable(document.getObjectKey());
        if (!originalRecoverable) {
            return persistUnrecoverable(comando, document, cause);
        }

        log.warn("Fallo OCI en finalización inicial para {}; aplicando fallback NEEDS_AUDIT con original recuperable",
                comando.documentId(), cause);

        FallbackCommit fallback = persistRecoverableFallback(comando, document,
                "Fallo de almacenamiento OCI durante la finalización", false);
        return FinalizationOutcome.fallbackDurable(comando.documentId(), fallback.sequence(),
                fallback.occurredAt(), true, fallback.artifactWritten());
    }

    private FallbackCommit persistRecoverableFallback(
            FinalizationCommand comando, DocumentRecord document, String justification, boolean persistenceRecovery
    ) {

        Instant fallbackTime = Instant.now().truncatedTo(ChronoUnit.MICROS);
        int fallbackSequence = persistenceService.nextSequenceFor(comando.documentId());

        FinalizationCommand fallbackCommand = new FinalizationCommand(
                comando.documentId(),
                DocumentStatus.NEEDS_AUDIT,
                comando.documentType(),
                comando.specialty(),
                comando.priority(),
                comando.confidenceClassification(),
                comando.confidenceExtraction(),
                comando.confidenceGlobal(),
                PrimaryDestination.HUMAN_REVIEW,
                justification,
                comando.auditReasons(),
                comando.extractedData(),
                comando.validation(),
                DocumentRecord.defaultNotification(),
                comando.eventType(),
                null,
                null
        );

        String fallbackTriageKey = deriveTriageKey(document.getObjectKey());
        PreviousArtifact previousArtifact = readPreviousArtifactForFallback(fallbackTriageKey);
        boolean artifactAttempted = previousArtifact.status() != PreviousArtifact.Status.UNREAD;
        StorageState fallbackStorage = persistenceRecovery && artifactAttempted ? StorageState.SUCCESS : StorageState.ERROR;
        Map<String, Object> fallbackSnapshot = buildCanonicalSnapshot(document, fallbackCommand, fallbackStorage);
        boolean artifactWritten = artifactAttempted
                && tryWriteFallbackArtifact(document, fallbackSnapshot, fallbackTime, fallbackSequence);
        if (persistenceRecovery && !artifactWritten && fallbackStorage == StorageState.SUCCESS) {
            fallbackStorage = StorageState.ERROR;
            fallbackSnapshot = buildCanonicalSnapshot(document, fallbackCommand, fallbackStorage);
            artifactWritten = tryWriteFallbackArtifact(document, fallbackSnapshot, fallbackTime, fallbackSequence);
        }
        FinalizedDocumentState fallbackState = buildState(fallbackCommand, document.getObjectKey(), fallbackStorage);

        DocumentTriageHistory history;
        try {
            history = persistenceService.commitFinalization(
                    comando.documentId(),
                    fallbackState,
                    comando.eventType(),
                    null,
                    fallbackSnapshot,
                    fallbackTime,
                    fallbackSequence
            );
        } catch (RuntimeException persistenceError) {
            log.error("No se pudo persistir el fallback NEEDS_AUDIT para {}; no se afirma transición durable",
                    comando.documentId(), persistenceError);
            // Un error de respuesta OCI no demuestra que el objeto no se haya escrito.
            if (artifactAttempted
                    && compensateFallbackArtifact(comando.documentId(), fallbackSequence, fallbackTriageKey, previousArtifact)) {
                return new FallbackCommit(fallbackSequence, fallbackTime, artifactWritten);
            }
            throw persistenceError;
        }

        return new FallbackCommit(fallbackSequence, history.getOccurredAt(), artifactWritten);
    }

    private record FallbackCommit(int sequence, Instant occurredAt, boolean artifactWritten) {}

    /**
     * Compensa el {@code triage.json} de fallback cuando PostgreSQL no confirmó su
     * transición (arquitectura §12.4). Solo restaura o elimina el artefacto si la
     * inspección durable demuestra que este intento no se confirmó.
     *
     * @return {@code true} si la inspección demuestra que el fallback sí quedó
     *         confirmado (commit incierto), por lo que el artefacto se conserva.
     */
    private boolean compensateFallbackArtifact(
            String documentId,
            int fallbackSequence,
            String fallbackTriageKey,
            PreviousArtifact previousArtifact
    ) {
        DurableCommitInspection inspection;
        try {
            inspection = persistenceService.inspectDurableCommit(documentId, fallbackSequence);
        } catch (RuntimeException inspectionError) {
            log.error("Commit PostgreSQL del fallback incierto para {}; se conserva el artefacto {} "
                            + "para conciliación manual", documentId, fallbackTriageKey, inspectionError);
            return false;
        }

        if (inspection == DurableCommitInspection.THIS_ATTEMPT_COMMITTED) {
            log.warn("Commit del fallback reportó error pero la secuencia {} quedó confirmada para {}",
                    fallbackSequence, documentId);
            return true;
        }
        if (inspection != DurableCommitInspection.NOT_COMMITTED) {
            log.warn("Compensación del fallback omitida para {}: inspección={} expectedSequence={}; clave no modificada: {}",
                    documentId, inspection, fallbackSequence, fallbackTriageKey);
            return false;
        }

        try {
            restoreOrRemovePreparedArtifact(fallbackTriageKey, previousArtifact, documentId);
        } catch (Exception e) {
            log.error("Error durante compensación del artefacto de fallback documentId={} key={}",
                    documentId, fallbackTriageKey, e);
        }
        return false;
    }

    private PreviousArtifact readPreviousArtifactForFallback(String triageKey) {
        try {
            return readPreviousArtifact(triageKey);
        } catch (ObjectStorageService.StorageOperationException readError) {
            log.warn("Artefacto de fallback no escrito para {}: no se pudo leer el artefacto vigente y no podría restaurarse",
                    triageKey);
            return PreviousArtifact.none();
        }
    }

    private FinalizationOutcome persistUnrecoverable(
            FinalizationCommand comando,
            DocumentRecord document,
            ObjectStorageService.StorageOperationException cause
    ) {
        log.error("Original irrecuperable durante finalización inicial de {}; se registra FAILED",
                comando.documentId(), cause);

        Instant failedTime = Instant.now().truncatedTo(ChronoUnit.MICROS);
        int sequence = persistenceService.nextSequenceFor(comando.documentId());

        FinalizationCommand failedCommand = new FinalizationCommand(
                comando.documentId(),
                DocumentStatus.FAILED,
                comando.documentType(),
                comando.specialty(),
                comando.priority(),
                comando.confidenceClassification(),
                comando.confidenceExtraction(),
                comando.confidenceGlobal(),
                PrimaryDestination.HUMAN_REVIEW,
                "Original irrecuperable tras fallo de almacenamiento OCI",
                comando.auditReasons(),
                comando.extractedData(),
                comando.validation(),
                DocumentRecord.defaultNotification(),
                comando.eventType(),
                null,
                null
        );

        FinalizedDocumentState failedState = buildState(
                failedCommand, document.getObjectKey(), StorageState.ERROR);
        Map<String, Object> snapshot = buildCanonicalSnapshot(document, failedCommand, StorageState.ERROR);

        DocumentTriageHistory history;
        try {
            history = persistenceService.commitFinalization(
                    comando.documentId(),
                    failedState,
                    comando.eventType(),
                    null,
                    snapshot,
                    failedTime,
                    sequence
            );
        } catch (RuntimeException persistenceError) {
            log.error("No se pudo persistir FAILED para {}; no se afirma transición durable",
                    comando.documentId(), persistenceError);
            throw persistenceError;
        }

        return FinalizationOutcome.failedUnrecoverable(
                comando.documentId(), sequence, history.getOccurredAt());
    }

    private boolean tryWriteFallbackArtifact(
            DocumentRecord document,
            Map<String, Object> snapshot,
            Instant fallbackTime,
            int sequence
    ) {
        String fallbackTriageKey = deriveTriageKey(document.getObjectKey());
        String json = buildTriageJson(
                snapshot, document.getCreatedAt(), fallbackTime, sequence, TriageEventType.INITIAL_TRIAGE, null);
        try {
            storageService.putJson(fallbackTriageKey, json);
            return true;
        } catch (ObjectStorageService.StorageOperationException e) {
            log.warn("No se pudo confirmar la escritura del triage.json de fallback para {} clave={}",
                    document.getId(), fallbackTriageKey, e);
            return false;
        }
    }

    private boolean isOriginalRecoverable(String objectKey) {
        try {
            storageService.getObject(objectKey);
            return true;
        } catch (ObjectStorageService.ObjectNotFoundException missing) {
            return false;
        } catch (ObjectStorageService.StorageOperationException e) {
            log.error("No se pudo comprobar recuperabilidad del original {}; se trata como recuperable para no marcar FAILED sin evidencia",
                    objectKey, e);
            return true;
        }
    }

    private void validateCommand(FinalizationCommand comando) {
        if (comando == null) {
            throw new IllegalArgumentException("El comando de finalización es obligatorio");
        }
        if (comando.documentId() == null || comando.documentId().isBlank()) {
            throw new IllegalArgumentException("documentId es obligatorio");
        }
        if (comando.status() == null) {
            throw new IllegalArgumentException("status es obligatorio");
        }
        if (comando.eventType() == null) {
            throw new IllegalArgumentException("eventType es obligatorio");
        }
        if (comando.eventType() == TriageEventType.HUMAN_REVIEW && comando.decision() == null) {
            throw new IllegalArgumentException("HUMAN_REVIEW requiere decision");
        }
        if (comando.eventType() == TriageEventType.HUMAN_REVIEW) {
            if (comando.expectedHistorySequence() == null || comando.expectedHistorySequence() < 0) {
                throw new IllegalArgumentException("HUMAN_REVIEW requiere la secuencia base del historial");
            }
            DocumentStatus expectedStatus = comando.decision() == HumanDecision.APPROVE
                    ? DocumentStatus.APPROVED : DocumentStatus.REJECTED;
            if (comando.status() != expectedStatus) {
                throw new IllegalArgumentException("Estado incompatible con la decisión humana");
            }
        }
        if (comando.eventType() == TriageEventType.INITIAL_TRIAGE && comando.decision() != null) {
            throw new IllegalArgumentException("INITIAL_TRIAGE no admite decision");
        }
        if (comando.routingDestination() == null) {
            throw new IllegalArgumentException("routingDestination es obligatorio");
        }
        resolvePrefix(comando.status(), comando.priority());
    }

    private record PreviousArtifact(Status status, String content) {
        enum Status { UNREAD, ABSENT, PRESENT }

        static PreviousArtifact none() {
            return new PreviousArtifact(Status.UNREAD, null);
        }

        static PreviousArtifact absent() {
            return new PreviousArtifact(Status.ABSENT, null);
        }

        static PreviousArtifact present(String content) {
            return new PreviousArtifact(Status.PRESENT, content);
        }
    }

    /** Un resultado inicial no puede reemplazar un estado terminal confirmado. */
    public static class InitialTriageConflictException extends IllegalStateException {
        public InitialTriageConflictException(String documentId, DocumentStatus currentStatus) {
            super("Finalización inicial rechazada para " + documentId + ": estado terminal " + currentStatus);
        }
    }
}
