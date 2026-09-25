package com.mediflow.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProcessTextRequest {
    private String documentId; //opcional; si no viene,el Backend genera uno(ticket#25)

    @NotBlank(message = "document_text es obligatorio")
    private String documentText;

    @NotBlank(message = "origin_channel es obligatorio")
    private String originChannel;
}