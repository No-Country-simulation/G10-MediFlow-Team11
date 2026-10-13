package com.mediflow.backend.service;

import com.mediflow.backend.enums.DocumentStatus;

import java.time.Instant;

/**
 * Resultado de una finalización confirmada.
 *
 * @param documentId identificador del documento
 * @param status     estado de negocio persistido
 * @param sequence   secuencia de historial asignada
 * @param occurredAt instante de confirmación (coincide con updated_at y occurred_at)
 */
public record FinalizationOutcome(
        String documentId,
        DocumentStatus status,
        int sequence,
        Instant occurredAt
) {
}
