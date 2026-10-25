package com.mediflow.backend.dto.response;

import com.mediflow.backend.dto.shared.ErrorBody;
import com.mediflow.backend.enums.BackendErrorCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Formato común de errores HTTP Backend → cliente (arquitectura §14).
 * Distinto de {@link AiErrorResponse} (contrato interno IA → Backend).
 */
@Getter
@Setter
@NoArgsConstructor
public class ApiErrorResponse {

    private ErrorBody error;

    public ApiErrorResponse(String code, String message) {
        this.error = new ErrorBody(code, message);
    }

    public ApiErrorResponse(BackendErrorCode code, String message) {
        this(code.name(), message);
    }
}
