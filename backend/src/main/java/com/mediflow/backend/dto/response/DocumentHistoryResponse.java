package com.mediflow.backend.dto.response;

import com.mediflow.backend.enums.HumanDecision;
import com.mediflow.backend.enums.TriageEventType;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record DocumentHistoryResponse(String documentId, List<Entry> entries) {

    public record Entry(
            Integer sequence,
            TriageEventType eventType,
            HumanDecision decision,
            Instant occurredAt,
            Map<String, Object> result
    ) {
    }
}
