package com.mediflow.backend.dto;

import com.mediflow.backend.dto.response.ApiErrorResponse;
import com.mediflow.backend.enums.InputType;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DtoSerializationTest {

    private final JsonMapper mapper = JsonMapper.builder()
            .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .build();
    @Test
    void processingRequestSerializesWithSnakeCaseEnglishFields() {
        ProcessingRequest req = new ProcessingRequest();
        req.setDocumentId("DOC-CLIN-2026-8942");
        req.setInputType(InputType.TEXT);
        req.setDocumentText("textodeprueba");
        req.setOriginChannel("Guardia_Emergencias");

        String json = mapper.writeValueAsString(req);
        assertTrue(json.contains("\"document_id\""));
        assertTrue(json.contains("\"input_type\""));
        assertTrue(json.contains("\"document_text\""));

        ProcessingRequest back = mapper.readValue(json, ProcessingRequest.class);
        assertEquals("DOC-CLIN-2026-8942", back.getDocumentId());
        assertTrue(back.isValid());
    }

    @Test
    void processingRequestSerializesFileVariant() {
        ProcessingRequest req = new ProcessingRequest();
        req.setDocumentId("DOC-FILE-0001");
        req.setInputType(InputType.FILE);
        req.setContentBase64("JVBERi0xLjQK...");
        req.setMimeType("application/pdf");
        req.setOriginChannel("Portal_Pacientes");

        String json = mapper.writeValueAsString(req);
        assertTrue(json.contains("\"content_base64\""));

        ProcessingRequest back = mapper.readValue(json, ProcessingRequest.class);
        assertEquals(InputType.FILE, back.getInputType());
        assertTrue(back.isValid());
    }

    @Test
    void apiErrorResponseSerializesWithNestedErrorObject() {
        ApiErrorResponse error = new ApiErrorResponse("INVALID_FILE_TYPE", "Tipo de archivo no soportado");
        String json = mapper.writeValueAsString(error);
        assertTrue(json.contains("\"error\""));
        assertTrue(json.contains("\"code\":\"INVALID_FILE_TYPE\""));
        assertTrue(json.contains("\"message\""));
    }
}
