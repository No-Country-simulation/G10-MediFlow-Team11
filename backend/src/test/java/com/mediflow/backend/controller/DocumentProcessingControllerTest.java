package com.mediflow.backend.controller;

import com.mediflow.backend.config.JacksonConfig;
import com.mediflow.backend.dto.request.ProcessFileRequest;
import com.mediflow.backend.dto.request.ProcessTextRequest;
import com.mediflow.backend.dto.response.DocumentoCanonicoResponse;
import com.mediflow.backend.dto.response.RoutingDecisionResponse;
import com.mediflow.backend.dto.response.StorageResponse;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.BackendErrorCode;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.StorageState;
import com.mediflow.backend.service.DocumentProcessingException;
import com.mediflow.backend.service.DocumentProcessingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class DocumentProcessingControllerTest {

    private static final String SECRET = "mediflow-bucket/recibidos/DOC-1/original.pdf namespace-secreto";

    private DocumentProcessingService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        service = mock(DocumentProcessingService.class);
        mvc = standaloneSetup(new DocumentProcessingController(service))
                .setControllerAdvice(new ProcessingExceptionAdvice())
                .setMessageConverters(new JacksonJsonHttpMessageConverter(JacksonConfig.createJsonMapper()))
                .build();
    }

    private static DocumentoCanonicoResponse response(String id) {
        DocumentoCanonicoResponse response = new DocumentoCanonicoResponse();
        response.setDocumentId(id);
        response.setStatus(DocumentStatus.NEEDS_AUDIT);
        RoutingDecisionResponse routing = new RoutingDecisionResponse();
        routing.setPrimaryDestination(PrimaryDestination.HUMAN_REVIEW);
        routing.setRequiresHumanReview(true);
        routing.setAuditReasons(List.of(AuditReason.AI_TIMEOUT));
        routing.setJustification("El servicio de IA no respondió dentro del tiempo configurado.");
        response.setRoutingDecision(routing);
        StorageResponse storage = new StorageResponse();
        storage.setState(StorageState.SUCCESS);
        response.setStorage(storage);
        return response;
    }

    private MockMultipartFile pdfPart() {
        return new MockMultipartFile("file", "informe.pdf", "application/pdf", "%PDF-1.4 x".getBytes(StandardCharsets.US_ASCII));
    }

    @Test
    void processFileBindsSnakeCasePartsAndReturnsCanonicalResponse() throws Exception {
        when(service.processFile(any())).thenReturn(response("DOC-1"));

        mvc.perform(multipart("/api/v1/documents/process-file").file(pdfPart())
                        .param("document_id", "DOC-1").param("origin_channel", "Guardia_Emergencias"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.document_id").value("DOC-1"))
                .andExpect(jsonPath("$.status").value("NEEDS_AUDIT"))
                .andExpect(jsonPath("$.classification").value((Object) null))
                .andExpect(jsonPath("$.confidence").value((Object) null))
                .andExpect(jsonPath("$.routing_decision.requires_human_review").value(true))
                .andExpect(jsonPath("$.routing_decision.audit_reasons[0]").value("AI_TIMEOUT"))
                .andExpect(jsonPath("$.storage.provider").value("OCI_OBJECT_STORAGE"))
                .andExpect(jsonPath("$.storage.state").value("SUCCESS"));

        ArgumentCaptor<ProcessFileRequest> captor = ArgumentCaptor.forClass(ProcessFileRequest.class);
        verify(service).processFile(captor.capture());
        assertEquals("DOC-1", captor.getValue().getDocumentId());
        assertEquals("Guardia_Emergencias", captor.getValue().getOriginChannel());
        assertEquals("informe.pdf", captor.getValue().getFile().getOriginalFilename());
        assertArrayEquals("%PDF-1.4 x".getBytes(StandardCharsets.US_ASCII), captor.getValue().getFile().getBytes());
    }

    @Test
    void processFileWithoutOptionalDocumentIdPassesNull() throws Exception {
        when(service.processFile(any())).thenReturn(response("DOC-GEN"));

        mvc.perform(multipart("/api/v1/documents/process-file").file(pdfPart()).param("origin_channel", "Guardia"))
                .andExpect(status().isOk());

        ArgumentCaptor<ProcessFileRequest> captor = ArgumentCaptor.forClass(ProcessFileRequest.class);
        verify(service).processFile(captor.capture());
        assertNull(captor.getValue().getDocumentId());
    }

    @Test
    void camelCasePartNamesAreNotBound() throws Exception {
        when(service.processFile(any())).thenReturn(response("DOC-1"));

        mvc.perform(multipart("/api/v1/documents/process-file").file(pdfPart())
                        .param("documentId", "IGNORED").param("originChannel", "IGNORED"))
                .andExpect(status().isOk());

        ArgumentCaptor<ProcessFileRequest> captor = ArgumentCaptor.forClass(ProcessFileRequest.class);
        verify(service).processFile(captor.capture());
        assertNull(captor.getValue().getDocumentId());
        assertNull(captor.getValue().getOriginChannel());
    }

    @Test
    void processFileMissingFileAndChannelReachesServiceValidationAsNulls() throws Exception {
        when(service.processFile(any())).thenThrow(
                new DocumentProcessingException(BackendErrorCode.INVALID_REQUEST, "file es obligatorio."));

        mvc.perform(multipart("/api/v1/documents/process-file"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.error.message").value("file es obligatorio."));

        ArgumentCaptor<ProcessFileRequest> captor = ArgumentCaptor.forClass(ProcessFileRequest.class);
        verify(service).processFile(captor.capture());
        assertNull(captor.getValue().getFile());
        assertNull(captor.getValue().getOriginChannel());
    }

    @Test
    void processFileRejectsJsonContentType() throws Exception {
        mvc.perform(post("/api/v1/documents/process-file").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
        verify(service, never()).processFile(any());
    }

    @Test
    void processTextBindsSnakeCaseJson() throws Exception {
        when(service.processText(any())).thenReturn(response("DOC-T"));

        mvc.perform(post("/api/v1/documents/process-text").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"document_id":"DOC-T","document_text":"Texto sintetico","origin_channel":"Guardia"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.document_id").value("DOC-T"));

        ArgumentCaptor<ProcessTextRequest> captor = ArgumentCaptor.forClass(ProcessTextRequest.class);
        verify(service).processText(captor.capture());
        assertEquals("DOC-T", captor.getValue().getDocumentId());
        assertEquals("Texto sintetico", captor.getValue().getDocumentText());
        assertEquals("Guardia", captor.getValue().getOriginChannel());
    }

    @Test
    void processTextAcceptsMissingDocumentId() throws Exception {
        when(service.processText(any())).thenReturn(response("DOC-GEN"));

        mvc.perform(post("/api/v1/documents/process-text").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"document_text\":\"Texto\",\"origin_channel\":\"Guardia\"}"))
                .andExpect(status().isOk());
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "{\"document_text\":\"Texto\"}|origin_channel es obligatorio",
            "{\"origin_channel\":\"Guardia\"}|document_text es obligatorio",
            "{\"document_text\":\"  \",\"origin_channel\":\"Guardia\"}|document_text es obligatorio",
            "{\"document_text\":\"Texto\",\"origin_channel\":\"\"}|origin_channel es obligatorio"
    })
    void processTextBeanValidationFailuresReturnInvalidRequest(String body, String message) throws Exception {
        mvc.perform(post("/api/v1/documents/process-text").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.error.message").value(message));
        verify(service, never()).processText(any());
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "{\"document_text\":\"Texto\",|malformado",
            "esto no es json|texto plano",
            "[1,2,3]|arreglo en vez de objeto",
            "{\"document_text\":123456,\"origin_channel\":{\"x\":1}}|tipos incorrectos",
            "|cuerpo vacío"
    })
    void processTextMalformedJsonReturnsInvalidRequest(String body, String description) throws Exception {
        mvc.perform(post("/api/v1/documents/process-text").contentType(MediaType.APPLICATION_JSON)
                        .content(body == null ? "" : body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.error.message").isString());
        verify(service, never()).processText(any());
    }

    @Test
    void processTextRejectsNonJsonContentType() throws Exception {
        mvc.perform(post("/api/v1/documents/process-text").contentType(MediaType.TEXT_PLAIN).content("texto"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
        verify(service, never()).processText(any());
    }

    @Test
    void processTextDoesNotBindCamelCaseNames() throws Exception {
        mvc.perform(post("/api/v1/documents/process-text").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"documentText\":\"Texto\",\"originChannel\":\"Guardia\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
        verify(service, never()).processText(any());
    }

    @Test
    void processTextIgnoresUnknownJsonFields() throws Exception {
        when(service.processText(any())).thenReturn(response("DOC-T"));

        mvc.perform(post("/api/v1/documents/process-text").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"document_text\":\"Texto\",\"origin_channel\":\"Guardia\",\"extra\":1}"))
                .andExpect(status().isOk());
    }

    @ParameterizedTest
    @CsvSource({
            "INVALID_REQUEST,400",
            "INVALID_FILE_TYPE,400",
            "FILE_TOO_LARGE,413",
            "DOCUMENT_ID_ALREADY_EXISTS,409",
            "STORAGE_ERROR,500",
            "PERSISTENCE_ERROR,500"
    })
    void serviceErrorsMapToContractStatusAndEnvelope(BackendErrorCode code, int httpStatus) throws Exception {
        when(service.processText(any())).thenThrow(new DocumentProcessingException(code, "mensaje seguro",
                new RuntimeException(SECRET)));

        String body = mvc.perform(post("/api/v1/documents/process-text").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"document_text\":\"Texto\",\"origin_channel\":\"Guardia\"}"))
                .andExpect(status().is(httpStatus))
                .andExpect(jsonPath("$.error.code").value(code.name()))
                .andExpect(jsonPath("$.error.message").value("mensaje seguro"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertFalse(body.contains("bucket"));
        assertFalse(body.contains("namespace"));
        assertFalse(body.contains("object_key"));
    }

    @Test
    void adviceMapsFrameworkMultipartLimitToFileTooLarge() throws Exception {
        MockMvc advised = standaloneSetup(new RejectingController())
                .setControllerAdvice(new ProcessingExceptionAdvice())
                .setMessageConverters(new JacksonJsonHttpMessageConverter(JacksonConfig.createJsonMapper()))
                .build();

        advised.perform(post("/limit"))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.error.code").value("FILE_TOO_LARGE"));
        advised.perform(post("/multipart"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
    }

    @RestController
    static class RejectingController {
        @PostMapping("/limit")
        String limit() {
            throw new MaxUploadSizeExceededException(10L * 1024 * 1024);
        }

        @PostMapping("/multipart")
        String multipart() {
            throw new MultipartException("no es una solicitud multipart");
        }
    }

    @Test
    void unclassifiedFailureReturnsSafeInternalErrorWithInternalErrorCode() throws Exception {
        when(service.processText(any())).thenThrow(new IllegalStateException(SECRET));

        String body = mvc.perform(post("/api/v1/documents/process-text").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"document_text\":\"Texto\",\"origin_channel\":\"Guardia\"}"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error.message").value("Error interno del servidor."))
                .andExpect(jsonPath("$.error.code").value("INTERNAL_ERROR"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertFalse(body.contains("bucket"));
        assertFalse(body.contains("namespace"));
        assertFalse(body.contains("IllegalState"));
    }
}
