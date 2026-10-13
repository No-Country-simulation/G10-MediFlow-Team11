package com.mediflow.backend.service;

import com.mediflow.backend.dto.response.DocumentoCanonicoResponse;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.entity.DocumentTriageHistory;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Orquesta la finalización de un resultado de triaje garantizando la
 * consistencia entre PostgreSQL y OCI (arquitectura §11-12).
 * <p>
 * Protocolo de confirmación (en orden):
 * <ol>
 *   <li>Preparar resultado: definir prefijo destino, claves OCI, snapshot canónico,
 *       artefacto {@code triage.json} e instante de confirmación.</li>
 *   <li>Preparar OCI: copiar original y escribir {@code triage.json} en el
 *       prefijo destino (o retener artefacto previo si el prefijo no cambia).</li>
 *   <li>Confirmar PostgreSQL: actualizar el documento e insertar la entrada de
 *       historial en una única transacción.</li>
 *   <li>Limpiar OCI post-commit: eliminar original y artefacto anteriores.</li>
 * </ol>
 * Las compensaciones ante fallos de OCI o PostgreSQL protegen resultados más
 * recientes mediante verificación de secuencia de historial.
 */
@Service
public class DocumentFinalizationService {

    private static final Logger log = LoggerFactory.getLogger(DocumentFinalizationService.class);

    private final DocumentPersistenceService persistenceService;
    private final ObjectStorageService storageService;
    private final ObjectKeyGenerator keyGenerator;
    private final DocumentResponseMapper responseMapper;
    private final JsonMapper jsonMapper;

    public DocumentFinalizationService(
            DocumentPersistenceService persistenceService,
            ObjectStorageService storageService,
            ObjectKeyGenerator keyGenerator,
            DocumentResponseMapper responseMapper,
            JsonMapper jsonMapper
    ) {
        this.persistenceService = persistenceService;
        this.storageService = storageService;
        this.keyGenerator = keyGenerator;
        this.responseMapper = responseMapper;
        this.jsonMapper = jsonMapper;
    }

    /**
     * Finaliza un resultado de triaje confirmado.
     *
     * @param comando resultado a confirmar
     * @return resultado de la finalización
     */
    public FinalizationOutcome finalizeResult(FinalizationCommand comando) {
        validateCommand(comando);

        DocumentRecord document = persistenceService.getDocument(comando.documentId());

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
        String triageJson = buildTriageJson(canonicalSnapshot, document.getCreatedAt(), confirmationTime, nextSequence, comando.eventType(), comando.decision());

        // Paso 2: Preparar OCI
        String previousTriageContent = null;
        boolean ociPrepared = false;
        try {
            if (prefixChanged) {
                storageService.copyWithinBucket(sourceObjectKey, destinationOriginalKey);
                storageService.putJson(destinationTriageKey, triageJson);
            } else {
                    previousTriageContent = readExistingTriageOrNull(sourceTriageKey);
                    storageService.putJson(destinationTriageKey, triageJson);
                }
                ociPrepared = true;
            } catch (ObjectStorageService.StorageOperationException ociError) {
                compensateOciFailure(prefixChanged, sourceTriageKey, destinationOriginalKey, destinationTriageKey, previousTriageContent);

                if (comando.eventType() == TriageEventType.INITIAL_TRIAGE) {
                    return persistFallback(comando, document, ociError);
                }
                throw ociError;
            }

            // Paso 3: Confirmar PostgreSQL
            FinalizedDocumentState state = buildState(comando, destinationOriginalKey, StorageState.SUCCESS);
            DocumentTriageHistory history;
            try {
                history = persistenceService.commitFinalization(
                        comando.documentId(),
                        state,
                        comando.eventType(),
                        comando.decision(),
                        canonicalSnapshot,
                        confirmationTime,
                        nextSequence
                );
            } catch (RuntimeException pgError) {
                compensatePgFailure(comando.documentId(), nextSequence, prefixChanged,
                        sourceObjectKey, sourceTriageKey, destinationOriginalKey, destinationTriageKey, previousTriageContent);
                throw pgError;
            }

            // Paso 4: Limpiar OCI post-commit
            if (prefixChanged) {
                safeDelete(sourceObjectKey);
                safeDelete(sourceTriageKey);
            }

            return new FinalizationOutcome(
                    comando.documentId(),
                    comando.status(),
                    nextSequence,
                    history.getOccurredAt()
            );
        }

    // ── Resolución de prefijo (arquitectura §11) ──────────────────────────

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

    // ── Construcción del snapshot canónico y artefacto ───────────────────────

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
        return jsonMapper.convertValue(canonical, Map.class);
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

    // ── Construcción del estado a persistir ────────────────────────────────

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

    // ── Utilidades de claves y prefijos ──────────────────────────────────

    private String deriveTriageKey(String objectKey) {
        int lastSlash = objectKey.lastIndexOf('/');
        return objectKey.substring(0, lastSlash + 1) + "triage.json";
    }

    private boolean samePrefix(String sourceKey, String destinationKey) {
        String sourcePrefix = extractPrefix(sourceKey);
        String destinationPrefix = extractPrefix(destinationKey);
        return sourcePrefix.equals(destinationPrefix);
    }

    private String extractPrefix(String key) {
        int firstSlash = key.indexOf('/');
        if (firstSlash < 0) {
            return key;
        }
        String first = key.substring(0, firstSlash);
        if (first.equals("procesados")) {
            int secondSlash = key.indexOf('/', firstSlash + 1);
            return key.substring(0, secondSlash);
        }
        return first;
    }

