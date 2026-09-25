package com.mediflow.backend.dto.response;

import lombok.Getter;
import lombok.Setter;

/**
 * Formato común de errores HTTP Backend → Frontend (arquitectura §14):
 * { "error": { "code": "...", "message": "..." } }
 * Distinto de AiErrorResponse, que representa el contrato IA Core → Backend
 * (502 AI_OUTPUT_INVALID) y nunca se expone directamente al Frontend.
 */
@Getter
@Setter
public class ApiErrorResponse {

    private ErrorBody error;

    public ApiErrorResponse() {}

    public ApiErrorResponse(String code, String message) {
        this.error = new ErrorBody(code, message);
    }

    @Getter
    @Setter
    public static class ErrorBody {
        private String code;
        private String message;

        public ErrorBody() {}

        public ErrorBody(String code, String message) {
            this.code = code;
            this.message = message;
        }
    }
}
