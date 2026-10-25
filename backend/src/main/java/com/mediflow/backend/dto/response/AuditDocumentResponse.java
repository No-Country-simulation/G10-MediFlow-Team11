package com.mediflow.backend.dto.response;

import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.InputType;

import java.time.Instant;
import java.util.List;

public record AuditDocumentResponse(
        String documentId,
        DocumentStatus status,
        InputType inputType,
        String mimeType,
        String fileName,
        DocumentType documentType,
        List<AuditReason> auditReasons,
        Instant createdAt,
        Instant updatedAt
) {
}
