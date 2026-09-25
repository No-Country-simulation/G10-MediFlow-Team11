package com.mediflow.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;

/**
 * Representa el contrato de entrada multipart de POST /api/v1/documents/process-file
 * (arquitectura §3). No se usa con @ModelAttribute en el controlador: los nombres de
 * las partes multipart son snake_case (document_id, origin_channel) y este DTO usa
 * camelCase, por lo que el binding automático de Spring no coincidiría. El controlador
 * del ticket #25 seguirá recibiendo los parámetros con @RequestParam/@RequestPart tal
 * como está planeado, y puede construir esta instancia manualmente para validarla o
 * pasarla al servicio como un solo objeto en vez de 3 parámetros sueltos.
 */
@Getter
@Setter
public class ProcessFileRequest {

    private String documentId; // opcional, igual que en ProcessTextRequest

    @NotNull(message = "file es obligatorio")
    private MultipartFile file;

    @NotBlank(message = "origin_channel es obligatorio")
    private String originChannel;
}
