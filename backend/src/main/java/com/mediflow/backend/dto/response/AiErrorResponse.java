package com.mediflow.backend.dto.response;

import com.mediflow.backend.dto.shared.ErrorBody;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Error controlado IA Core → Backend (arquitectura §5), p. ej. HTTP 502 AI_OUTPUT_INVALID.
 * No se expone al Frontend; el Backend lo traduce según §12.
 */
@Getter
@Setter
@NoArgsConstructor
public class AiErrorResponse {

    private ErrorBody error;

    public AiErrorResponse(String code, String message) {
        this.error = new ErrorBody(code, message);
    }
}
