package com.mediflow.backend.service;

import com.mediflow.backend.enums.BackendErrorCode;

public class DocumentProcessingException extends RuntimeException {

    private final BackendErrorCode code;

    public DocumentProcessingException(BackendErrorCode code, String message) {
        super(message);
        this.code = code;
    }

    public DocumentProcessingException(BackendErrorCode code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public BackendErrorCode getCode() {
        return code;
    }
}
