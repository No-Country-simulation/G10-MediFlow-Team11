package com.mediflow.backend.service;

import com.mediflow.backend.config.JacksonConfig;
import com.mediflow.backend.dto.ProcessingRequest;
import com.mediflow.backend.dto.response.AiProcessResponse;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.DocumentType;
import com.mediflow.backend.enums.InputType;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.PriorityLevel;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Import;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertAll;

class AiCoreClientContextTest {

    @Test
    void bootAutoConfigurationCreatesClientWithItsRealDependencies() {
        new ApplicationContextRunner()
                .withUserConfiguration(ClientConfiguration.class)
                .run(context -> {
                    assertThat(context).hasNotFailed()
                            .hasSingleBean(RestClient.Builder.class)
                            .doesNotHaveBean("jackson2ObjectMapper")
                            .hasSingleBean(JsonMapper.class)
                            .hasSingleBean(AiCoreClient.class);
                    assertThat(context.isPrototype("restClientBuilder")).isTrue();
                    assertThat(context.getBeanFactory().getBeanDefinition("restClientBuilder")
                            .getFactoryBeanName())
                            .isEqualTo("org.springframework.boot.restclient.autoconfigure.RestClientAutoConfiguration");
                });
    }

    @ParameterizedTest
    @EnumSource(InputType.class)
    void autoConfiguredClientSendsProcessingRequestInSnakeCaseOverHttp(InputType inputType) throws IOException {
        withHttpExchange(inputType, (request, response) -> {
            var json = JacksonConfig.createJsonMapper().readTree(request.body());

            // Exact keys also reject camelCase names and the Java isValid() helper.
            assertThat(json.propertyNames()).containsExactlyInAnyOrder("document_id", "input_type", "mime_type",
                    "file_name", "content_base64", "document_text", "origin_channel");
            assertThat(json.get("document_id").asString()).isEqualTo("HTTP-CONTRACT-59");
            assertThat(json.get("input_type").asString()).isEqualTo(inputType.name());
            assertThat(json.get("origin_channel").asString()).isEqualTo("Prueba_local");
            if (inputType == InputType.TEXT) {
                assertThat(json.get("mime_type").asString()).isEqualTo("text/plain");
                assertThat(json.get("document_text").asString()).isEqualTo("Documento clínico sintético.");
                assertThat(json.get("file_name").isNull()).isTrue();
                assertThat(json.get("content_base64").isNull()).isTrue();
            } else {
                assertThat(json.get("mime_type").asString()).isEqualTo("application/pdf");
                assertThat(json.get("file_name").asString()).isEqualTo("synthetic.pdf");
                assertThat(Base64.getDecoder().decode(json.get("content_base64").asString()))
                        .isEqualTo(SYNTHETIC_FILE.getBytes(StandardCharsets.UTF_8));
                assertThat(json.get("document_text").isNull()).isTrue();
            }
        });
    }

    @Test
    void autoConfiguredClientDeserializesValidAiCoreResponseOverHttp() throws IOException {
        withHttpExchange(InputType.TEXT, (request, response) -> {
            assertThat(response.getDocumentId()).isEqualTo("HTTP-CONTRACT-59");
            assertThat(response.getClassification().getDocumentType()).isEqualTo(DocumentType.IMAGING_REPORT);
            assertThat(response.getClassification().getSpecialty()).isEqualTo("Radiología");
            assertThat(response.getClassification().getPriorityLevel()).isEqualTo(PriorityLevel.ROUTINE);
            assertThat(response.getConfidence().getClassification()).isEqualTo(0.99);
            assertThat(response.getConfidence().getExtraction()).isEqualTo(0.94);
            assertThat(response.getConfidence().getGlobal()).isEqualTo(0.96);
            assertThat(response.getExtractedData().getPatient().getName()).isEqualTo("Paciente sintético");
            assertThat(response.getExtractedData().getPatient().getAge()).isEqualTo(52);
            assertThat(response.getExtractedData().getPrimaryDiagnosis()).isEqualTo("Diagnóstico sintético");
            assertThat(response.getExtractedData().getSuggestedIcd10()).isEqualTo("Z00.0");
            assertThat(response.getExtractedData().getRequestingDoctor()).isNotNull();
            assertThat(response.getExtractedData().getRequestingDoctor().getName()).isEqualTo("Profesional sintético");
            assertThat(response.getExtractedData().getRequestingDoctor().getLicenseNumber()).isEqualTo("TEST-59");
            assertThat(response.getExtractedData().getMedications()).hasSize(1);
            assertThat(response.getExtractedData().getMedications().getFirst().getName()).isEqualTo("Medicamento sintético");
            assertThat(response.getExtractedData().getMedications().getFirst().getDosage()).isEqualTo("Dosis sintética");
            assertThat(response.getExtractedData().getAdditionalProperties())
                    .containsEntry("requested_studies", List.of(Map.of("name", "Estudio sintético")))
                    .containsEntry("clinical_note", "Observación sintética");
            assertThat(response.getValidation().getMissingFields()).isEmpty();
            assertThat(response.getValidation().getInconsistencies()).isEmpty();
            assertThat(response.getValidation().getWarnings()).isEmpty();
            assertThat(response.getRoutingDecision().getPrimaryDestination()).isEqualTo(PrimaryDestination.MEDICAL_RECORD);
            assertThat(response.getRoutingDecision().getAuditReasons()).isEmpty();
            assertThat(response.getRoutingDecision().getJustification()).isEqualTo("Resultado sintético de rutina.");
        });
    }

