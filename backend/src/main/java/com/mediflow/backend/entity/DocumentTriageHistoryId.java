package com.mediflow.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode
public class DocumentTriageHistoryId implements Serializable {

    @Column(name = "document_id", nullable = false, length = 128)
    private String documentId;

    @Column(nullable = false)
    private Integer sequence;

    public DocumentTriageHistoryId(String documentId, Integer sequence) {
        this.documentId = documentId;
        this.sequence = sequence;
    }
}
