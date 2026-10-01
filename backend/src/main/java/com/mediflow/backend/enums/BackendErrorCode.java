package com.mediflow.backend.enums;

/**
 * Códigos mínimos del formato común de errores HTTP Backend → cliente (arquitectura §14).
 */
public enum BackendErrorCode {
    INVALID_REQUEST,
    INVALID_FILE_TYPE,
    REVIEW_VALIDATION_FAILED,
    DOCUMENT_NOT_FOUND,
    DOCUMENT_ID_ALREADY_EXISTS,
    INVALID_REVIEW_STATE,
    FILE_TOO_LARGE,
    STORAGE_ERROR,
    PERSISTENCE_ERROR
}