    @Test
    void additionalNestedFieldsSurviveHttpDeserializationAndReserialization() throws IOException {
        withHttpExchange(InputType.TEXT, RESPONSE_WITH_NESTED_EXTRA_FIELDS, (request, response) -> {
            var mapper = JacksonConfig.createJsonMapper();
            var expected = mapper.readTree(RESPONSE_WITH_NESTED_EXTRA_FIELDS).get("extracted_data");
            var actual = mapper.readTree(mapper.writeValueAsString(response)).get("extracted_data");

            assertAll(
                    () -> assertThat(actual.get("patient"))
                            .as("El parseo funcionó, pero Patient perdió o alteró campos")
                            .isEqualTo(expected.get("patient")),
                    () -> assertThat(actual.get("requesting_doctor"))
                            .as("El parseo funcionó, pero RequestingDoctor perdió o alteró campos")
                            .isEqualTo(expected.get("requesting_doctor")),
                    () -> assertThat(actual.get("medications").get(0))
                            .as("El parseo funcionó, pero Medication perdió o alteró campos")
                            .isEqualTo(expected.get("medications").get(0))
            );
        });
    }

    @Test
    void missingCriticalFieldsSurvivesHttpDeserializationAndReserialization() throws IOException {
        withHttpExchange(InputType.TEXT, RESPONSE_WITH_MISSING_CRITICAL_FIELDS, (request, response) -> {
            assertThat(response.getRoutingDecision().getAuditReasons())
                    .containsExactly(AuditReason.MISSING_CRITICAL_FIELDS);
            assertThat(response.getValidation().getMissingFields()).containsExactly("patient.name");
            assertThat(response.getExtractedData().getPatient().getName()).isNull();

            var mapper = JacksonConfig.createJsonMapper();
            var expected = mapper.readTree(RESPONSE_WITH_MISSING_CRITICAL_FIELDS);
            var actual = mapper.readTree(mapper.writeValueAsString(response));
            assertThat(actual.get("routing_decision").get("audit_reasons"))
                    .isEqualTo(expected.get("routing_decision").get("audit_reasons"));
            assertThat(actual.get("validation").get("missing_fields"))
                    .isEqualTo(expected.get("validation").get("missing_fields"));
        });
    }

    private void withHttpExchange(InputType inputType, HttpAssertions assertions) throws IOException {
        withHttpExchange(inputType, VALID_AI_RESPONSE, assertions);
    }

    private void withHttpExchange(InputType inputType, String responseBody, HttpAssertions assertions) throws IOException {
        var captured = new AtomicReference<CapturedRequest>();
        var requestCount = new AtomicInteger();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            try (exchange) {
                requestCount.incrementAndGet();
                captured.set(new CapturedRequest(exchange.getRequestMethod(), exchange.getRequestURI().getPath(),
                        exchange.getRequestHeaders().getFirst("Content-Type"),
                        exchange.getRequestHeaders().getFirst("Upgrade"),
                        new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
                byte[] body = responseBody.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            }
        });
        server.start();
        try {
            new ApplicationContextRunner()
                    .withUserConfiguration(ClientConfiguration.class)
                    .withPropertyValues("mediflow.ai.service-url=http://127.0.0.1:" + server.getAddress().getPort())
                    .run(context -> {
                        assertThat(context).hasNotFailed().hasSingleBean(RestClient.Builder.class);
                        var request = new ProcessingRequest();
                        request.setDocumentId("HTTP-CONTRACT-59");
                        request.setInputType(inputType);
                        request.setOriginChannel("Prueba_local");
                        assertThat(request.isValid()).isFalse();
                        if (inputType == InputType.TEXT) {
                            request.setMimeType("text/plain");
                            request.setDocumentText("Documento clínico sintético.");
                        } else {
                            request.setMimeType("application/pdf");
                            request.setFileName("synthetic.pdf");
                            request.setContentBase64(Base64.getEncoder().encodeToString(
                                    SYNTHETIC_FILE.getBytes(StandardCharsets.UTF_8)));
                        }
                        assertThat(request.isValid()).isTrue();

                        AiProcessResponse response = context.getBean(AiCoreClient.class).process(request);

                        assertThat(requestCount.get()).isEqualTo(1);
                        assertThat(captured.get()).isNotNull();
                        assertThat(captured.get().method()).isEqualTo("POST");
                        assertThat(captured.get().path()).isEqualTo("/api/v1/ai/process");
                        assertThat(captured.get().contentType()).startsWith("application/json");
                        assertThat(captured.get().upgrade()).isNull();
                        assertions.accept(captured.get(), response);
                    });
        } finally {
            server.stop(0);
        }
    }

