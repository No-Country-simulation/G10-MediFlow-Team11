package com.mediflow.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
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
                AiProcessResponse response = sendRequest(request);
                validateSuccessfulResponse(request.getDocumentId(), response);
                return response;
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

    private AiProcessResponse sendRequest(ProcessingRequest request) {
        try {
            return restClient.post()
                    .body(request)
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (httpRequest, response) -> {
                        String body = response.getBody() == null ? "" : new String(response.getBody().readAllBytes());
                        throw new AiClientNonRetryableException(AuditReason.INVALID_AI_RESPONSE, response.getStatusCode(), body);
                    })
                    .onStatus(HttpStatusCode::is5xxServerError, (httpRequest, response) -> {
                        String body = response.getBody() == null ? "" : new String(response.getBody().readAllBytes());
                        if (response.getStatusCode().value() == 502 && isAiOutputInvalid(body)) {
                            throw new AiClientRetryableException(AuditReason.INVALID_AI_RESPONSE, response.getStatusCode(), body);
                        }
                        throw new AiClientRetryableException(AuditReason.AI_UNAVAILABLE, response.getStatusCode(), body);
                    })
                    .body(AiProcessResponse.class);
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

    private void validateSuccessfulResponse(String expectedDocumentId, AiProcessResponse response) {
        if (response == null) {
            throw new AiClientFatalException(AuditReason.INVALID_AI_RESPONSE, "AI Core returned a null body");
        }
        if (response.getDocumentId() == null || response.getDocumentId().isBlank()) {
            throw new AiClientFatalException(AuditReason.INVALID_AI_RESPONSE, "document_id missing from AI response");
        }
        if (expectedDocumentId != null && !expectedDocumentId.equals(response.getDocumentId())) {
            throw new AiClientFatalException(AuditReason.INVALID_AI_RESPONSE, "document_id mismatch");
        }
        if (response.getClassification() == null || response.getConfidence() == null || response.getExtractedData() == null
                || response.getValidation() == null || response.getRoutingDecision() == null) {
            throw new AiClientFatalException(AuditReason.INVALID_AI_RESPONSE, "AI response is structurally incomplete");
        }
        if (response.getClassification().getDocumentType() == null || response.getClassification().getPriorityLevel() == null) {
            throw new AiClientFatalException(AuditReason.INVALID_AI_RESPONSE, "classification is invalid");
        }
        if (response.getConfidence().getClassification() == null || response.getConfidence().getExtraction() == null || response.getConfidence().getGlobal() == null) {
            throw new AiClientFatalException(AuditReason.INVALID_AI_RESPONSE, "confidence is invalid");
        }
        if (response.getRoutingDecision().getPrimaryDestination() == null || response.getRoutingDecision().getJustification() == null || response.getRoutingDecision().getJustification().isBlank()) {
            throw new AiClientFatalException(AuditReason.INVALID_AI_RESPONSE, "routing decision is invalid");
        }
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
                .connectTimeout(Duration.ofSeconds(properties.getConnectTimeoutSeconds()))
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(properties.getRequestTimeoutSeconds()));
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
