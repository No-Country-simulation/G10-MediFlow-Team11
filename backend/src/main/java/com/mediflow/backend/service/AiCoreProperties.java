package com.mediflow.backend.service;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "mediflow.ai")
public class AiCoreProperties {
    private String serviceUrl = "http://localhost:8000";
    private int requestTimeoutSeconds = 30;
    private int maxAttempts = 2;

    public String getProcessEndpoint() {
        String normalized = serviceUrl == null ? "" : serviceUrl.trim();
        if (normalized.isEmpty()) {
            return "http://localhost:8000/api/v1/ai/process";
        }
        return normalized.endsWith("/")
                ? normalized + "api/v1/ai/process"
                : normalized + "/api/v1/ai/process";
    }
}
