package com.mediflow.backend.entity;

import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.InputType;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import com.mediflow.backend.enums.StorageState;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tabla {@code documents} (arquitectura §10).
 * Separada de los DTO de transporte: las columnas consultables son explícitas;
 * {@code extracted_data}, {@code validation} y {@code notification} van en JSONB.
 */
@Entity
@Table(name = "documents")
@Getter
@Setter
public class DocumentRecord {

    @Id
    @Column(length = 128)
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DocumentStatus status;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "audit_reasons", columnDefinition = "text[]", nullable = false)
    private String[] auditReasonValues = new String[0];

    @Column(name = "origin_channel")
    private String originChannel;

    @Enumerated(EnumType.STRING)
    @Column(name = "input_type", nullable = false, length = 16)
    private InputType inputType;

    @Column(name = "mime_type", nullable = false)
    private String mimeType;

    @Column(name = "file_name")
    private String fileName;

    private String bucket;

    @Column(name = "object_key")
    private String objectKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "storage_state", nullable = false, length = 16)
    private StorageState storageState;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", length = 64)
    private DocumentType documentType;

    private String specialty;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private PriorityLevel priority;

    @Column(name = "confidence_classification")
    private Double confidenceClassification;

    @Column(name = "confidence_extraction")
    private Double confidenceExtraction;

    @Column(name = "confidence_global")
    private Double confidenceGlobal;

    @Enumerated(EnumType.STRING)
    @Column(name = "routing_destination", nullable = false, length = 32)
    private PrimaryDestination routingDestination;

    @Column(name = "routing_justification", nullable = false, columnDefinition = "text")
    private String routingJustification;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "extracted_data", columnDefinition = "jsonb")
    private Map<String, Object> extractedData;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> validation;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> notification = defaultNotification();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public List<AuditReason> getAuditReasons() {
        if (auditReasonValues == null || auditReasonValues.length == 0) {
            return List.of();
        }
        return Arrays.stream(auditReasonValues).map(AuditReason::valueOf).toList();
    }

    public void setAuditReasons(List<AuditReason> reasons) {
        if (reasons == null || reasons.isEmpty()) {
            this.auditReasonValues = new String[0];
            return;
        }
        this.auditReasonValues = reasons.stream().map(Enum::name).toArray(String[]::new);
    }

    public void touchUpdatedAt(Instant instant) {
        this.updatedAt = instant;
    }

    @PrePersist
    void onPersist() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = createdAt;
        }
        if (auditReasonValues == null) {
            auditReasonValues = new String[0];
        }
        if (notification == null) {
            notification = defaultNotification();
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public static Map<String, Object> defaultNotification() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("generated", false);
        return body;
    }

    public static Map<String, Object> emptyValidation() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("missing_fields", new ArrayList<>());
        body.put("inconsistencies", new ArrayList<>());
        body.put("warnings", new ArrayList<>());
        return body;
    }
}
