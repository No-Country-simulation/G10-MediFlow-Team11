package com.mediflow.backend.controller;

import com.mediflow.backend.dto.request.ProcessFileRequest;
import com.mediflow.backend.dto.request.ProcessTextRequest;
import com.mediflow.backend.dto.response.ApiErrorResponse;
import com.mediflow.backend.dto.response.DocumentoCanonicoResponse;
import com.mediflow.backend.enums.BackendErrorCode;
import com.mediflow.backend.service.DocumentProcessingException;
import com.mediflow.backend.service.DocumentProcessingService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.function.Supplier;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentProcessingController {

    private static final Logger log = LoggerFactory.getLogger(DocumentProcessingController.class);

    private final DocumentProcessingService processingService;

    public DocumentProcessingController(DocumentProcessingService processingService) {
        this.processingService = processingService;
    }

    @PostMapping(value = "/process-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Object> processFile(
            @RequestParam(name = "document_id", required = false) String documentId,
            @RequestParam(name = "file", required = false) MultipartFile file,
            @RequestParam(name = "origin_channel", required = false) String originChannel
    ) {
        ProcessFileRequest request = new ProcessFileRequest();
        request.setDocumentId(documentId);
        request.setFile(file);
        request.setOriginChannel(originChannel);
        return execute(() -> processingService.processFile(request));
    }

    @PostMapping(value = "/process-text", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> processText(@Valid @RequestBody ProcessTextRequest request) {
        return execute(() -> processingService.processText(request));
    }

    private ResponseEntity<Object> execute(Supplier<DocumentoCanonicoResponse> processing) {
        try {
            return ResponseEntity.ok(processing.get());
        } catch (DocumentProcessingException exception) {
            return ResponseEntity.status(statusFor(exception.getCode()))
                    .body(new ApiErrorResponse(exception.getCode(), exception.getMessage()));
        } catch (RuntimeException exception) {
            log.error("Error no clasificado al procesar un documento", exception);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", Map.of("message", "Error interno del servidor.")));
        }
    }

    private HttpStatus statusFor(BackendErrorCode code) {
        return switch (code) {
            case INVALID_REQUEST, INVALID_FILE_TYPE, REVIEW_VALIDATION_FAILED -> HttpStatus.BAD_REQUEST;
            case DOCUMENT_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case DOCUMENT_ID_ALREADY_EXISTS, INVALID_REVIEW_STATE -> HttpStatus.CONFLICT;
            case FILE_TOO_LARGE -> HttpStatus.CONTENT_TOO_LARGE;
            case STORAGE_ERROR, PERSISTENCE_ERROR -> HttpStatus.INTERNAL_SERVER_ERROR;
        };
    }
}
