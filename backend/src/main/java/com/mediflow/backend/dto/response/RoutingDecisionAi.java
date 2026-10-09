package com.mediflow.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.PrimaryDestination;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class RoutingDecisionAi {

    @JsonProperty("primary_destination")
    private PrimaryDestination primaryDestination;
    @JsonProperty("audit_reasons")
    private List<AuditReason> auditReasons;
    @JsonProperty("justification")
    private String justification;
}
