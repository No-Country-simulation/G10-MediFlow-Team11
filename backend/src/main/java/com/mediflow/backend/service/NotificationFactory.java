package com.mediflow.backend.service;

import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class NotificationFactory {

    public Map<String, Object> forInitialTriage(
            String documentId,
            DocumentStatus status,
            PriorityLevel priority,
            PrimaryDestination destination
    ) {
        if (status == DocumentStatus.PROCESSED
                && priority == PriorityLevel.URGENT
                && destination == PrimaryDestination.MEDICAL_EMERGENCY) {
            Map<String, Object> notification = new LinkedHashMap<>();
            notification.put("generated", true);
            notification.put("type", PrimaryDestination.MEDICAL_EMERGENCY.name());
            notification.put("message",
                    "ALERTA URGENTE: el documento " + documentId + " requiere atención inmediata.");
            return notification;
        }
        return DocumentRecord.defaultNotification();
    }
}
