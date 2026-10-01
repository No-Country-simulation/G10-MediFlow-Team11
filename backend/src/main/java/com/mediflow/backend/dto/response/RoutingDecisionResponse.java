package com.mediflow.backend.dto.response;

import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.PrimaryDestination;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class RoutingDecisionResponse {

    private PrimaryDestination primaryDestination;
    private boolean requiresHumanReview;
    private List<AuditReason> auditReasons;
    private String justification;
}
