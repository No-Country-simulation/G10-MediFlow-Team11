package com.mediflow.backend.persistence;

import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.entity.DocumentTriageHistory;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.HumanDecision;
import com.mediflow.backend.enums.InputType;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import com.mediflow.backend.enums.StorageState;
import com.mediflow.backend.enums.TriageEventType;
import com.mediflow.backend.repository.DocumentRepository;
import com.mediflow.backend.repository.DocumentTriageHistoryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class DocumentPersistenceIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("mediflow")
            .withUsername("mediflow_user")
            .withPassword("test-password");

    @Autowired
    private DocumentPersistenceService persistenceService;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private DocumentTriageHistoryRepository historyRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void documentRoundTripStoresQueryableColumnsAndJsonb() {
        DocumentRecord saved = persistenceService.saveDocument(sampleDocument("DOC-CLIN-2026-8942"));
        documentRepository.flush();

        DocumentRecord loaded = persistenceService.getDocument("DOC-CLIN-2026-8942");
        assertEquals(DocumentStatus.NEEDS_AUDIT, loaded.getStatus());
        assertEquals(List.of(AuditReason.LOW_CONFIDENCE, AuditReason.AI_TIMEOUT), loaded.getAuditReasons());
        assertEquals(InputType.FILE, loaded.getInputType());
        assertEquals("informe.pdf", loaded.getFileName());
        assertEquals(DocumentType.IMAGING_REPORT, loaded.getDocumentType());
        assertEquals(PriorityLevel.URGENT, loaded.getPriority());
        assertEquals(0.96, loaded.getConfidenceGlobal());
        assertEquals("Carlos Eduardo Mendes", loaded.getExtractedData().get("patient_name"));
        assertEquals(List.of(), loaded.getValidation().get("missing_fields"));
        assertEquals(Boolean.FALSE, loaded.getNotification().get("generated"));
        assertEquals("jsonb", columnUdt("documents", "extracted_data"));
        assertEquals("jsonb", columnUdt("documents", "validation"));
        assertEquals("jsonb", columnUdt("documents", "notification"));
        assertEquals("DOC-CLIN-2026-8942", saved.getId());
    }

    @Test
    void historyAppendsMultipleEntriesWithIncreasingSequence() {
        persistenceService.saveDocument(sampleDocument("DOC-HIST-0001"));

        persistenceService.appendHistory(
                "DOC-HIST-0001",
                TriageEventType.INITIAL_TRIAGE,
                null,
                canonicalSnapshot("DOC-HIST-0001", "NEEDS_AUDIT")
        );
        persistenceService.appendHistory(
                "DOC-HIST-0001",
                TriageEventType.HUMAN_REVIEW,
                HumanDecision.APPROVE,
                canonicalSnapshot("DOC-HIST-0001", "APPROVED")
        );

        List<DocumentTriageHistory> history = persistenceService.listHistory("DOC-HIST-0001");
        assertEquals(2, history.size());
        assertEquals(1, history.get(0).getId().getSequence());
        assertEquals(2, history.get(1).getId().getSequence());
        assertEquals(TriageEventType.INITIAL_TRIAGE, history.get(0).getEventType());
        assertNull(history.get(0).getDecision());
        assertEquals(TriageEventType.HUMAN_REVIEW, history.get(1).getEventType());
        assertEquals(HumanDecision.APPROVE, history.get(1).getDecision());
        assertEquals("APPROVED", history.get(1).getResult().get("status"));
        assertTrue(history.get(1).getOccurredAt().compareTo(history.get(0).getOccurredAt()) >= 0);
        assertEquals("jsonb", columnUdt("document_triage_history", "result"));
        assertEquals(2, historyRepository.findMaxSequence("DOC-HIST-0001"));
    }

    @Test
    void historyRemainsAppendOnly() {
        persistenceService.saveDocument(sampleDocument("DOC-APPEND-0001"));
        persistenceService.appendHistory(
                "DOC-APPEND-0001",
                TriageEventType.INITIAL_TRIAGE,
                null,
                canonicalSnapshot("DOC-APPEND-0001", "PROCESSED")
        );

        assertEquals(1, jdbcTemplate.queryForObject(
                "select count(*) from document_triage_history where document_id = ?",
                Integer.class,
                "DOC-APPEND-0001"
        ));
        persistenceService.appendHistory(
                "DOC-APPEND-0001",
                TriageEventType.HUMAN_REVIEW,
                HumanDecision.REJECT,
                canonicalSnapshot("DOC-APPEND-0001", "REJECTED")
        );
        assertEquals(2, jdbcTemplate.queryForObject(
                "select count(*) from document_triage_history where document_id = ?",
                Integer.class,
                "DOC-APPEND-0001"
        ));
        assertEquals(
                1,
                jdbcTemplate.queryForObject(
                        "select count(*) from document_triage_history where document_id = ? and sequence = 1",
                        Integer.class,
                        "DOC-APPEND-0001"
                )
        );
    }

    private String columnUdt(String table, String column) {
        return jdbcTemplate.queryForObject(
                """
                        select udt_name from information_schema.columns
                        where table_schema = 'public' and table_name = ? and column_name = ?
                        """,
                String.class,
                table,
                column
        );
    }

    private static DocumentRecord sampleDocument(String id) {
        DocumentRecord document = new DocumentRecord();
        document.setId(id);
        document.setStatus(DocumentStatus.NEEDS_AUDIT);
        document.setAuditReasons(List.of(AuditReason.LOW_CONFIDENCE, AuditReason.AI_TIMEOUT));
        document.setOriginChannel("Guardia_Emergencias");
        document.setInputType(InputType.FILE);
        document.setMimeType("application/pdf");
        document.setFileName("informe.pdf");
        document.setBucket("mediflow-documentos-clinicos");
        document.setObjectKey("recibidos/" + id + "/original.pdf");
        document.setStorageState(StorageState.SUCCESS);
        document.setDocumentType(DocumentType.IMAGING_REPORT);
        document.setSpecialty("Radiologia / Neumonologia");
        document.setPriority(PriorityLevel.URGENT);
        document.setConfidenceClassification(0.99);
        document.setConfidenceExtraction(0.94);
        document.setConfidenceGlobal(0.96);
        document.setRoutingDestination(PrimaryDestination.HUMAN_REVIEW);
        document.setRoutingJustification("Hallazgo de alta prioridad clínica.");
        document.setExtractedData(Map.of("patient_name", "Carlos Eduardo Mendes"));
        document.setValidation(DocumentRecord.emptyValidation());
        document.setNotification(DocumentRecord.defaultNotification());
        return document;
    }

    private static Map<String, Object> canonicalSnapshot(String documentId, String status) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("document_id", documentId);
        snapshot.put("status", status);
        snapshot.put("storage", Map.of("provider", "OCI_OBJECT_STORAGE", "state", "SUCCESS"));
        return snapshot;
    }
}
