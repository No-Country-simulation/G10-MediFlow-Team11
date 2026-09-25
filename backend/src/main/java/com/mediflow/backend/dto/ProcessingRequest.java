package com.mediflow.backend.dto;

import com.mediflow.backend.enums.InputType;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProcessingRequest {

    private String documentId;
    private InputType inputType;
    private String mimeType;
    private String fileName;
    private String contentBase64;
    private String documentText;
    private String originChannel;

    /** Regla de validación de la arquitectura §4: FILE exige contentBase64; TEXT exige documentText.*/
    public boolean isValid() {
        if (inputType == InputType.FILE) {
            return contentBase64 != null && !contentBase64.isBlank();
        }
        if (inputType == InputType.TEXT) {
            return documentText != null && !documentText.isBlank();
        }
        return false;
    }
}