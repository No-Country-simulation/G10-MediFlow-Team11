package com.mediflow.backend.service;

import com.mediflow.backend.dto.request.HumanReviewRequest;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.entity.DocumentTriageHistory;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.HumanDecision;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import com.mediflow.backend.enums.TriageEventType;
import com.mediflow.backend.persistence.DocumentPersistenceService;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class HumanReviewService {
    private static final List<String> VALIDATION_KEYS = List.of("missing_fields", "inconsistencies", "warnings");

    private final DocumentPersistenceService persistence;
    private final DocumentFinalizationService finalizer;

    public HumanReviewService(DocumentPersistenceService persistence, DocumentFinalizationService finalizer) {
        this.persistence = persistence;
        this.finalizer = finalizer;
    }

    public FinalizationOutcome review(String documentId, HumanReviewRequest request) {
        Map<String, Object> body = request == null ? Map.of() : request.getFields();
        rejectUnknown(body, List.of("classification", "extracted_data", "validation", "routing_decision", "decision"));
        HumanDecision decision = enumValue(HumanDecision.class, body.get("decision"), "decision", true);

        Optional<DocumentRecord> optional = persistence.findDocument(documentId);
        if (optional.isEmpty()) throw new DocumentNotFoundException();
        DocumentRecord document = optional.get();
        List<DocumentTriageHistory> history = persistence.listHistory(documentId);
        int expectedSequence = history.isEmpty() ? 0 : history.getLast().getId().getSequence();
        if (document.getStatus() != DocumentStatus.NEEDS_AUDIT) throw new InvalidReviewStateException();

        Map<String, Object> classification = new LinkedHashMap<>();
        classification.put("document_type", document.getDocumentType() == null ? null : document.getDocumentType().name());
        classification.put("specialty", document.getSpecialty());
        classification.put("priority_level", document.getPriority() == null ? null : document.getPriority().name());
        Map<String, Object> routing = new LinkedHashMap<>();
        routing.put("primary_destination", document.getRoutingDestination() == null ? null : document.getRoutingDestination().name());
        Map<String, Object> mergedClassification = body.containsKey("classification") && body.get("classification") == null
                ? new LinkedHashMap<>() : mergedObject(classification, body.get("classification"),
                "classification", List.of("document_type", "specialty", "priority_level"));
        Map<String, Object> mergedRouting = body.containsKey("routing_decision") && body.get("routing_decision") == null
                ? new LinkedHashMap<>() : mergedObject(routing, body.get("routing_decision"),
                "routing_decision", List.of("primary_destination"));

        DocumentType type = enumValue(DocumentType.class, mergedClassification.get("document_type"), "classification.document_type", false);
        PriorityLevel priority = enumValue(PriorityLevel.class, mergedClassification.get("priority_level"), "classification.priority_level", false);
        PrimaryDestination destination = enumValue(PrimaryDestination.class, mergedRouting.get("primary_destination"), "routing_decision.primary_destination", false);
        if (destination == null) throw new ReviewValidationException();
        Map<String, Object> extracted = body.containsKey("extracted_data") && body.get("extracted_data") == null
                ? null : mergeMap(document.getExtractedData(), body.get("extracted_data"), "extracted_data");
        Map<String, Object> validation = body.containsKey("validation") && body.get("validation") == null
                ? null : mergeMap(document.getValidation(), body.get("validation"), "validation");

        boolean clinicalContentChanged = !same(type, document.getDocumentType())
                || !same(priority, document.getPriority())
                || !same(document.getSpecialty(), mergedClassification.get("specialty"))
                || !same(extracted, document.getExtractedData())
                || !same(destination, document.getRoutingDestination());
        if (body.containsKey("validation") && body.get("validation") != null) {
            validateValidation(mergeMap(null, body.get("validation"), "validation"));
        }
        if (extracted != null) validateExtractedData(extracted);
        if (decision == HumanDecision.APPROVE) {
            if (type == null || priority == null || extracted == null || destination == null
                    || destination == PrimaryDestination.HUMAN_REVIEW) throw new ReviewValidationException();
            if (validation == null || (clinicalContentChanged && !body.containsKey("validation"))) {
                throw new ReviewValidationException();
            }
        }

        String specialty = nullableString(mergedClassification.get("specialty"), "classification.specialty");
        Map<String, Object> notification = decision == HumanDecision.APPROVE
                && priority == PriorityLevel.URGENT && destination == PrimaryDestination.MEDICAL_EMERGENCY
                ? Map.of("generated", true, "type", "MEDICAL_EMERGENCY",
                "message", "ALERTA URGENTE: el documento " + documentId + " requiere atención inmediata.")
                : DocumentRecord.defaultNotification();
        FinalizationCommand command = new FinalizationCommand(
                documentId,
                decision == HumanDecision.APPROVE ? DocumentStatus.APPROVED : DocumentStatus.REJECTED,
                type, specialty, priority,
                clinicalContentChanged ? null : document.getConfidenceClassification(),
                clinicalContentChanged ? null : document.getConfidenceExtraction(),
                clinicalContentChanged ? null : document.getConfidenceGlobal(),
                destination,
                decision == HumanDecision.APPROVE
                        ? "Destino " + destination.name() + " confirmado por revisión humana"
                        : "Documento rechazado en revisión humana; no se ejecuta enrutamiento",
                document.getAuditReasons(), extracted, validation, notification,
                TriageEventType.HUMAN_REVIEW, decision, expectedSequence);
        return finalizer.finalizeResult(command);
    }

    private Map<String, Object> mergedObject(Map<String, Object> existing, Object patch, String name, List<String> allowed) {
        if (patch == null) {
            if (patch == null && existing == null) return new LinkedHashMap<>();
            if (patch == null) return new LinkedHashMap<>(existing);
        }
        return mergeMap(existing, patch, name, allowed);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mergeMap(Map<String, Object> existing, Object patch, String name) {
        return mergeMap(existing, patch, name, null);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mergeMap(Map<String, Object> existing, Object patch, String name, List<String> allowed) {
        if (patch == null) return existing == null ? null : new LinkedHashMap<>(existing);
        if (!(patch instanceof Map<?, ?> raw)) throw new ReviewValidationException();
        Map<String, Object> merged = existing == null ? new LinkedHashMap<>() : new LinkedHashMap<>(existing);
        for (Map.Entry<?, ?> entry : raw.entrySet()) {
            if (!(entry.getKey() instanceof String key) || (allowed != null && !allowed.contains(key))) throw new ReviewValidationException();
            Object value = entry.getValue();
            if (value instanceof Map<?, ?> nested && merged.get(key) instanceof Map<?, ?> old) {
                merged.put(key, mergeMap((Map<String, Object>) old, nested, name + "." + key));
            } else {
                merged.put(key, value);
            }
        }
        return merged;
    }

    private void rejectUnknown(Map<String, Object> body, List<String> allowed) {
        if (!allowed.containsAll(body.keySet())) throw new ReviewValidationException();
    }

    private <E extends Enum<E>> E enumValue(Class<E> type, Object value, String field, boolean required) {
        if (value == null) {
            if (required) throw new ReviewValidationException();
            return null;
        }
        if (!(value instanceof String text)) throw new ReviewValidationException();
        try { return Enum.valueOf(type, text); }
        catch (IllegalArgumentException exception) { throw new ReviewValidationException(); }
    }

    private String nullableString(Object value, String field) {
        if (value == null) return null;
        if (!(value instanceof String text)) throw new ReviewValidationException();
        return text;
    }

    private void validateValidation(Map<String, Object> value) {
        if (value == null || !value.keySet().containsAll(VALIDATION_KEYS) || !VALIDATION_KEYS.containsAll(value.keySet()))
            throw new ReviewValidationException();
        for (String key : VALIDATION_KEYS) {
            if (!(value.get(key) instanceof List<?> list) || list.stream().anyMatch(item -> !(item instanceof String)))
                throw new ReviewValidationException();
        }
    }

    private void validateExtractedData(Map<String, Object> data) {
        validateObjectField(data, "patient", Map.of("name", String.class, "age", Number.class));
        validateObjectField(data, "requesting_doctor", Map.of("name", String.class, "license_number", String.class));
        validateNullableString(data, "primary_diagnosis");
        validateNullableString(data, "suggested_icd10");
        Object age = data.containsKey("patient") && data.get("patient") instanceof Map<?, ?> patient ? patient.get("age") : null;
        if (age != null && (!(age instanceof Number number) || number.doubleValue() != number.longValue() || number.longValue() < 0))
            throw new ReviewValidationException();
        validateListOfObjects(data, "medications", List.of("name", "dosage"));
        validateListOfObjects(data, "requested_studies", List.of("name"));
    }

    private void validateObjectField(Map<String, Object> root, String key, Map<String, Class<?>> fields) {
        if (!root.containsKey(key) || root.get(key) == null) return;
        if (!(root.get(key) instanceof Map<?, ?> object)) throw new ReviewValidationException();
        for (Map.Entry<String, Class<?>> field : fields.entrySet()) {
            Object value = object.get(field.getKey());
            if (value != null && !field.getValue().isInstance(value)) throw new ReviewValidationException();
        }
    }

    private void validateNullableString(Map<String, Object> root, String key) {
        Object value = root.get(key);
        if (value != null && !(value instanceof String)) throw new ReviewValidationException();
    }

    private void validateListOfObjects(Map<String, Object> root, String key, List<String> fields) {
        if (!root.containsKey(key) || root.get(key) == null) return;
        if (!(root.get(key) instanceof List<?> values)) throw new ReviewValidationException();
        for (Object item : values) {
            if (!(item instanceof Map<?, ?> object)) throw new ReviewValidationException();
            for (String field : fields) {
                Object value = object.get(field);
                if (value != null && !(value instanceof String)) throw new ReviewValidationException();
            }
        }
    }

    private boolean same(Object a, Object b) { return java.util.Objects.equals(a, b); }

    public static class ReviewValidationException extends RuntimeException { }
    public static class InvalidReviewStateException extends RuntimeException { }
    public static class DocumentNotFoundException extends RuntimeException { }
}
