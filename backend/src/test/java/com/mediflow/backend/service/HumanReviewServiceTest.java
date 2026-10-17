package com.mediflow.backend.service;

import com.mediflow.backend.dto.request.HumanReviewRequest;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.persistence.DocumentPersistenceService;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class HumanReviewServiceTest {
    private final DocumentPersistenceService persistence = mock(DocumentPersistenceService.class);
    private final DocumentFinalizationService finalizer = mock(DocumentFinalizationService.class);
    private final HumanReviewService service = new HumanReviewService(persistence, finalizer);
    private final DocumentRecord document = new DocumentRecord();

    @BeforeEach
    void setUp() {
        document.setId("DOC-71");
        document.setStatus(DocumentStatus.NEEDS_AUDIT);
        document.setDocumentType(DocumentType.IMAGING_REPORT);
        document.setSpecialty("Radiología");
        document.setPriority(PriorityLevel.ROUTINE);
        document.setRoutingDestination(PrimaryDestination.MEDICAL_RECORD);
        document.setRoutingJustification("Pendiente de revisión");
        document.setExtractedData(new LinkedHashMap<>(Map.of("patient", Map.of("age", 40))));
        document.setValidation(new LinkedHashMap<>(Map.of("missing_fields", List.of(), "inconsistencies", List.of(), "warnings", List.of())));
        when(persistence.findDocument("DOC-71")).thenReturn(Optional.of(document));
        when(persistence.listHistory("DOC-71")).thenReturn(List.of());
        when(finalizer.finalizeResult(any())).thenReturn(FinalizationOutcome.confirmed("DOC-71", DocumentStatus.APPROVED, 1, java.time.Instant.now()));
    }

    @Test
    void approveMergesPartialCorrectionAndBuildsHumanReviewCommand() {
        HumanReviewRequest request = request(Map.of(
                "classification", Map.of("priority_level", "URGENT"),
                "validation", Map.of("missing_fields", List.of(), "inconsistencies", List.of(), "warnings", List.of("Revisado")),
                "decision", "APPROVE"));

        service.review("DOC-71", request);

        var command = captureCommand();
        assertEquals(DocumentStatus.APPROVED, command.status());
        assertEquals(DocumentType.IMAGING_REPORT, command.documentType());
        assertEquals(PriorityLevel.URGENT, command.priority());
        assertEquals(PrimaryDestination.MEDICAL_RECORD, command.routingDestination());
        assertEquals(Map.of("patient", Map.of("age", 40)), command.extractedData());
        assertEquals(List.of("Revisado"), command.validation().get("warnings"));
        assertEquals(0, command.expectedHistorySequence());
        assertEquals(com.mediflow.backend.enums.TriageEventType.HUMAN_REVIEW, command.eventType());
    }

    @Test
    void rejectDoesNotRequireClinicalFieldsOrValidation() {
        document.setDocumentType(null);
        document.setPriority(null);
        document.setExtractedData(null);
        document.setValidation(null);
        HumanReviewRequest request = request(Map.of("decision", "REJECT"));

        service.review("DOC-71", request);

        var command = captureCommand();
        assertEquals(DocumentStatus.REJECTED, command.status());
        assertNull(command.documentType());
        assertNull(command.priority());
        assertNull(command.extractedData());
        assertNull(command.validation());
    }

    @Test
    void readsHistorySequenceBeforeDocumentSnapshot() {
        service.review("DOC-71", request(Map.of("decision", "REJECT")));

        var order = inOrder(persistence);
        order.verify(persistence).listHistory("DOC-71");
        order.verify(persistence).findDocument("DOC-71");
        assertEquals(0, captureCommand().expectedHistorySequence());
    }

    @Test
    void rejectWithoutClinicalCorrectionAllowsMalformedLegacyExtractedData() {
        Map<String, Object> legacyData = Map.of("patient", Map.of("age", -1));
        document.setExtractedData(new LinkedHashMap<>(legacyData));

        service.review("DOC-71", request(Map.of("decision", "REJECT")));

        var command = captureCommand();
        assertEquals(DocumentStatus.REJECTED, command.status());
        assertEquals(legacyData, command.extractedData());
    }

    @Test
    void rejectCanExplicitlyClearNullableValidation() {
        HumanReviewRequest request = request(new LinkedHashMap<>(Map.of("decision", "REJECT")));
        request.add("validation", null);

        service.review("DOC-71", request);

        assertNull(captureCommand().validation());
    }

    @Test
    void approveRejectsMissingApprovalInvariantsBeforeFinalization() {
        document.setDocumentType(null);
        document.setPriority(null);
        document.setExtractedData(null);
        HumanReviewRequest request = request(Map.of("decision", "APPROVE"));
        assertThrows(HumanReviewService.ReviewValidationException.class, () -> service.review("DOC-71", request));
        verifyNoInteractions(finalizer);
    }

    @Test
    void changedClinicalDataRequiresExplicitCompleteValidation() {
        HumanReviewRequest request = request(Map.of(
                "classification", Map.of("priority_level", "URGENT"),
                "decision", "APPROVE"));
        assertThrows(HumanReviewService.ReviewValidationException.class, () -> service.review("DOC-71", request));
        verifyNoInteractions(finalizer);
    }

    @Test
    void invalidReviewStateIsRejectedBeforeFinalization() {
        document.setStatus(DocumentStatus.APPROVED);
        assertThrows(HumanReviewService.InvalidReviewStateException.class,
                () -> service.review("DOC-71", request(Map.of("decision", "REJECT"))));
        verifyNoInteractions(finalizer);
    }

    @Test
    void rejectsUnknownFieldsAndMalformedValidation() {
        assertThrows(HumanReviewService.ReviewValidationException.class,
                () -> service.review("DOC-71", request(Map.of("decision", "REJECT", "status", "REJECTED"))));
        assertThrows(HumanReviewService.ReviewValidationException.class,
                () -> service.review("DOC-71", request(Map.of("decision", "APPROVE",
                        "validation", Map.of("missing_fields", List.of())))));
        assertThrows(HumanReviewService.ReviewValidationException.class,
                () -> service.review("DOC-71", request(Map.of("decision", "REJECT",
                        "extracted_data", Map.of("patient", Map.of("age", -1))))));
        verifyNoInteractions(finalizer);
    }

    private FinalizationCommand captureCommand() {
        var captor = org.mockito.ArgumentCaptor.forClass(FinalizationCommand.class);
        verify(finalizer).finalizeResult(captor.capture());
        return captor.getValue();
    }

    private HumanReviewRequest request(Map<String, Object> values) {
        HumanReviewRequest request = new HumanReviewRequest();
        values.forEach(request::add);
        return request;
    }
}
