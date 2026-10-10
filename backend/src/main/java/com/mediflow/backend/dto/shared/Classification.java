package com.mediflow.backend.dto.shared;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.PriorityLevel;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Classification {
    @JsonProperty("document_type")
    private DocumentType documentType;
    @JsonProperty("specialty")
    private String specialty;
    @JsonProperty("priority_level")
    private PriorityLevel priorityLevel;
}
