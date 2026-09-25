package com.mediflow.backend.dto.response;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NotificationResponse {
    private boolean generated;
    private String type; //null si generated =false
    private String message; //null si generated =false
}
