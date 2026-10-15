package com.mediflow.backend.service;

import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.HumanDecision;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import com.mediflow.backend.enums.TriageEventType;

import java.util.List;
import java.util.Map;

/**
 * Comando de finalización: describe el resultado confirmado que debe persistirse
 * en PostgreSQL y materializarse en OCI (arquitectura §12).
 * <p>
 * Lo consumen los flujos de procesamiento inicial (Issue #25) y revisión humana
 * (Issue #71); este servicio solo orquesta la finalización, no sus endpoints.
 * El consumidor no debe abrir una transacción alrededor del finalizador.
 * #71 aplica el merge/validación clínica sobre una versión del historial y envía
 * esa secuencia como precondición; #31 revalida estado y versión antes de OCI.
 * <p>
 * Precondiciones pendientes de los consumidores:
 * <ul>
 *   <li>#25: invocar {@code INITIAL_TRIAGE} una sola vez por documento y solo desde
 *       {@code RECEIVED}/{@code PROCESSING}. El finalizador no comprueba el estado previo
 *       de un resultado inicial: un segundo comando añadiría otro {@code INITIAL_TRIAGE} y
 *       sobrescribiría el resultado vigente, incluida una decisión humana terminal.</li>
 *   <li>#71: leer documento e historial como una sola versión, derivar de ella
 *       {@code expectedHistorySequence} sin reemplazarla por una lectura posterior y traducir
 *       {@code ReviewConflictException} a {@code 409 INVALID_REVIEW_STATE}.</li>
 * </ul>
 *
 * @param documentId           identificador público del documento
 * @param status                estado de negocio final del resultado
 * @param documentType          tipo de documento (nullable si IA no respondió)
 * @param specialty             especialidad (nullable)
 * @param priority              prioridad (nullable; obligatoria para PROCESSED/APPROVED)
 * @param confidenceClassification confianza de clasificación (nullable)
 * @param confidenceExtraction   confianza de extracción (nullable)
 * @param confidenceGlobal       confianza global (nullable)
 * @param routingDestination    destino de negocio confirmado
 * @param routingJustification  justificación del enrutamiento
 * @param auditReasons          motivos de auditoría (pueden ser históricos)
 * @param extractedData         datos extraídos (JSONB, nullable)
 * @param validation            validación (JSONB, nullable)
 * @param notification          notificación (JSONB)
 * @param eventType             INITIAL_TRIAGE o HUMAN_REVIEW
 * @param decision              null para INITIAL_TRIAGE; APPROVE/REJECT para HUMAN_REVIEW
 * @param expectedHistorySequence secuencia base obligatoria para HUMAN_REVIEW; null para INITIAL_TRIAGE
 */
public record FinalizationCommand(
        String documentId,
        DocumentStatus status,
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
        Map<String, Object> notification,
        TriageEventType eventType,
        HumanDecision decision,
        Integer expectedHistorySequence
) {
}