    private String readExistingTriageOrNull(String triageKey) {
        try {
            return new String(storageService.getObject(triageKey), StandardCharsets.UTF_8);
        } catch (ObjectStorageService.StorageOperationException ignored) {
            return null;
        }
    }

    // ── Compensaciones (arquitectura §12.4) ──────────────────────────────

    private void compensateOciFailure(
            boolean prefixChanged,
            String sourceTriageKey,
            String destinationOriginalKey,
            String destinationTriageKey,
            String previousTriageContent
    ) {
        try {
            if (prefixChanged) {
                safeDelete(destinationOriginalKey);
                safeDelete(destinationTriageKey);
            } else if (previousTriageContent != null) {
                try {
                    storageService.putJson(sourceTriageKey, previousTriageContent);
                } catch (ObjectStorageService.StorageOperationException restoreError) {
                    log.error("No se pudo restaurar el artefacto anterior en {}", sourceTriageKey, restoreError);
                }
            }
        } catch (Exception e) {
            log.error("Error durante compensación de fallo OCI", e);
        }
    }

    private void compensatePgFailure(
            String documentId,
            int expectedNextSequence,
            boolean prefixChanged,
            String sourceObjectKey,
            String sourceTriageKey,
            String destinationOriginalKey,
            String destinationTriageKey,
            String previousTriageContent
    ) {
        boolean safe = persistenceService.isCompensationSafe(documentId, expectedNextSequence);
        if (!safe) {
            log.warn(
                    "Compensación OCI omitida para {}: se detectó un resultado más reciente (secuencia >= {})",
                    documentId, expectedNextSequence
            );
            return;
        }

        try {
            if (prefixChanged) {
                safeDelete(destinationOriginalKey);
                safeDelete(destinationTriageKey);
            } else if (previousTriageContent != null) {
                try {
                    storageService.putJson(sourceTriageKey, previousTriageContent);
                } catch (ObjectStorageService.StorageOperationException restoreError) {
                    log.error("No se pudo restaurar el artefacto anterior en {}", sourceTriageKey, restoreError);
                }
            }
        } catch (Exception e) {
            log.error("Error durante compensación de fallo PostgreSQL", e);
        }
    }

    private void safeDelete(String key) {
        try {
            storageService.deleteObject(key);
        } catch (ObjectStorageService.StorageOperationException e) {
            log.warn("No se pudo eliminar objeto OCI {} durante limpieza", key, e);
        }
    }

    // ── Fallback para triaje inicial (arquitectura §12.3) ─────────────

    private FinalizationOutcome persistFallback(
            FinalizationCommand comando,
            DocumentRecord document,
            ObjectStorageService.StorageOperationException cause
    ) {
        log.warn("Fallo OCI en finalización inicial para {}; aplicando fallback NEEDS_AUDIT",
                comando.documentId(), cause);

        Instant fallbackTime = Instant.now().truncatedTo(ChronoUnit.MICROS);
        int fallbackSequence = persistenceService.nextSequenceFor(comando.documentId());

        Map<String, Object> notification = comando.notification() != null
                ? comando.notification()
                : DocumentRecord.defaultNotification();

        FinalizedDocumentState fallbackState = new FinalizedDocumentState(
                DocumentStatus.NEEDS_AUDIT,
                document.getObjectKey(),
                StorageState.ERROR,
                comando.documentType(),
                comando.specialty(),
                comando.priority(),
                comando.confidenceClassification(),
                comando.confidenceExtraction(),
                comando.confidenceGlobal(),
                PrimaryDestination.HUMAN_REVIEW,
                "Fallo de almacenamiento OCI durante la finalización: " + cause.getMessage(),
                comando.auditReasons(),
                comando.extractedData(),
                comando.validation(),
                notification
        );

        Map<String, Object> fallbackSnapshot = buildCanonicalSnapshot(document,
                new FinalizationCommand(
                        comando.documentId(), DocumentStatus.NEEDS_AUDIT,
                        comando.documentType(), comando.specialty(), comando.priority(),
                        comando.confidenceClassification(), comando.confidenceExtraction(), comando.confidenceGlobal(),
                        PrimaryDestination.HUMAN_REVIEW, fallbackState.routingJustification(),
                        comando.auditReasons(), comando.extractedData(), comando.validation(),
                        notification, comando.eventType(), null
                ),
                StorageState.ERROR
        );

        DocumentTriageHistory history = persistenceService.commitFinalization(
                comando.documentId(),
                fallbackState,
                comando.eventType(),
                null,
                fallbackSnapshot,
                fallbackTime,
                fallbackSequence
        );

        return new FinalizationOutcome(
                comando.documentId(),
                DocumentStatus.NEEDS_AUDIT,
                fallbackSequence,
                history.getOccurredAt()
        );
    }

    // ── Validaciones ──────────────────────────────────────────────────────

    private void validateCommand(FinalizationCommand comando) {
        if (comando == null) {
            throw new IllegalArgumentException("El comando de finalización es obligatorio");
        }
        if (comando.documentId() == null || comando.documentId().isBlank()) {
            throw new IllegalArgumentException("documentId es obligatorio");
        }
        if (comando.eventType() == null) {
            throw new IllegalArgumentException("eventType es obligatorio");
        }
        if (comando.eventType() == TriageEventType.HUMAN_REVIEW && comando.decision() == null) {
            throw new IllegalArgumentException("HUMAN_REVIEW requiere decision");
        }
        if (comando.eventType() == TriageEventType.INITIAL_TRIAGE && comando.decision() != null) {
            throw new IllegalArgumentException("INITIAL_TRIAGE no admite decision");
        }
        if (comando.routingDestination() == null) {
            throw new IllegalArgumentException("routingDestination es obligatorio");
        }
    }
}
