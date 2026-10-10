package com.mediflow.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediflow.backend.dto.ProcessingRequest;
import com.mediflow.backend.dto.response.AiProcessResponse;
import com.mediflow.backend.dto.response.RoutingDecisionAi;
import com.mediflow.backend.dto.shared.Classification;
import com.mediflow.backend.dto.shared.Confidence;
import com.mediflow.backend.dto.shared.ExtractedData;
import com.mediflow.backend.dto.shared.Validation;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.InputType;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.lang.reflect.Field;
import java.net.ConnectException;
import java.net.InetSocketAddress;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class AiCoreClientTest {

    @Test
    void requestTimeoutIsConfiguredAsOneThirtySecondRequestDeadline() throws Exception {
        ClientFixture fixture = fixture(properties());
        ArgumentCaptor<ClientHttpRequestFactory> factoryCaptor =
                ArgumentCaptor.forClass(ClientHttpRequestFactory.class);

        verify(fixture.builder()).requestFactory(factoryCaptor.capture());
        JdkClientHttpRequestFactory requestFactory =
                assertInstanceOf(JdkClientHttpRequestFactory.class, factoryCaptor.getValue());
        Field timeoutField = JdkClientHttpRequestFactory.class.getDeclaredField("readTimeout");
        timeoutField.setAccessible(true);

        assertEquals(Duration.ofSeconds(30), timeoutField.get(requestFactory));
    }

    @Test
    void processReturnsValidResponseWhenAiCoreReturnsSuccessfulPayload() {
        ClientFixture fixture = fixture(properties());
        doReturn(json(validResponse("DOC-42"))).when(fixture.responseSpec()).body(String.class);

        AiProcessResponse response = fixture.client().process(validRequest("DOC-42"));

        assertNotNull(response);
        assertEquals("DOC-42", response.getDocumentId());
        assertEquals(DocumentType.IMAGING_REPORT, response.getClassification().getDocumentType());
        assertEquals(PriorityLevel.URGENT, response.getClassification().getPriorityLevel());
        assertEquals(0.96, response.getConfidence().getGlobal());
        verify(fixture.builder()).baseUrl("http://example.com/api/v1/ai/process");
        verify(fixture.restClient(), times(1)).post();
    }

    @Test
    void processRetriesTimeoutOnceAndReturnsAiTimeoutWhenBothAttemptsFail() {
        ClientFixture fixture = fixture(properties());
        doThrow(new ResourceAccessException("Request timed out", new HttpTimeoutException("timed out")))
                .when(fixture.requestBodySpec()).retrieve();

        AiCoreClient.AiClientFatalException exception = assertThrows(
                AiCoreClient.AiClientFatalException.class,
                () -> fixture.client().process(validRequest("DOC-42"))
        );

        assertEquals(AuditReason.AI_TIMEOUT, exception.getAuditReason());
        verify(fixture.restClient(), times(2)).post();
    }

    @Test
    void processRetriesConnectionFailureAndReturnsAiUnavailableWhenBothAttemptsFail() {
        ClientFixture fixture = fixture(properties());
        doThrow(new ResourceAccessException("Connection failed", new ConnectException("refused")))
                .when(fixture.requestBodySpec()).retrieve();

        AiCoreClient.AiClientFatalException exception = assertThrows(
                AiCoreClient.AiClientFatalException.class,
                () -> fixture.client().process(validRequest("DOC-42"))
        );

        assertEquals(AuditReason.AI_UNAVAILABLE, exception.getAuditReason());
        verify(fixture.restClient(), times(2)).post();
    }

    @Test
    void processDoesNotExceedTwoAttemptsWhenConfiguredWithHigherMaximum() {
        AiCoreProperties properties = properties();
        properties.setMaxAttempts(5);
        ClientFixture fixture = fixture(properties);
        doThrow(serverError(HttpStatus.SERVICE_UNAVAILABLE, "{\"detail\":\"down\"}"))
                .when(fixture.responseSpec()).body(String.class);

        AiCoreClient.AiClientFatalException exception = assertThrows(
                AiCoreClient.AiClientFatalException.class,
                () -> fixture.client().process(validRequest("DOC-42"))
        );

        assertEquals(AuditReason.AI_UNAVAILABLE, exception.getAuditReason());
        verify(fixture.restClient(), times(2)).post();
    }

    @Test
    void processDoesNotRetryWhenAiCoreReturns4xx() {
        ClientFixture fixture = fixture(properties());
        doThrow(clientError(HttpStatus.BAD_REQUEST, "{\"error\":{\"code\":\"INVALID_REQUEST\"}}"))
                .when(fixture.responseSpec()).body(String.class);

        AiCoreClient.AiClientFatalException exception = assertThrows(
                AiCoreClient.AiClientFatalException.class,
                () -> fixture.client().process(validRequest("DOC-42"))
        );

        assertEquals(AuditReason.INVALID_AI_RESPONSE, exception.getAuditReason());
        verify(fixture.restClient(), times(1)).post();
    }

    @Test
    void processRetries502AiOutputInvalidAndMapsFinalFailureToInvalidAiResponse() {
        ClientFixture fixture = fixture(properties());
        doThrow(serverError(HttpStatus.BAD_GATEWAY, "{\"error\":{\"code\":\"AI_OUTPUT_INVALID\"}}"))
                .when(fixture.responseSpec()).body(String.class);

        AiCoreClient.AiClientFatalException exception = assertThrows(
                AiCoreClient.AiClientFatalException.class,
                () -> fixture.client().process(validRequest("DOC-42"))
        );

        assertEquals(AuditReason.INVALID_AI_RESPONSE, exception.getAuditReason());
        verify(fixture.restClient(), times(2)).post();
    }

    @Test
    void processDoesNotRetryWhenHttp200BodyIsStructurallyInvalid() {
        ClientFixture fixture = fixture(properties());
        doReturn(json(new AiProcessResponse())).when(fixture.responseSpec()).body(String.class);

        AiCoreClient.AiClientFatalException exception = assertThrows(
                AiCoreClient.AiClientFatalException.class,
                () -> fixture.client().process(validRequest("DOC-42"))
        );

        assertEquals(AuditReason.INVALID_AI_RESPONSE, exception.getAuditReason());
        verify(fixture.restClient(), times(1)).post();
    }

    @Test
    void processRejectsConfidenceOutsideContractRange() {
        ClientFixture fixture = fixture(properties());
        AiProcessResponse response = validResponse("DOC-42");
        response.getConfidence().setExtraction(1.01);
        doReturn(json(response)).when(fixture.responseSpec()).body(String.class);

        AiCoreClient.AiClientFatalException exception = assertThrows(
                AiCoreClient.AiClientFatalException.class,
                () -> fixture.client().process(validRequest("DOC-42"))
        );

        assertEquals(AuditReason.INVALID_AI_RESPONSE, exception.getAuditReason());
        verify(fixture.restClient(), times(1)).post();
    }

    @Test
    void processRejectsMissingRequiredValidationArrays() {
        ClientFixture fixture = fixture(properties());
        AiProcessResponse response = validResponse("DOC-42");
        response.getValidation().setWarnings(null);
        doReturn(json(response)).when(fixture.responseSpec()).body(String.class);

        AiCoreClient.AiClientFatalException exception = assertThrows(
                AiCoreClient.AiClientFatalException.class,
                () -> fixture.client().process(validRequest("DOC-42"))
        );

        assertEquals(AuditReason.INVALID_AI_RESPONSE, exception.getAuditReason());
        verify(fixture.restClient(), times(1)).post();
    }

    @Test
    void processRejectsTechnicalAuditReasonsFromSuccessfulAiResponse() {
        ClientFixture fixture = fixture(properties());
        AiProcessResponse response = validResponse("DOC-42");
        response.getRoutingDecision().setAuditReasons(List.of(AuditReason.AI_TIMEOUT));
        doReturn(json(response)).when(fixture.responseSpec()).body(String.class);

        AiCoreClient.AiClientFatalException exception = assertThrows(
                AiCoreClient.AiClientFatalException.class,
                () -> fixture.client().process(validRequest("DOC-42"))
        );

        assertEquals(AuditReason.INVALID_AI_RESPONSE, exception.getAuditReason());
        verify(fixture.restClient(), times(1)).post();
    }

    @Test
    void processRejectsResponseForDifferentDocumentIdWithoutRetrying() {
        ClientFixture fixture = fixture(properties());
        doReturn(json(validResponse("DOC-OTHER"))).when(fixture.responseSpec()).body(String.class);

        AiCoreClient.AiClientFatalException exception = assertThrows(
                AiCoreClient.AiClientFatalException.class,
                () -> fixture.client().process(validRequest("DOC-42"))
        );

        assertEquals(AuditReason.INVALID_AI_RESPONSE, exception.getAuditReason());
        verify(fixture.restClient(), times(1)).post();
    }

    @Test
    void processPreservesSemanticAuditReasonsFromAiCore() {
        ClientFixture fixture = fixture(properties());
        AiProcessResponse aiResponse = validResponse("DOC-42");
        aiResponse.getRoutingDecision().setAuditReasons(List.of(AuditReason.LOW_CONFIDENCE));
        doReturn(json(aiResponse)).when(fixture.responseSpec()).body(String.class);

        AiProcessResponse response = fixture.client().process(validRequest("DOC-42"));

        assertEquals(List.of(AuditReason.LOW_CONFIDENCE), response.getRoutingDecision().getAuditReasons());
    }

    @Test
    void processDoesNotTreatErrorCodeMentionOutsideErrorEnvelopeAsAiOutputInvalid() {
        ClientFixture fixture = fixture(properties());
        doThrow(serverError(HttpStatus.BAD_GATEWAY, "{\"detail\":\"AI_OUTPUT_INVALID\"}"))
                .when(fixture.responseSpec()).body(String.class);

        AiCoreClient.AiClientFatalException exception = assertThrows(
                AiCoreClient.AiClientFatalException.class,
                () -> fixture.client().process(validRequest("DOC-42"))
        );

        assertEquals(AuditReason.AI_UNAVAILABLE, exception.getAuditReason());
        verify(fixture.restClient(), times(2)).post();
    }

    @Test
    void processDiscardsTransientFailureWhenSecondAttemptSucceeds() {
        ClientFixture fixture = fixture(properties());
        doThrow(serverError(HttpStatus.SERVICE_UNAVAILABLE, "{\"detail\":\"down\"}"))
                .doReturn(json(validResponse("DOC-42")))
                .when(fixture.responseSpec()).body(String.class);

        AiProcessResponse response = fixture.client().process(validRequest("DOC-42"));

        assertNotNull(response);
        assertEquals("DOC-42", response.getDocumentId());
        verify(fixture.restClient(), times(2)).post();
    }

    @Test
    void processAcceptsOnlyHttp200AndDoesNotRetryOtherSuccessOrRedirectStatuses() throws Exception {
        for (int status : List.of(202, 302)) {
            AtomicInteger requestCount = new AtomicInteger();
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/api/v1/ai/process", exchange -> {
                requestCount.incrementAndGet();
                exchange.sendResponseHeaders(status, -1);
                exchange.close();
            });
            server.start();

            try {
                AiCoreProperties properties = properties();
                properties.setServiceUrl("http://127.0.0.1:" + server.getAddress().getPort());
                AiCoreClient client = new AiCoreClient(properties, RestClient.builder(), new ObjectMapper());

                AiCoreClient.AiClientFatalException exception = assertThrows(
                        AiCoreClient.AiClientFatalException.class,
                        () -> client.process(validRequest("DOC-42"))
                );

                assertEquals(AuditReason.INVALID_AI_RESPONSE, exception.getAuditReason());
                assertEquals(1, requestCount.get());
            } finally {
                server.stop(0);
            }
        }
    }

    private static ClientFixture fixture(AiCoreProperties properties) {
        RestClient.Builder builder = mock(RestClient.Builder.class);
        RestClient restClient = mock(RestClient.class);
        RestClient.RequestBodyUriSpec requestBodyUriSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec requestBodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);

        doReturn(builder).when(builder).baseUrl(anyString());
        doReturn(builder).when(builder).defaultHeader(anyString(), anyString());
        doReturn(builder).when(builder).requestFactory(any());
        doReturn(restClient).when(builder).build();
        doReturn(requestBodyUriSpec).when(restClient).post();
        doReturn(requestBodySpec).when(requestBodyUriSpec).body(any(ProcessingRequest.class));
        doReturn(responseSpec).when(requestBodySpec).retrieve();
        doReturn(responseSpec).when(responseSpec).onStatus(any(), any());

        return new ClientFixture(new AiCoreClient(properties, builder, new ObjectMapper()),
                builder, restClient, requestBodySpec, responseSpec);
    }

    private static AiCoreProperties properties() {
        AiCoreProperties properties = new AiCoreProperties();
        properties.setServiceUrl("http://example.com");
        properties.setRequestTimeoutSeconds(30);
        properties.setMaxAttempts(2);
        return properties;
    }

    private static HttpServerErrorException serverError(HttpStatus status, String body) {
        return HttpServerErrorException.create(status, status.getReasonPhrase(), HttpHeaders.EMPTY,
                body.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
    }

    private static HttpClientErrorException clientError(HttpStatus status, String body) {
        return HttpClientErrorException.create(status, status.getReasonPhrase(), HttpHeaders.EMPTY,
                body.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
    }

    private static String json(Object value) {
        try {
            return new ObjectMapper().writeValueAsString(value);
        } catch (Exception exception) {
            throw new AssertionError("Could not serialize test fixture", exception);
        }
    }

    private static ProcessingRequest validRequest(String documentId) {
        ProcessingRequest request = new ProcessingRequest();
        request.setDocumentId(documentId);
        request.setInputType(InputType.TEXT);
        request.setDocumentText("Informe radiologico con hallazgos compatibles con tromboembolismo pulmonar.");
        return request;
    }

    private static AiProcessResponse validResponse(String documentId) {
        AiProcessResponse response = new AiProcessResponse();
        response.setDocumentId(documentId);

        Classification classification = new Classification();
        classification.setDocumentType(DocumentType.IMAGING_REPORT);
        classification.setSpecialty("Radiologia");
        classification.setPriorityLevel(PriorityLevel.URGENT);
        response.setClassification(classification);

        Confidence confidence = new Confidence();
        confidence.setClassification(0.99);
        confidence.setExtraction(0.94);
        confidence.setGlobal(0.96);
        response.setConfidence(confidence);

        ExtractedData extractedData = new ExtractedData();
        ExtractedData.Patient patient = new ExtractedData.Patient();
        patient.setName("Carlos Eduardo Mendes");
        patient.setAge(52);
        extractedData.setPatient(patient);
        response.setExtractedData(extractedData);

        Validation validation = new Validation();
        validation.setMissingFields(List.of());
        validation.setInconsistencies(List.of());
        validation.setWarnings(List.of());
        response.setValidation(validation);

        RoutingDecisionAi routingDecision = new RoutingDecisionAi();
        routingDecision.setPrimaryDestination(PrimaryDestination.MEDICAL_EMERGENCY);
        routingDecision.setAuditReasons(List.of());
        routingDecision.setJustification("Hallazgo de alta prioridad clínica.");
        response.setRoutingDecision(routingDecision);

        return response;
    }

    private record ClientFixture(
            AiCoreClient client,
            RestClient.Builder builder,
            RestClient restClient,
            RestClient.RequestBodySpec requestBodySpec,
            RestClient.ResponseSpec responseSpec
    ) {
    }
}
