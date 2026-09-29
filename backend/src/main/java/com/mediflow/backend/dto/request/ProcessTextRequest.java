package com.mediflow.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/**
 * Contrato JSON de POST /api/v1/documents/process-text (arquitectura §3).
 * document_id es opcional: si no viene, el Backend lo genera.
 */
@Getter
@Setter
public class ProcessTextRequest {

    private String documentId;

    @NotBlank(message = "document_text es obligatorio")
    private String documentText;

    @NotBlank(message = "origin_channel es obligatorio")
    private String originChannel;
}