    @FunctionalInterface
    private interface HttpAssertions {
        void accept(CapturedRequest request, AiProcessResponse response) throws IOException;
    }

    private record CapturedRequest(String method, String path, String contentType, String upgrade, String body) {
    }

    private static final String SYNTHETIC_FILE = "%PDF-1.4\n%%EOF";

    private static final String VALID_AI_RESPONSE = """
            {
              "document_id": "HTTP-CONTRACT-59",
              "classification": {
                "document_type": "IMAGING_REPORT", "specialty": "Radiología", "priority_level": "ROUTINE"
              },
              "confidence": {"classification": 0.99, "extraction": 0.94, "global": 0.96},
              "extracted_data": {
                "patient": {"name": "Paciente sintético", "age": 52},
                "requesting_doctor": {"name": "Profesional sintético", "license_number": "TEST-59"},
                "primary_diagnosis": "Diagnóstico sintético",
                "suggested_icd10": "Z00.0",
                "medications": [{"name": "Medicamento sintético", "dosage": "Dosis sintética"}],
                "requested_studies": [{"name": "Estudio sintético"}],
                "clinical_note": "Observación sintética"
              },
              "validation": {"missing_fields": [], "inconsistencies": [], "warnings": []},
              "routing_decision": {
                "primary_destination": "MEDICAL_RECORD", "audit_reasons": [],
                "justification": "Resultado sintético de rutina."
              }
            }
            """;

    private static final String RESPONSE_WITH_NESTED_EXTRA_FIELDS = """
            {
              "document_id": "HTTP-CONTRACT-59",
              "classification": {"document_type": "IMAGING_REPORT", "specialty": "Radiología", "priority_level": "ROUTINE"},
              "confidence": {"classification": 0.99, "extraction": 0.94, "global": 0.96},
              "extracted_data": {
                "patient": {
                  "name": "Paciente sintético", "age": 52,
                  "synthetic_metadata": {"verified": true, "codes": ["P-59"]}, "synthetic_optional": null
                },
                "requesting_doctor": {
                  "name": "Profesional sintético", "license_number": "TEST-59",
                  "synthetic_roles": ["reviewer", "requester"], "synthetic_year": 2026
                },
                "medications": [{
                  "name": "Medicamento sintético", "dosage": "Dosis sintética",
                  "synthetic_schedule": {"hours": [8, 20]}, "synthetic_active": false
                }]
              },
              "validation": {"missing_fields": [], "inconsistencies": [], "warnings": []},
              "routing_decision": {
                "primary_destination": "MEDICAL_RECORD", "audit_reasons": [], "justification": "Resultado sintético de rutina."
              }
            }
            """;

    private static final String RESPONSE_WITH_MISSING_CRITICAL_FIELDS = """
            {
              "document_id": "HTTP-CONTRACT-59",
              "classification": {"document_type": "IMAGING_REPORT", "specialty": "Radiología", "priority_level": "ROUTINE"},
              "confidence": {"classification": 0.99, "extraction": 0.94, "global": 0.96},
              "extracted_data": {"patient": {"name": null, "age": 52}},
              "validation": {"missing_fields": ["patient.name"], "inconsistencies": [], "warnings": []},
              "routing_decision": {
                "primary_destination": "HUMAN_REVIEW", "audit_reasons": ["MISSING_CRITICAL_FIELDS"],
                "justification": "Falta el nombre del paciente sintético."
              }
            }
            """;

    @TestConfiguration(proxyBeanMethods = false)
    @EnableAutoConfiguration(excludeName = "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration")
    @EnableConfigurationProperties(AiCoreProperties.class)
    @Import({AiCoreClient.class, JacksonConfig.class})
    static class ClientConfiguration {
    }
}
