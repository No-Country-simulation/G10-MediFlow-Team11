package com.mediflow.backend.dto.shared;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class Validation {
    @JsonProperty("missing_fields")
    private List<String> missingFields;
    @JsonProperty("inconsistencies")
    private List<String> inconsistencies;
    @JsonProperty("warnings")
    private List<String> warnings;
}
