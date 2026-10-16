package com.mediflow.backend.service;

import com.mediflow.backend.config.OciProperties;
import com.mediflow.backend.dto.request.ProcessFileRequest;
import com.mediflow.backend.dto.request.ProcessTextRequest;
import com.mediflow.backend.dto.response.DocumentoCanonicoResponse;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.BackendErrorCode;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.StorageState;
import com.mediflow.backend.persistence.DocumentPersistenceService;
import jakarta.persistence.PersistenceException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionException;

import java.sql.SQLException;

/**
 * No utiliza una transacción externa. El lock de recepción debe liberarse
 * antes de invocar al finalizador para evitar un deadlock.
 */
@Service
public class DocumentProcessingService {

    private static final Logger log = LoggerFactory.getLogger(DocumentProcessingService.class);
    private static final String PENDING_JUSTIFICATION = "Procesamiento pendiente";

    private final IncomingDocumentFactory documentFactory;
    private final DocumentExclusiveLock exclusiveLock;
    private final ObjectStorageService storageService;
    private final ObjectKeyGenerator keyGenerator;
    private final DocumentPersistenceService persistenceService;
    private final AiCoreClient aiCoreClient;
    private final AiResultInterpreter interpreter;
    private final DocumentFinalizationService finalizationService;
    private final DocumentResponseMapper responseMapper;
    private final OciProperties ociProperties;

    public DocumentProcessingService(
            IncomingDocumentFactory documentFactory,
            DocumentExclusiveLock exclusiveLock,
            ObjectStorageService storageService,
            ObjectKeyGenerator keyGenerator,
            DocumentPersistenceService persistenceService,
            AiCoreClient aiCoreClient,
            AiResultInterpreter interpreter,
            DocumentFinalizationService finalizationService,
            DocumentResponseMapper responseMapper,
            OciProperties ociProperties
    ) {
        this.documentFactory = documentFactory;
        this.exclusiveLock = exclusiveLock;
        this.storageService = storageService;
        this.keyGenerator = keyGenerator;
        this.persistenceService = persistenceService;
        this.aiCoreClient = aiCoreClient;
        this.interpreter = interpreter;
        this.finalizationService = finalizationService;
        this.responseMapper = responseMapper;
        this.ociProperties = ociProperties;
    }

    public DocumentoCanonicoResponse processFile(ProcessFileRequest request) {
        return process(documentFactory.fromFile(request));
    }

    public DocumentoCanonicoResponse processText(ProcessTextRequest request) {
        return process(documentFactory.fromText(request));
    }

    private DocumentoCanonicoResponse process(IncomingDocument document) {
        receive(document);
        markProcessing(document.documentId());
        FinalizationCommand command = triage(document);
        FinalizationOutcome outcome = finalizeResult(command);
        return respond(outcome);
    }

    private void receive(IncomingDocument document) {
        String documentId = document.documentId();
        String objectKey = keyGenerator.originalKey(
                ObjectKeyGenerator.PREFIJO_RECIBIDOS, documentId, keyGenerator.extensionForMime(document.storedMimeType()));
        try {
            exclusiveLock.execute(documentId, () -> {
                receiveLocked(document, objectKey);
                return null;
            });
        } catch (IllegalStateException lockFailure) {
            if (lockFailure.getCause() instanceof SQLException) {
                log.error("No se pudo obtener el lock de recepción de {}", documentId, lockFailure);
                throw persistenceError(lockFailure);
            }
            throw lockFailure;
        }
    }

    private void receiveLocked(IncomingDocument document, String objectKey) {
        String documentId = document.documentId();
        try {
            if (persistenceService.existsDocument(documentId)) {
                throw duplicate();
            }
        } catch (RuntimeException exception) {
            if (isPersistenceFailure(exception)) {
                throw persistenceError(exception);
            }
            throw exception;
        }

        try {
            storageService.putRawBytesIfAbsent(objectKey, document.originalBytes(), document.storedMimeType());
        } catch (ObjectStorageService.ObjectAlreadyExistsException collision) {
            log.warn("Objeto OCI preexistente sin registro para {}; no se sobrescribe ni se elimina", documentId);
            throw duplicate();
        } catch (ObjectStorageService.StorageOperationException failure) {
            log.error("Fallo al subir el original de {} a OCI", documentId, failure);
            throw new DocumentProcessingException(BackendErrorCode.STORAGE_ERROR,
                    "No se pudo almacenar el documento.", failure);
        }

        try {
            persistenceService.createReceived(receivedRecord(document, objectKey));
        } catch (DocumentPersistenceService.DuplicateDocumentException collision) {
            deleteOwnObject(documentId, objectKey);
            throw duplicate();
        } catch (RuntimeException failure) {
            cleanupAfterInsertFailure(documentId, objectKey);
            if (isPersistenceFailure(failure)) {
                throw persistenceError(failure);
            }
            throw failure;
        }
    }

