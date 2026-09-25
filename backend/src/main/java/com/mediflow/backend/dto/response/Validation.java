package com.mediflow.backend.dto.response;

import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
public class Validation {
    private List<String> missingFields;
    private List<String> inconsistencies;
    private List<String> warnings;
}