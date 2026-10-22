package com.mediflow.backend.controller;

import com.mediflow.backend.dto.response.ApiErrorResponse;
import com.mediflow.backend.enums.BackendErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

/** Global a propósito: acotarlo al controlador deja sin formato el 413 de multipart (verificado en el IT). */
@RestControllerAdvice
public class ProcessingExceptionAdvice {

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> tooLarge(MaxUploadSizeExceededException exception) {
        return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE)
                .body(new ApiErrorResponse(BackendErrorCode.FILE_TOO_LARGE,
                        "La solicitud supera el tamaño máximo permitido."));
    }

    @ExceptionHandler({
            HttpMessageNotReadableException.class,
            MethodArgumentNotValidException.class,
            MultipartException.class,
            MissingServletRequestPartException.class,
            MissingServletRequestParameterException.class,
            HttpMediaTypeNotSupportedException.class
    })
    public ResponseEntity<ApiErrorResponse> invalidRequest(Exception exception) {
        return ResponseEntity.badRequest()
                .body(new ApiErrorResponse(BackendErrorCode.INVALID_REQUEST, messageFor(exception)));
    }

    private String messageFor(Exception exception) {
        if (exception instanceof MethodArgumentNotValidException invalid
                && invalid.getBindingResult().getFieldError() != null) {
            String message = invalid.getBindingResult().getFieldError().getDefaultMessage();
            if (message != null && !message.isBlank()) {
                return message;
            }
        }
        if (exception instanceof HttpMessageNotReadableException) {
            return "El cuerpo JSON de la solicitud no es válido.";
        }
        if (exception instanceof HttpMediaTypeNotSupportedException) {
            return "El tipo de contenido de la solicitud no está soportado.";
        }
        return "La solicitud no es válida.";
    }
}
