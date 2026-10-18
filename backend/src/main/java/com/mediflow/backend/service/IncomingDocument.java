package com.mediflow.backend.service;

import com.mediflow.backend.dto.ProcessingRequest;
import com.mediflow.backend.enums.InputType;

import java.util.Base64;

public record IncomingDocument(
        String documentId,
        InputType inputType,
        String storedMimeType,
        String fileName,
        byte[] originalBytes,
        String documentText,
        String originChannel
) {

    public static final String TEXT_PROCESSING_MIME = "text/plain";

    public ProcessingRequest toProcessingRequest() {
        ProcessingRequest request = new ProcessingRequest();
        request.setDocumentId(documentId);
        request.setInputType(inputType);
        request.setOriginChannel(originChannel);
        if (inputType == InputType.FILE) {
            request.setMimeType(storedMimeType);
            request.setFileName(fileName);
            request.setContentBase64(Base64.getEncoder().encodeToString(originalBytes));
        } else {
            request.setMimeType(TEXT_PROCESSING_MIME);
            request.setDocumentText(documentText);
        }
        return request;
    }
}
