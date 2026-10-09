package com.mediflow.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediflow.backend.dto.ProcessingRequest;
import com.mediflow.backend.dto.response.AiErrorResponse;
import com.mediflow.backend.dto.response.AiProcessResponse;
import com.mediflow.backend.enums.AuditReason;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.net.http.HttpClient;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.concurrent.TimeoutException;

@Service
public class AiCoreClient {

    private static final Logger log = LoggerFactory.getLogger(AiCoreClient.class);

    private final RestClient restClient;
    private final AiCoreProperties properties;
    private final ObjectMapper objectMapper;

    public AiCoreClient(AiCoreProperties properties, RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder
                .baseUrl(properties.getProcessEndpoint())
                .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .requestFactory(requestFactory())
                .build();
    }

    public AiProcessResponse process(ProcessingRequest request) {
        AuditReason lastTechnicalFailure = null;
        int maxAttempts = Math.max(1, Math.min(2, properties.getMaxAttempts()));

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                String responseBody = sendRequest(request);
                return validateSuccessfulResponse(request.getDocumentId(), responseBody);
            } catch (AiClientRetryableException retryableException) {
                lastTechnicalFailure = retryableException.getAuditReason();
                if (attempt >= maxAttempts) {
                    throw retryableException.toFinalFailure();
                }
                log.warn("Retrying AI Core request. attempt={}/{} reason={}", attempt, maxAttempts, retryableException.getAuditReason());
            } catch (AiClientNonRetryableException nonRetryableException) {
                throw nonRetryableException.asFatal();
            }
        }

        if (lastTechnicalFailure != null) {
            throw new AiClientFatalException(lastTechnicalFailure);
        }

        throw new AiClientFatalException(AuditReason.INVALID_AI_RESPONSE);
    }

    private String sendRequest(ProcessingRequest request) {
        try {
            return restClient.post()
                    .body(request)
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (httpRequest, response) -> {
                        String body = response.getBody() == null ? "" : new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);
                        throw new AiClientNonRetryableException(AuditReason.INVALID_AI_RESPONSE, response.getStatusCode(), body);
                    })
                    .onStatus(HttpStatusCode::is5xxServerError, (httpRequest, response) -> {
                        String body = response.getBody() == null ? "" : new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);
                        if (response.getStatusCode().value() == 502 && isAiOutputInvalid(body)) {
                            throw new AiClientRetryableException(AuditReason.INVALID_AI_RESPONSE, response.getStatusCode(), body);
                        }
                        throw new AiClientRetryableException(AuditReason.AI_UNAVAILABLE, response.getStatusCode(), body);
                    })
                    .onStatus(status -> status.value() != 200, (httpRequest, response) -> {
                        String body = response.getBody() == null ? "" : new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);
                        throw new AiClientNonRetryableException(AuditReason.INVALID_AI_RESPONSE, response.getStatusCode(), body);
                    })
                    .body(String.class);
        } catch (AiClientRetryableException ex) {
            throw ex;
        } catch (AiClientNonRetryableException ex) {
            throw ex;
        } catch (AiClientFatalException ex) {
            throw ex;
        } catch (ResourceAccessException ex) {
            AuditReason reason = isTimeout(ex) ? AuditReason.AI_TIMEOUT : AuditReason.AI_UNAVAILABLE;
            throw new AiClientRetryableException(reason, ex);
        } catch (HttpClientErrorException ex) {
            throw new AiClientNonRetryableException(AuditReason.INVALID_AI_RESPONSE, ex.getStatusCode(), ex.getResponseBodyAsString());
        } catch (HttpServerErrorException ex) {
            if (ex.getStatusCode().value() == 502 && isAiOutputInvalid(ex.getResponseBodyAsString())) {
                throw new AiClientRetryableException(AuditReason.INVALID_AI_RESPONSE, ex.getStatusCode(), ex.getResponseBodyAsString());
            }
            throw new AiClientRetryableException(AuditReason.AI_UNAVAILABLE, ex.getStatusCode(), ex.getResponseBodyAsString());
        } catch (RestClientException ex) {
            throw new AiClientFatalException(AuditReason.INVALID_AI_RESPONSE, ex);
        } catch (Exception ex) {
            throw new AiClientFatalException(AuditReason.INVALID_AI_RESPONSE, ex);
        }
    }

    private AiProcessResponse validateSuccessfulResponse(String expectedDocumentId, String responseBody) {
        AiProcessResponse parsedResponse = parseSuccessfulResponse(responseBody);
        if (expectedDocumentId != null && !expectedDocumentId.equals(parsedResponse.getDocumentId())) {
            throw new AiClientFatalException(AuditReason.INVALID_AI_RESPONSE, "document_id mismatch");
        }
        return parsedResponse;
    }

    private AiProcessResponse parseSuccessfulResponse(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            throw new AiClientFatalException(AuditReason.INVALID_AI_RESPONSE, "AI Core returned an empty body");
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            if (!isValidResponseContract(root)) {
                throw new AiClientFatalException(AuditReason.INVALID_AI_RESPONSE, "AI response does not match the success contract");
            }
            return objectMapper.treeToValue(root, AiProcessResponse.class);
        } catch (JsonProcessingException exception) {
            throw new AiClientFatalException(AuditReason.INVALID_AI_RESPONSE, exception);
        }
    }

    private boolean isValidResponseContract(JsonNode root) {
        if (root == null || !root.isObject() || !isNonEmptyText(root.get("document_id"))) {
            return false;
        }

        JsonNode classification = root.get("classification");
        if (!isObject(classification)
                || !isNonEmptyText(classification.get("document_type"))
                || !isNonEmptyText(classification.get("priority_level"))
                || !isOptionalText(classification.get("specialty"))) {
            return false;
        }

        JsonNode confidence = root.get("confidence");
        if (!isObject(confidence)
                || !isValidConfidence(confidence.get("classification"))
                || !isValidConfidence(confidence.get("extraction"))
                || !isValidConfidence(confidence.get("global"))) {
            return false;
        }

        JsonNode extractedData = root.get("extracted_data");
        if (!isObject(extractedData) || !isValidExtractedData(extractedData)) {
            return false;
        }

        JsonNode validation = root.get("validation");
        if (!isObject(validation)
                || !isStringArray(validation.get("missing_fields"))
                || !isStringArray(validation.get("inconsistencies"))
                || !isStringArray(validation.get("warnings"))) {
            return false;
        }

        JsonNode routingDecision = root.get("routing_decision");
        if (!isObject(routingDecision)
                || !isNonEmptyText(routingDecision.get("primary_destination"))
                || !isStringArray(routingDecision.get("audit_reasons"))
                || !isNonEmptyText(routingDecision.get("justification"))) {
            return false;
        }
        for (JsonNode reason : routingDecision.get("audit_reasons")) {
            try {
                if (!objectMapper.treeToValue(reason, AuditReason.class).isSemantic()) {
                    return false;
                }
            } catch (JsonProcessingException exception) {
                return false;
            }
        }
        return true;
    }

    private boolean isValidExtractedData(JsonNode extractedData) {
        if (!isOptionalObject(extractedData.get("patient"))
                || !isOptionalObject(extractedData.get("requesting_doctor"))
                || !isOptionalText(extractedData.get("primary_diagnosis"))
                || !isOptionalText(extractedData.get("suggested_icd10"))
                || !isOptionalObjectArray(extractedData.get("medications"), "name", "dosage")
                || !isOptionalObjectArray(extractedData.get("requested_studies"), "name")) {
            return false;
        }

        JsonNode patient = extractedData.get("patient");
        if (isObject(patient)
                && (!isOptionalText(patient.get("name"))
                || !isOptionalNonNegativeInteger(patient.get("age")))) {
            return false;
        }

        JsonNode doctor = extractedData.get("requesting_doctor");
        return !isObject(doctor)
                || (isOptionalText(doctor.get("name"))
                && isOptionalText(doctor.get("license_number")));
    }

    private boolean isOptionalObjectArray(JsonNode value, String... textFields) {
        if (value == null || value.isNull()) {
            return true;
        }
        if (!value.isArray()) {
            return false;
        }
        for (JsonNode item : value) {
            if (!isObject(item)) {
                return false;
            }
            for (String field : textFields) {
                if (!isOptionalText(item.get(field))) {
                    return false;
                }
            }
        }
        return true;
    }

    private boolean isStringArray(JsonNode value) {
        if (value == null || !value.isArray()) {
            return false;
        }
        for (JsonNode item : value) {
            if (!item.isTextual()) {
                return false;
            }
        }
        return true;
    }

    private boolean isValidConfidence(JsonNode value) {
        return value != null && value.isNumber()
                && Double.isFinite(value.doubleValue())
                && value.doubleValue() >= 0.0
                && value.doubleValue() <= 1.0;
    }

    private boolean isOptionalNonNegativeInteger(JsonNode value) {
        return value == null || value.isNull()
                || (value.isIntegralNumber() && value.canConvertToInt() && value.intValue() >= 0);
    }

    private boolean isOptionalText(JsonNode value) {
        return value == null || value.isNull() || value.isTextual();
    }

    private boolean isNonEmptyText(JsonNode value) {
        return value != null && value.isTextual() && !value.textValue().isBlank();
    }

    private boolean isOptionalObject(JsonNode value) {
        return value == null || value.isNull() || value.isObject();
    }

    private boolean isObject(JsonNode value) {
        return value != null && value.isObject();
    }

    private boolean isAiOutputInvalid(String body) {
        if (body == null || body.isBlank()) {
            return false;
        }
        try {
            AiErrorResponse errorResponse = objectMapper.readValue(body, AiErrorResponse.class);
            return errorResponse.getError() != null
                    && "AI_OUTPUT_INVALID".equals(errorResponse.getError().getCode());
        } catch (JsonProcessingException exception) {
            return false;
        }
    }

    private boolean isTimeout(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof SocketTimeoutException
                    || cause instanceof HttpTimeoutException
                    || cause instanceof TimeoutException) {
                return true;
            }
        }
        return false;
    }

    private JdkClientHttpRequestFactory requestFactory() {
        HttpClient httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(Math.max(1, properties.getRequestTimeoutSeconds())));
        return factory;
    }

    public static class AiClientException extends RuntimeException {
        private final AuditReason auditReason;
        public AiClientException(AuditReason auditReason, String message) {
            super(message);
            this.auditReason = auditReason;
        }
        public AiClientException(AuditReason auditReason, Throwable cause) {
            super(cause);
            this.auditReason = auditReason;
        }
        public AiClientException(AuditReason auditReason, String message, Throwable cause) {
            super(message, cause);
            this.auditReason = auditReason;
        }
        public AuditReason getAuditReason() { return auditReason; }
    }

    public static class AiClientRetryableException extends AiClientException {
        private final HttpStatusCode statusCode;
        private final String responseBody;

        public AiClientRetryableException(AuditReason auditReason, Throwable cause) {
            super(auditReason, cause);
            this.statusCode = null;
            this.responseBody = null;
        }

        public AiClientRetryableException(AuditReason auditReason, HttpStatusCode statusCode, String responseBody) {
            super(auditReason, "AI Core request failed with status " + statusCode + ": " + responseBody);
            this.statusCode = statusCode;
            this.responseBody = responseBody;
        }

        public AiClientFatalException toFinalFailure() {
            return new AiClientFatalException(getAuditReason(), getMessage(), this);
        }

        public HttpStatusCode getStatusCode() { return statusCode; }
        public String getResponseBody() { return responseBody; }
    }

    public static class AiClientNonRetryableException extends AiClientException {
        private final HttpStatusCode statusCode;
        private final String responseBody;

        public AiClientNonRetryableException(AuditReason auditReason, HttpStatusCode statusCode, String responseBody) {
            super(auditReason, "AI Core returned unacceptable response " + statusCode + ": " + responseBody);
            this.statusCode = statusCode;
            this.responseBody = responseBody;
        }

        public AiClientFatalException asFatal() {
            return new AiClientFatalException(getAuditReason(), getMessage(), this);
        }

        public HttpStatusCode getStatusCode() { return statusCode; }
        public String getResponseBody() { return responseBody; }
    }

    public static class AiClientFatalException extends AiClientException {
        public AiClientFatalException(AuditReason auditReason) {
            super(auditReason, auditReason.name());
        }
        public AiClientFatalException(AuditReason auditReason, String message) {
            super(auditReason, message);
        }
        public AiClientFatalException(AuditReason auditReason, Throwable cause) {
            super(auditReason, cause);
        }
        public AiClientFatalException(AuditReason auditReason, String message, Throwable cause) {
            super(auditReason, message, cause);
        }
    }
}
