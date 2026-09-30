package com.mediflow.backend.dto.shared;

import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.PriorityLevel;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Classification {
    private DocumentType documentType;
    private String specialty;
    private PriorityLevel priorityLevel;
}
