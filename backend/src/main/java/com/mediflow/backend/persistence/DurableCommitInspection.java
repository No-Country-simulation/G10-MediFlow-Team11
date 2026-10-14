package com.mediflow.backend.persistence;

/**
 * Resultado de consultar el estado durable de un intento de finalización
 * después de un commit PostgreSQL fallido o incierto (arquitectura §12.4).
 */
public enum DurableCommitInspection {
    DOCUMENT_MISSING,
    NOT_COMMITTED,
    THIS_ATTEMPT_COMMITTED,
    NEWER_CONFIRMED
}
