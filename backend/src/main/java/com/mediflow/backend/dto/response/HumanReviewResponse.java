package com.mediflow.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

public record HumanReviewResponse(
        @JsonProperty("document_id") String documentId,
        String status,
        String message
) {
}
