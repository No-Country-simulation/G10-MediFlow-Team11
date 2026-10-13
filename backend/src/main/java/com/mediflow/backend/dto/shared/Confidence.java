package com.mediflow.backend.dto.shared;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Confidence {
    @JsonProperty("classification")
    private Double classification;
    @JsonProperty("extraction")
    private Double extraction;
    @JsonProperty("global")
    private Double global;
}
