package com.mediflow.backend.persistence;

import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import com.mediflow.backend.enums.StorageState;

import java.util.List;
import java.util.Map;

/**
 * Estado del documento que se confirma en PostgreSQL durante la finalización.
 * <p>
 * Agrupa los campos persistentes del resultado actual (arquitectura §10) que
 * deben actualizarse de forma atómica junto con la entrada de historial.
 * No incluye {@code bucket} ni {@code updated_at}: el bucket no cambia y
 * {@code updated_at} se controla explícitamente con el instante de confirmación.
 */
public record FinalizedDocumentState(
        DocumentStatus status,
        String objectKey,
        StorageState storageState,
        DocumentType documentType,
        String specialty,
        PriorityLevel priority,
        Double confidenceClassification,
        Double confidenceExtraction,
        Double confidenceGlobal,
        PrimaryDestination routingDestination,
        String routingJustification,
        List<AuditReason> auditReasons,
        Map<String, Object> extractedData,
        Map<String, Object> validation,
        Map<String, Object> notification
) {
}
