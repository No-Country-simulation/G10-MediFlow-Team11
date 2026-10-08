package com.mediflow.backend.controller;

import com.mediflow.backend.dto.response.ApiErrorResponse;
import com.mediflow.backend.dto.response.AuditDocumentResponse;
import com.mediflow.backend.dto.response.DocumentHistoryResponse;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.enums.BackendErrorCode;
import com.mediflow.backend.enums.InputType;
import com.mediflow.backend.persistence.DocumentPersistenceService;
import com.mediflow.backend.service.DocumentResponseMapper;
import com.mediflow.backend.service.ObjectStorageService;
import jakarta.persistence.PersistenceException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;
import java.util.List;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentQueryController {

    private final DocumentPersistenceService persistenceService;
    private final DocumentResponseMapper responseMapper;
    private final ObjectStorageService storageService;

    public DocumentQueryController(DocumentPersistenceService persistenceService,
                                   DocumentResponseMapper responseMapper,
                                   ObjectStorageService storageService) {
        this.persistenceService = persistenceService;
        this.responseMapper = responseMapper;
        this.storageService = storageService;
    }

    @GetMapping("/audit")
    public ResponseEntity<Object> listAuditDocuments() {
        try {
            List<AuditDocumentResponse> documents = persistenceService.listAuditDocuments().stream()
                    .map(responseMapper::toAuditResponse)
                    .toList();
            return ResponseEntity.ok(documents);
        } catch (DataAccessException | PersistenceException exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiErrorResponse(BackendErrorCode.PERSISTENCE_ERROR, "No se pudieron consultar los documentos."));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Object> getDocument(@PathVariable String id) {
        Optional<DocumentRecord> document;
        try {
            document = persistenceService.findDocument(id);
        } catch (DataAccessException | PersistenceException exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiErrorResponse(BackendErrorCode.PERSISTENCE_ERROR, "No se pudo consultar el documento."));
        }
        if (document.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiErrorResponse(BackendErrorCode.DOCUMENT_NOT_FOUND, "Documento no encontrado."));
        }
        return ResponseEntity.ok(responseMapper.toResponse(document.get()));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<Object> getHistory(@PathVariable String id) {
        try {
            if (persistenceService.findDocument(id).isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiErrorResponse(BackendErrorCode.DOCUMENT_NOT_FOUND, "Documento no encontrado."));
            }
            List<DocumentHistoryResponse.Entry> entries = persistenceService.listHistory(id).stream()
                    .map(responseMapper::toHistoryEntry)
                    .toList();
            return ResponseEntity.ok(new DocumentHistoryResponse(id, entries));
        } catch (DataAccessException | PersistenceException exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiErrorResponse(BackendErrorCode.PERSISTENCE_ERROR, "No se pudo consultar el historial."));
        }
    }

    @GetMapping("/{id}/content")
    public ResponseEntity<Object> getContent(@PathVariable String id) {
        Optional<DocumentRecord> document;
        try {
            document = persistenceService.findDocument(id);
        } catch (DataAccessException | PersistenceException exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiErrorResponse(BackendErrorCode.PERSISTENCE_ERROR, "No se pudo consultar el documento."));
        }
        if (document.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiErrorResponse(BackendErrorCode.DOCUMENT_NOT_FOUND, "Documento no encontrado."));
        }

        DocumentRecord record = document.get();
        if (record.getObjectKey() == null || record.getObjectKey().isBlank()) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiErrorResponse(BackendErrorCode.STORAGE_ERROR, "No se pudo leer el contenido del documento."));
        }
        try {
            byte[] content = storageService.getObject(record.getObjectKey());
            MediaType contentType = record.getInputType() == InputType.TEXT
                    ? MediaType.APPLICATION_JSON
                    : MediaType.parseMediaType(record.getMimeType());
            return ResponseEntity.ok().contentType(contentType).body(content);
        } catch (ObjectStorageService.StorageOperationException exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiErrorResponse(BackendErrorCode.STORAGE_ERROR, "No se pudo leer el contenido del documento."));
        }
    }
}
