package com.mediflow.backend.persistence;

import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.entity.DocumentTriageHistory;
import com.mediflow.backend.entity.DocumentTriageHistoryId;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.repository.DocumentRepository;
import com.mediflow.backend.repository.DocumentTriageHistoryRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DocumentPersistenceServiceTest {

    @Test
    void historyQueryUsesDocumentIdAndAscendingSequenceOrder() {
        DocumentRepository documents = mock(DocumentRepository.class);
        DocumentTriageHistoryRepository history = mock(DocumentTriageHistoryRepository.class);
        DocumentPersistenceService service = new DocumentPersistenceService(
                documents, history, mock(EntityManager.class));
        DocumentTriageHistory first = new DocumentTriageHistory();
        first.setId(new DocumentTriageHistoryId("DOC-70", 1));
        DocumentTriageHistory second = new DocumentTriageHistory();
        second.setId(new DocumentTriageHistoryId("DOC-70", 2));
        when(history.findByIdDocumentIdOrderByIdSequenceAsc("DOC-70")).thenReturn(List.of(first, second));

        assertEquals(List.of(first, second), service.listHistory("DOC-70"));
        verify(history).findByIdDocumentIdOrderByIdSequenceAsc("DOC-70");
    }

    @Test
    void auditQuerySelectsNeedsAuditAndKeepsRepositoryOrder() {
        DocumentRepository documents = mock(DocumentRepository.class);
        DocumentPersistenceService service = new DocumentPersistenceService(
                documents, mock(DocumentTriageHistoryRepository.class), mock(EntityManager.class));
        DocumentRecord first = new DocumentRecord();
        first.setId("DOC-A");
        DocumentRecord second = new DocumentRecord();
        second.setId("DOC-B");
        when(documents.findByStatusOrderByCreatedAtAscIdAsc(DocumentStatus.NEEDS_AUDIT))
                .thenReturn(List.of(first, second));

        assertEquals(List.of(first, second), service.listAuditDocuments());
        verify(documents).findByStatusOrderByCreatedAtAscIdAsc(DocumentStatus.NEEDS_AUDIT);
    }
}
