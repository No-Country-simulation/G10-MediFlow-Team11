package com.mediflow.backend.dto.response;

import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.PriorityLevel;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Classification {
    private DocumentType documentType;
    private String specialty; //string o null
    private PriorityLevel priorityLevel;
}
