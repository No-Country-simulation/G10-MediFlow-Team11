package com.mediflow.backend.dto.response;

import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.InputType;

import java.time.Instant;

public record DocumentSelectionResponse(
        String documentId,
        DocumentStatus status,
        InputType inputType,
        String fileName,
        DocumentType documentType,
        Instant createdAt,
        Instant updatedAt
) {
}
