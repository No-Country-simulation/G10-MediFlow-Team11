package com.mediflow.backend.dto;

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
}
