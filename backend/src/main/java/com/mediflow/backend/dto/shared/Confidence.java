package com.mediflow.backend.dto.shared;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Confidence {
    private Double classification;
    private Double extraction;
    private Double global;
}
