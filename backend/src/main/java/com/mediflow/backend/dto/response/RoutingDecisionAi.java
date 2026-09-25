package com.mediflow.backend.dto.response;

import com.mediflow.backend.enums.PrimaryDestination;
import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
public class RoutingDecisionAi {
    private PrimaryDestination primaryDestination;
    private List<String> auditReasons;
    private String justification;
}