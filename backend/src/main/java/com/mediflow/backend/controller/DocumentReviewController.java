package com.mediflow.backend.controller;

import com.mediflow.backend.dto.request.HumanReviewRequest;
import com.mediflow.backend.dto.response.ApiErrorResponse;
import com.mediflow.backend.dto.response.HumanReviewResponse;
import com.mediflow.backend.enums.BackendErrorCode;
import com.mediflow.backend.service.FinalizationOutcome;
import com.mediflow.backend.service.HumanReviewService;
import com.mediflow.backend.service.ObjectStorageService;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.transaction.TransactionException;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentReviewController {
    private final HumanReviewService reviewService;

    public DocumentReviewController(HumanReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @PatchMapping("/{id}/review")
    public ResponseEntity<Object> review(@PathVariable String id, @RequestBody HumanReviewRequest request) {
        try {
            FinalizationOutcome outcome = reviewService.review(id, request);
            if (outcome.kind() != FinalizationOutcome.Kind.CONFIRMED) {
                BackendErrorCode code = outcome.kind() == FinalizationOutcome.Kind.FALLBACK_DURABLE
                        || !outcome.originalRecoverable() ? BackendErrorCode.STORAGE_ERROR : BackendErrorCode.PERSISTENCE_ERROR;
                return ResponseEntity.internalServerError()
                        .body(new ApiErrorResponse(code, "No se pudo confirmar la revisión completa."));
            }
            return ResponseEntity.ok(new HumanReviewResponse(id, outcome.status().name(),
                    "Revisión humana registrada correctamente"));
        } catch (HumanReviewService.DocumentNotFoundException exception) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiErrorResponse(BackendErrorCode.DOCUMENT_NOT_FOUND, "Documento no encontrado."));
        } catch (HumanReviewService.ReviewValidationException exception) {
            return ResponseEntity.badRequest()
                    .body(new ApiErrorResponse(BackendErrorCode.REVIEW_VALIDATION_FAILED, "La revisión no cumple el contrato requerido."));
        } catch (HumanReviewService.InvalidReviewStateException
                 | com.mediflow.backend.persistence.DocumentPersistenceService.ReviewConflictException exception) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new ApiErrorResponse(BackendErrorCode.INVALID_REVIEW_STATE, "El documento ya no está pendiente de revisión."));
        } catch (ObjectStorageService.StorageOperationException exception) {
            return ResponseEntity.internalServerError()
                    .body(new ApiErrorResponse(BackendErrorCode.STORAGE_ERROR, "No se pudo confirmar la revisión en almacenamiento."));
        } catch (DataAccessException | jakarta.persistence.PersistenceException | TransactionException exception) {
            return ResponseEntity.internalServerError()
                    .body(new ApiErrorResponse(BackendErrorCode.PERSISTENCE_ERROR, "No se pudo persistir la revisión."));
        }
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> invalidJson(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest()
                .body(new ApiErrorResponse(BackendErrorCode.INVALID_REQUEST, "El cuerpo JSON de la revisión no es válido."));
    }
}