    private DocumentRecord receivedRecord(IncomingDocument document, String objectKey) {
        DocumentRecord record = new DocumentRecord();
        record.setId(document.documentId());
        record.setStatus(DocumentStatus.RECEIVED);
        record.setOriginChannel(document.originChannel());
        record.setInputType(document.inputType());
        record.setMimeType(document.storedMimeType());
        record.setFileName(document.fileName());
        record.setBucket(ociProperties.getBucketName());
        record.setObjectKey(objectKey);
        record.setStorageState(StorageState.PENDING);
        record.setRoutingDestination(PrimaryDestination.HUMAN_REVIEW);
        record.setRoutingJustification(PENDING_JUSTIFICATION);
        return record;
    }

    private void cleanupAfterInsertFailure(String documentId, String objectKey) {
        boolean rowExists;
        try {
            rowExists = persistenceService.existsDocument(documentId);
        } catch (RuntimeException inspectionFailure) {
            log.error("Resultado del insert incierto para {}; se conserva el objeto {} para conciliación manual",
                    documentId, objectKey, inspectionFailure);
            return;
        }
        if (rowExists) {
            log.error("El insert de {} reportó error pero el registro existe; se conserva el objeto {}",
                    documentId, objectKey);
            return;
        }
        deleteOwnObject(documentId, objectKey);
    }

    private void deleteOwnObject(String documentId, String objectKey) {
        try {
            storageService.deleteObject(objectKey);
        } catch (RuntimeException failure) {
            log.error("No se pudo eliminar el objeto {} creado por la solicitud de {}; requiere conciliación manual",
                    objectKey, documentId, failure);
        }
    }

    private void markProcessing(String documentId) {
        boolean marked;
        try {
            marked = persistenceService.markProcessing(documentId);
        } catch (RuntimeException failure) {
            if (isPersistenceFailure(failure)) {
                log.error("No se pudo registrar PROCESSING para {}", documentId, failure);
                throw persistenceError(failure);
            }
            throw failure;
        }
        if (!marked) {
            throw new IllegalStateException("No se pudo pasar a PROCESSING el documento " + documentId);
        }
    }

    private FinalizationCommand triage(IncomingDocument document) {
        String documentId = document.documentId();
        try {
            return interpreter.fromAiResponse(documentId, aiCoreClient.process(document.toProcessingRequest()));
        } catch (AiCoreClient.AiClientException failure) {
            log.warn("IA Core no produjo un resultado utilizable para {}: {}", documentId, failure.getAuditReason());
            return interpreter.fromTechnicalFailure(documentId, failure.getAuditReason());
        } catch (RuntimeException failure) {
            log.error("Fallo inesperado al procesar la respuesta de IA de {}", documentId, failure);
            return interpreter.fromTechnicalFailure(documentId, AuditReason.INVALID_AI_RESPONSE);
        }
    }

    private FinalizationOutcome finalizeResult(FinalizationCommand command) {
        try {
            return finalizationService.finalizeResult(command);
        } catch (ObjectStorageService.StorageOperationException failure) {
            throw new DocumentProcessingException(BackendErrorCode.STORAGE_ERROR,
                    "No se pudo completar el almacenamiento del documento.", failure);
        } catch (RuntimeException failure) {
            if (isPersistenceFailure(failure)
                    || failure instanceof DocumentPersistenceService.ConcurrentFinalizationException
                    || (failure instanceof IllegalStateException && failure.getCause() instanceof SQLException)) {
                log.error("Fallo de persistencia al finalizar {}", command.documentId(), failure);
                throw persistenceError(failure);
            }
            throw failure;
        }
    }

    private DocumentoCanonicoResponse respond(FinalizationOutcome outcome) {
        if (outcome.kind() != FinalizationOutcome.Kind.CONFIRMED) {
            log.error("Finalización sin persistencia OCI completa para {}: {}", outcome.documentId(), outcome.kind());
            throw new DocumentProcessingException(BackendErrorCode.STORAGE_ERROR,
                    "No se pudo completar el almacenamiento del documento.");
        }
        try {
            return responseMapper.toResponse(persistenceService.getDocument(outcome.documentId()));
        } catch (RuntimeException failure) {
            if (isPersistenceFailure(failure)) {
                throw persistenceError(failure);
            }
            throw failure;
        }
    }

    private DocumentProcessingException duplicate() {
        return new DocumentProcessingException(BackendErrorCode.DOCUMENT_ID_ALREADY_EXISTS,
                "Ya existe un documento con ese document_id.");
    }

    private DocumentProcessingException persistenceError(Throwable cause) {
        return new DocumentProcessingException(BackendErrorCode.PERSISTENCE_ERROR,
                "No se pudo persistir el documento.", cause);
    }

    private boolean isPersistenceFailure(Throwable failure) {
        return failure instanceof DataAccessException
                || failure instanceof PersistenceException
                || failure instanceof TransactionException;
    }
}
