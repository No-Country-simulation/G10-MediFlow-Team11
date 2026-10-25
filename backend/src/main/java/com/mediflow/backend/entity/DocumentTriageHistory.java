package com.mediflow.backend.entity;

import com.mediflow.backend.enums.HumanDecision;
import com.mediflow.backend.enums.TriageEventType;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

/**
 * Tabla {@code document_triage_history} (arquitectura §10).
 * PK ({@code document_id}, {@code sequence}); append-only.
 */
@Entity
@Immutable
@Table(name = "document_triage_history")
@Getter
@Setter
public class DocumentTriageHistory {

    @EmbeddedId
    private DocumentTriageHistoryId id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("documentId")
    @JoinColumn(name = "document_id", nullable = false)
    private DocumentRecord document;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 32)
    private TriageEventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private HumanDecision decision;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> result;
}
