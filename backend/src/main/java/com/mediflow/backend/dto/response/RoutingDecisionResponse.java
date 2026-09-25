package com.mediflow.backend.dto.response;

import com.mediflow.backend.enums.PrimaryDestination;
import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
public class RoutingDecisionResponse {
    private PrimaryDestination primaryDestination;
    private boolean requiresHumanReview;
    private List<String> auditReasons;
    private String justification;
}