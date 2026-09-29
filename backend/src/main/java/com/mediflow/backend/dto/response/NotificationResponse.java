package com.mediflow.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.mediflow.backend.enums.PrimaryDestination;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class NotificationResponse {

    private boolean generated;
    private PrimaryDestination type;
    private String message;
}
