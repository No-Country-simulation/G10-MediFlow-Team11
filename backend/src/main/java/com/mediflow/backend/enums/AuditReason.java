package com.mediflow.backend.enums;

/**
 * Motivos de auditoría (arquitectura §8). No se admiten valores fuera de este enum.
 * IA Core solo reporta los cuatro motivos semánticos; los técnicos los incorpora el Backend.
 */
public enum AuditReason {
    LOW_CONFIDENCE,
    ILLEGIBLE_DOCUMENT,
    MISSING_CRITICAL_FIELDS,
    INCONSISTENT_DATA,
    INVALID_AI_RESPONSE,
    AI_TIMEOUT,
    AI_UNAVAILABLE;

    public boolean isSemantic() {
        return this == LOW_CONFIDENCE
                || this == ILLEGIBLE_DOCUMENT
                || this == MISSING_CRITICAL_FIELDS
                || this == INCONSISTENT_DATA;
    }

    public boolean isTechnical() {
        return this == INVALID_AI_RESPONSE
                || this == AI_TIMEOUT
                || this == AI_UNAVAILABLE;
    }
}
