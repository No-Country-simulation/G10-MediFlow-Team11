package com.mediflow.backend.dto.response;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AiErrorResponse {
    private ErrorBody error;

    @Getter
    @Setter
    public static class ErrorBody {
        private String code; //p.ej. "AI_OUTPUT_INVALID"
        private String message;
    }
}