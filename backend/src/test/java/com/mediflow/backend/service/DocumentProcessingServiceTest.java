package com.mediflow.backend.service;

import com.mediflow.backend.config.JacksonConfig;
import com.mediflow.backend.config.OciProperties;
import com.mediflow.backend.dto.ProcessingRequest;
import com.mediflow.backend.dto.request.ProcessFileRequest;
import com.mediflow.backend.dto.request.ProcessTextRequest;
import com.mediflow.backend.dto.response.DocumentoCanonicoResponse;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.BackendErrorCode;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.InputType;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.StorageState;
import com.mediflow.backend.enums.TriageEventType;
import com.mediflow.backend.persistence.DocumentPersistenceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DocumentProcessingServiceTest {

    private static final String ID = "DOC-CLIN-2026-8942";

    private final JsonMapper json = JacksonConfig.createJsonMapper();
    private FakeDocumentPersistenceService persistence;
    private InMemoryObjectStorageService storage;
    private StrictLock lock;
    private AiCoreClient ai;
    private DocumentProcessingService service;

    @BeforeEach
    void setUp() {
        persistence = new FakeDocumentPersistenceService();
        storage = new InMemoryObjectStorageService();
        lock = new StrictLock();
        ai = mock(AiCoreClient.class);
        service = newService(realFinalizer());
    }

    private DocumentFinalizationService realFinalizer() {
        return new DocumentFinalizationService(persistence, storage, new ObjectKeyGenerator(),
                new DocumentResponseMapper(json), json, lock);
    }

    private DocumentProcessingService newService(DocumentFinalizationService finalizer) {
        OciProperties oci = new OciProperties();
        oci.setBucketName("test-bucket");
        return new DocumentProcessingService(
                new IncomingDocumentFactory(json),
                lock,
                storage,
                new ObjectKeyGenerator(),
                persistence,
                ai,
                new AiResultInterpreter(json, new NotificationFactory()),
                finalizer,
                new DocumentResponseMapper(json),
                oci);
    }

    private ProcessFileRequest pdfRequest(String id) {
        ProcessFileRequest request = new ProcessFileRequest();
        request.setDocumentId(id);
        request.setFile(new MockMultipartFile("file", "informe.pdf", "application/pdf", ProcessingTestData.PDF));
        request.setOriginChannel("Guardia_Emergencias");
        return request;
    }

    private ProcessTextRequest textRequest(String id) {
        ProcessTextRequest request = new ProcessTextRequest();
        request.setDocumentId(id);
        request.setDocumentText("Texto clinico sintetico");
        request.setOriginChannel("Consulta_Ambulatoria");
        return request;
    }

    private void aiReturns(String priority, String destination, String reasons) {
        when(ai.process(any())).thenAnswer(invocation -> {
            ProcessingRequest request = invocation.getArgument(0);
            return ProcessingTestData.aiResponse(request.getDocumentId(), priority, destination, reasons);
        });
    }

    private DocumentProcessingException failure(Supplier<?> action) {
        return assertThrows(DocumentProcessingException.class, action::get);
    }

    @Test
    void fileFlowStoresOriginalBeforeAiAndEndsProcessedWithOneInitialTriage() {
        AtomicBoolean checkedBeforeAi = new AtomicBoolean();
        when(ai.process(any())).thenAnswer(invocation -> {
            ProcessingRequest request = invocation.getArgument(0);
            assertTrue(storage.contains("recibidos/" + ID + "/original.pdf"));
            assertEquals(DocumentStatus.PROCESSING, persistence.stored(ID).getStatus());
            assertEquals(StorageState.PENDING, persistence.stored(ID).getStorageState());
            assertFalse(lock.isHeld(), "el lock de recepción no debe mantenerse durante IA");
            checkedBeforeAi.set(true);
            return ProcessingTestData.aiResponse(request.getDocumentId(), "ROUTINE", "MEDICAL_RECORD", "[]");
        });

        DocumentoCanonicoResponse response = service.processFile(pdfRequest(ID));

        assertTrue(checkedBeforeAi.get());
        assertEquals(ID, response.getDocumentId());
        assertEquals(DocumentStatus.PROCESSED, response.getStatus());
        assertFalse(response.getRoutingDecision().isRequiresHumanReview());
        assertEquals(StorageState.SUCCESS, response.getStorage().getState());
        assertTrue(storage.contains("procesados/rutina/" + ID + "/original.pdf"));
        assertTrue(storage.contains("procesados/rutina/" + ID + "/triage.json"));
        assertFalse(storage.contains("recibidos/" + ID + "/original.pdf"));
        DocumentRecord stored = persistence.stored(ID);
        assertEquals("test-bucket", stored.getBucket());
        assertEquals(InputType.FILE, stored.getInputType());
        assertEquals("application/pdf", stored.getMimeType());
        assertEquals("informe.pdf", stored.getFileName());
        assertEquals("Guardia_Emergencias", stored.getOriginChannel());
        assertEquals("procesados/rutina/" + ID + "/original.pdf", stored.getObjectKey());
        assertEquals(1, persistence.historyOf(ID).size());
        assertEquals(TriageEventType.INITIAL_TRIAGE, persistence.historyOf(ID).getFirst().getEventType());
        assertFalse(json.writeValueAsString(response).contains("object_key"));
        assertFalse(json.writeValueAsString(response).contains("bucket"));
    }

    @Test
    void aiReceivesFileRequestWithBase64AndRealMime() {
        aiReturns("ROUTINE", "MEDICAL_RECORD", "[]");

        service.processFile(pdfRequest(ID));

        ArgumentCaptor<ProcessingRequest> captor = ArgumentCaptor.forClass(ProcessingRequest.class);
        verify(ai).process(captor.capture());
        ProcessingRequest sent = captor.getValue();
        assertEquals(InputType.FILE, sent.getInputType());
        assertEquals("application/pdf", sent.getMimeType());
        assertEquals("informe.pdf", sent.getFileName());
        assertArrayEquals(ProcessingTestData.PDF, Base64.getDecoder().decode(sent.getContentBase64()));
        assertNull(sent.getDocumentText());
    }

    @Test
    void textFlowStoresOriginalJsonAndUrgentEmergencyNotifies() {
        aiReturns("URGENT", "MEDICAL_EMERGENCY", "[]");

        DocumentoCanonicoResponse response = service.processText(textRequest("DOC-TXT-1"));

        assertEquals(DocumentStatus.PROCESSED, response.getStatus());
        assertTrue(response.getNotification().isGenerated());
        assertEquals(PrimaryDestination.MEDICAL_EMERGENCY, response.getNotification().getType());
        assertEquals("ALERTA URGENTE: el documento DOC-TXT-1 requiere atención inmediata.",
                response.getNotification().getMessage());
        String original = storage.readUtf8("procesados/urgentes/DOC-TXT-1/original.json");
        assertEquals("Texto clinico sintetico", json.readTree(original).get("document_text").asString());
        DocumentRecord stored = persistence.stored("DOC-TXT-1");
        assertEquals(InputType.TEXT, stored.getInputType());
        assertEquals("application/json", stored.getMimeType());
        assertNull(stored.getFileName());
        ArgumentCaptor<ProcessingRequest> captor = ArgumentCaptor.forClass(ProcessingRequest.class);
        verify(ai).process(captor.capture());
        assertEquals("text/plain", captor.getValue().getMimeType());
        assertEquals("Texto clinico sintetico", captor.getValue().getDocumentText());
        assertNull(captor.getValue().getContentBase64());
    }

    @Test
    void generatedIdIsUsedForStorageRecordAndAiRequest() {
        aiReturns("ROUTINE", "MEDICAL_RECORD", "[]");

        DocumentoCanonicoResponse response = service.processText(textRequest(null));

        String id = response.getDocumentId();
        assertTrue(id.startsWith("DOC-"));
        assertRecordExists(id);
        assertTrue(storage.contains("procesados/rutina/" + id + "/original.json"));
        ArgumentCaptor<ProcessingRequest> captor = ArgumentCaptor.forClass(ProcessingRequest.class);
        verify(ai).process(captor.capture());
        assertEquals(id, captor.getValue().getDocumentId());
    }

    private void assertRecordExists(String id) {
        assertTrue(persistence.existsDocument(id));
    }

    @Test
    void semanticReasonsEndAsNeedsAuditWithSuggestedDestinationAndNoExecution() {
        aiReturns("URGENT", "MEDICAL_EMERGENCY", "[\"LOW_CONFIDENCE\"]");

        DocumentoCanonicoResponse response = service.processFile(pdfRequest(ID));

        assertEquals(DocumentStatus.NEEDS_AUDIT, response.getStatus());
        assertTrue(response.getRoutingDecision().isRequiresHumanReview());
        assertEquals(List.of(AuditReason.LOW_CONFIDENCE), response.getRoutingDecision().getAuditReasons());
        assertFalse(response.getNotification().isGenerated());
        assertRecordExists(ID);
        assertTrue(storage.contains("auditoria_humana/" + ID + "/original.pdf"));
        assertTrue(storage.contains("auditoria_humana/" + ID + "/triage.json"));
    }

    @ParameterizedTest
    @EnumSource(value = AuditReason.class, names = {"AI_TIMEOUT", "AI_UNAVAILABLE", "INVALID_AI_RESPONSE"})
    void technicalAiFailureEndsAsNeedsAuditWithSuccessfulResponse(AuditReason reason) {
        when(ai.process(any())).thenThrow(new AiCoreClient.AiClientFatalException(reason));

        DocumentoCanonicoResponse response = service.processFile(pdfRequest(ID));

        assertEquals(DocumentStatus.NEEDS_AUDIT, response.getStatus());
        assertNull(response.getClassification());
        assertNull(response.getConfidence());
        assertNull(response.getExtractedData());
        assertNull(response.getValidation());
        assertEquals(PrimaryDestination.HUMAN_REVIEW, response.getRoutingDecision().getPrimaryDestination());
        assertEquals(List.of(reason), response.getRoutingDecision().getAuditReasons());
        assertTrue(response.getRoutingDecision().isRequiresHumanReview());
        assertEquals(StorageState.SUCCESS, response.getStorage().getState());
        assertTrue(storage.contains("auditoria_humana/" + ID + "/original.pdf"));
        assertEquals(1, persistence.historyOf(ID).size());
    }

    @Test
    void unexpectedExceptionFromAiCallDegradesToInvalidResponseNeedsAudit() {
        when(ai.process(any())).thenThrow(new IllegalStateException("boom"));

        DocumentoCanonicoResponse response = service.processFile(pdfRequest(ID));

        assertEquals(DocumentStatus.NEEDS_AUDIT, response.getStatus());
        assertEquals(List.of(AuditReason.INVALID_AI_RESPONSE), response.getRoutingDecision().getAuditReasons());
    }

    @Test
    void sequentialDuplicateIsRejectedWithoutTouchingTheFirstDocument() {
        aiReturns("ROUTINE", "MEDICAL_RECORD", "[]");
        service.processFile(pdfRequest(ID));
        String originalBefore = storage.readUtf8("procesados/rutina/" + ID + "/original.pdf");
        String triageBefore = storage.readUtf8("procesados/rutina/" + ID + "/triage.json");
        int putsBefore = storage.putKeys().size();
        int deletesBefore = storage.deletedKeys().size();

        DocumentProcessingException error = failure(() -> service.processText(textRequest(ID)));

        assertEquals(BackendErrorCode.DOCUMENT_ID_ALREADY_EXISTS, error.getCode());
        assertEquals(originalBefore, storage.readUtf8("procesados/rutina/" + ID + "/original.pdf"));
        assertEquals(triageBefore, storage.readUtf8("procesados/rutina/" + ID + "/triage.json"));
        assertEquals(putsBefore, storage.putKeys().size());
        assertEquals(deletesBefore, storage.deletedKeys().size());
        verify(ai, times(1)).process(any());
        assertEquals(DocumentStatus.PROCESSED, persistence.stored(ID).getStatus());
        assertEquals(1, persistence.historyOf(ID).size());
    }

    @Test
    void duplicateOfReceivedDocumentDoesNotOverwriteItsOriginal() {
        DocumentRecord existing = new DocumentRecord();
        existing.setId(ID);
        existing.setStatus(DocumentStatus.RECEIVED);
        persistence.seed(existing);
        storage.seed("recibidos/" + ID + "/original.pdf", "primer-original");

        DocumentProcessingException error = failure(() -> service.processFile(pdfRequest(ID)));

        assertEquals(BackendErrorCode.DOCUMENT_ID_ALREADY_EXISTS, error.getCode());
        assertEquals("primer-original", storage.readUtf8("recibidos/" + ID + "/original.pdf"));
        assertTrue(storage.putKeys().isEmpty());
        assertTrue(storage.deletedKeys().isEmpty());
        verify(ai, never()).process(any());
    }

    @Test
    void orphanObjectAtTheKeyIsNeitherOverwrittenNorDeleted() {
        storage.seed("recibidos/" + ID + "/original.pdf", "huerfano");

        DocumentProcessingException error = failure(() -> service.processFile(pdfRequest(ID)));

        assertEquals(BackendErrorCode.DOCUMENT_ID_ALREADY_EXISTS, error.getCode());
        assertEquals("huerfano", storage.readUtf8("recibidos/" + ID + "/original.pdf"));
        assertTrue(storage.deletedKeys().isEmpty());
        assertFalse(persistence.existsDocument(ID));
        verify(ai, never()).process(any());
    }

    @Test
    void duplicateDetectedOnlyAtInsertDeletesOnlyTheObjectCreatedByThisRequest() {
        DocumentRecord winner = new DocumentRecord();
        winner.setId(ID);
        winner.setStatus(DocumentStatus.NEEDS_AUDIT);
        persistence.seed(winner);
        FakeDocumentPersistenceService racing = spy(persistence);
        doReturn(false).when(racing).existsDocument(ID);
        doThrow(new DocumentPersistenceService.DuplicateDocumentException(ID, new RuntimeException("23505")))
                .when(racing).createReceived(any());
        persistence = racing;
        service = newService(realFinalizer());
        storage.seed("auditoria_humana/" + ID + "/original.pdf", "original-del-ganador");

        DocumentProcessingException error = failure(() -> service.processFile(pdfRequest(ID)));

        assertEquals(BackendErrorCode.DOCUMENT_ID_ALREADY_EXISTS, error.getCode());
        assertEquals(List.of("recibidos/" + ID + "/original.pdf"), storage.deletedKeys());
        assertEquals("original-del-ganador", storage.readUtf8("auditoria_humana/" + ID + "/original.pdf"));
        verify(ai, never()).process(any());
    }

    @Test
    void uploadFailureReturnsStorageErrorWithoutRecordOrAiCall() {
        storage.failPutsMatching(key -> key.startsWith("recibidos/"));

        DocumentProcessingException error = failure(() -> service.processFile(pdfRequest(ID)));

        assertEquals(BackendErrorCode.STORAGE_ERROR, error.getCode());
        assertFalse(persistence.existsDocument(ID));
        verify(ai, never()).process(any());
    }

    @Test
    void insertFailureDeletesOnlyTheObjectCreatedByThisRequest() {
        persistence.failCreate();

        DocumentProcessingException error = failure(() -> service.processFile(pdfRequest(ID)));

        assertEquals(BackendErrorCode.PERSISTENCE_ERROR, error.getCode());
        assertEquals(List.of("recibidos/" + ID + "/original.pdf"), storage.deletedKeys());
        assertFalse(storage.contains("recibidos/" + ID + "/original.pdf"));
        verify(ai, never()).process(any());
    }

    @Test
    void insertFailureCleanupFailureIsLoggedAndStillReportsPersistenceError() {
        persistence.failCreate();
        storage.failDeletesMatching(key -> true);

        DocumentProcessingException error = failure(() -> service.processFile(pdfRequest(ID)));

        assertEquals(BackendErrorCode.PERSISTENCE_ERROR, error.getCode());
    }

    @Test
    void existenceCheckFailureStopsBeforeAnyUpload() {
        persistence.failExists();

        DocumentProcessingException error = failure(() -> service.processFile(pdfRequest(ID)));

        assertEquals(BackendErrorCode.PERSISTENCE_ERROR, error.getCode());
        assertTrue(storage.putKeys().isEmpty());
        verify(ai, never()).process(any());
    }

    @Test
    void markProcessingFailureKeepsReceivedRecordAndOriginalWithoutCallingAi() {
        persistence.failMarkProcessing();

        DocumentProcessingException error = failure(() -> service.processFile(pdfRequest(ID)));

        assertEquals(BackendErrorCode.PERSISTENCE_ERROR, error.getCode());
        assertEquals(DocumentStatus.RECEIVED, persistence.stored(ID).getStatus());
        assertTrue(storage.contains("recibidos/" + ID + "/original.pdf"));
        assertTrue(storage.deletedKeys().isEmpty());
        verify(ai, never()).process(any());
    }

    @Test
    void finalizationStorageFailureKeepsNeedsAuditFallbackAndReportsStorageError() {
        aiReturns("ROUTINE", "MEDICAL_RECORD", "[]");
        storage.failPutsMatching(key -> key.endsWith("triage.json"));

        DocumentProcessingException error = failure(() -> service.processFile(pdfRequest(ID)));

        assertEquals(BackendErrorCode.STORAGE_ERROR, error.getCode());
        DocumentRecord stored = persistence.stored(ID);
        assertEquals(DocumentStatus.NEEDS_AUDIT, stored.getStatus());
        assertEquals(StorageState.ERROR, stored.getStorageState());
        assertEquals(PrimaryDestination.HUMAN_REVIEW, stored.getRoutingDestination());
        assertTrue(storage.contains("recibidos/" + ID + "/original.pdf"));
        assertEquals(1, persistence.historyOf(ID).size());
    }

    @Test
    void finalizationPostgresFailureReportsPersistenceErrorAndKeepsOriginal() {
        aiReturns("ROUTINE", "MEDICAL_RECORD", "[]");
        persistence.failNextCommitWith(new DataAccessResourceFailureException("induced"));

        DocumentProcessingException error = failure(() -> service.processFile(pdfRequest(ID)));

        assertEquals(BackendErrorCode.PERSISTENCE_ERROR, error.getCode());
        assertTrue(storage.contains("recibidos/" + ID + "/original.pdf"));
        assertFalse(storage.contains("procesados/rutina/" + ID + "/original.pdf"));
        assertFalse(storage.contains("procesados/rutina/" + ID + "/triage.json"));
    }

    @Test
    void fallbackDurableOutcomeIsNeverReportedAsSuccess() {
        aiReturns("ROUTINE", "MEDICAL_RECORD", "[]");
        DocumentFinalizationService finalizer = mock(DocumentFinalizationService.class);
        when(finalizer.finalizeResult(any())).thenReturn(
                FinalizationOutcome.fallbackDurable(ID, 1, Instant.now(), true, false));
        service = newService(finalizer);

        assertEquals(BackendErrorCode.STORAGE_ERROR, failure(() -> service.processFile(pdfRequest(ID))).getCode());
    }

    @Test
    void failedUnrecoverableOutcomeIsNeverReportedAsSuccess() {
        aiReturns("ROUTINE", "MEDICAL_RECORD", "[]");
        DocumentFinalizationService finalizer = mock(DocumentFinalizationService.class);
        when(finalizer.finalizeResult(any())).thenReturn(
                FinalizationOutcome.failedUnrecoverable(ID, 1, Instant.now()));
        service = newService(finalizer);

        assertEquals(BackendErrorCode.STORAGE_ERROR, failure(() -> service.processFile(pdfRequest(ID))).getCode());
    }

    @Test
    void unclassifiedFinalizerFailureIsNotMappedToAContractCode() {
        aiReturns("ROUTINE", "MEDICAL_RECORD", "[]");
        DocumentFinalizationService finalizer = mock(DocumentFinalizationService.class);
        IllegalStateException unexpected = new IllegalStateException("inesperado");
        when(finalizer.finalizeResult(any())).thenThrow(unexpected);
        service = newService(finalizer);

        IllegalStateException thrown = assertThrows(IllegalStateException.class, () -> service.processFile(pdfRequest(ID)));

        assertSame(unexpected, thrown);
    }

    @Test
    void finalizerIsInvokedAfterTheReceptionLockIsReleased() {
        aiReturns("ROUTINE", "MEDICAL_RECORD", "[]");
        DocumentFinalizationService finalizer = mock(DocumentFinalizationService.class);
        when(finalizer.finalizeResult(any())).thenAnswer(invocation -> {
            assertFalse(lock.isHeld());
            return FinalizationOutcome.fallbackDurable(ID, 1, Instant.now(), true, false);
        });
        service = newService(finalizer);

        assertThrows(DocumentProcessingException.class, () -> service.processFile(pdfRequest(ID)));
        verify(finalizer).finalizeResult(any());
    }

    @Test
    void validationErrorsCreateNothing() {
        ProcessFileRequest invalid = pdfRequest(ID);
        invalid.setOriginChannel(" ");

        assertEquals(BackendErrorCode.INVALID_REQUEST, failure(() -> service.processFile(invalid)).getCode());
        assertTrue(storage.putKeys().isEmpty());
        assertFalse(persistence.existsDocument(ID));
        verify(ai, never()).process(any());
    }

    private static final class StrictLock implements DocumentExclusiveLock {
        private final ThreadLocal<Boolean> held = ThreadLocal.withInitial(() -> false);

        boolean isHeld() {
            return held.get();
        }

        @Override
        public <T> T execute(String documentId, Supplier<T> work) {
            if (held.get()) {
                throw new IllegalStateException("lock anidado: la sesión se bloquearía a sí misma");
            }
            held.set(true);
            try {
                return work.get();
            } finally {
                held.set(false);
            }
        }
    }
}
