package com.mediflow.backend.repository;

import com.mediflow.backend.entity.DocumentTriageHistory;
import com.mediflow.backend.entity.DocumentTriageHistoryId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DocumentTriageHistoryRepository extends JpaRepository<DocumentTriageHistory, DocumentTriageHistoryId> {

    List<DocumentTriageHistory> findByIdDocumentIdOrderByIdSequenceAsc(String documentId);

    @Query("select coalesce(max(h.id.sequence), 0) from DocumentTriageHistory h where h.id.documentId = :documentId")
    int findMaxSequence(@Param("documentId") String documentId);
}
