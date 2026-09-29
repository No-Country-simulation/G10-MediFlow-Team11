package com.mediflow.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;

/**
 * Contrato multipart de POST /api/v1/documents/process-file (arquitectura §3):
 * document_id (opcional), file, origin_channel.
 * Los nombres de parte en la petición HTTP son snake_case; el controlador
 * correspondiente debe bindir las partes y construir esta instancia.
 */
@Getter
@Setter
public class ProcessFileRequest {

    private String documentId;

    @NotNull(message = "file es obligatorio")
    private MultipartFile file;

    @NotBlank(message = "origin_channel es obligatorio")
    private String originChannel;
}
