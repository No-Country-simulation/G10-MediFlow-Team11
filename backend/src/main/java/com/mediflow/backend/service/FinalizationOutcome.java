package com.mediflow.backend.service;

import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.StorageState;

import java.time.Instant;

/**
 * Resultado de una finalización. Distingue persistencia PostgreSQL durable
 * de persistencia OCI completa (arquitectura §12.3).
 * <p>
 * El llamador HTTP (Issues #25/#71) debe traducir {@link Kind#FALLBACK_DURABLE}
 * y {@link Kind#FAILED_UNRECOVERABLE} a {@code 500 STORAGE_ERROR}: el fallback
 * quedó en PostgreSQL, pero no se promete persistencia OCI completa.
 * {@link Kind#CONFIRMED} es el único caso con {@code storage_state = SUCCESS}
 * y artefacto vigente alineado.
 *
 * @param documentId                identificador del documento
 * @param status                    estado de negocio persistido, si hubo persistencia
 * @param sequence                  secuencia de historial asignada, o {@code 0} si no hubo persistencia
 * @param occurredAt                instante de confirmación PostgreSQL, o {@code null}
 * @param storageState              estado de almacenamiento persistido, o {@code null}
 * @param persistenceConfirmed      {@code true} si resultado e historial se confirmaron
 * @param storageArtifactConfirmed  {@code true} si {@code triage.json} vigente se escribió
 * @param originalRecoverable       {@code true} si el original referenciado sigue accesible
 * @param kind                      clasificación del desenlace para el contrato HTTP
 */
public record FinalizationOutcome(
        String documentId,
        DocumentStatus status,
        int sequence,
        Instant occurredAt,
        StorageState storageState,
        boolean persistenceConfirmed,
        boolean storageArtifactConfirmed,
        boolean originalRecoverable,
        Kind kind
) {

    public enum Kind {
        CONFIRMED,
        FALLBACK_DURABLE,
        FAILED_UNRECOVERABLE
    }

    public static FinalizationOutcome confirmed(
            String documentId,
            DocumentStatus status,
            int sequence,
            Instant occurredAt
    ) {
        return new FinalizationOutcome(
                documentId,
                status,
                sequence,
                occurredAt,
                StorageState.SUCCESS,
                true,
                true,
                true,
                Kind.CONFIRMED
        );
    }

    public static FinalizationOutcome fallbackDurable(
            String documentId,
            int sequence,
            Instant occurredAt,
            boolean originalRecoverable,
            boolean artifactWritten
    ) {
        return new FinalizationOutcome(
                documentId,
                DocumentStatus.NEEDS_AUDIT,
                sequence,
                occurredAt,
                StorageState.ERROR,
                true,
                artifactWritten,
                originalRecoverable,
                Kind.FALLBACK_DURABLE
        );
    }

    public static FinalizationOutcome failedUnrecoverable(
            String documentId,
            int sequence,
            Instant occurredAt
    ) {
        return new FinalizationOutcome(
                documentId,
                DocumentStatus.FAILED,
                sequence,
                occurredAt,
                StorageState.ERROR,
                true,
                false,
                false,
                Kind.FAILED_UNRECOVERABLE
        );
    }
}
