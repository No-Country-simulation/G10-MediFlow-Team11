package com.mediflow.backend.service;

import com.mediflow.backend.config.JacksonConfig;
import com.mediflow.backend.dto.response.AiProcessResponse;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;

final class ProcessingTestData {

    static final byte[] PDF = "%PDF-1.4 synthetic".getBytes(StandardCharsets.US_ASCII);
    static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2};
    static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 1, 2};

    private static final JsonMapper JSON = JacksonConfig.createJsonMapper();

    private ProcessingTestData() {
    }

    static AiProcessResponse aiResponse(String id, String priority, String destination, String auditReasonsJson) {
        String body = """
                {
                  "document_id": "%s",
                  "classification": {"document_type": "IMAGING_REPORT", "specialty": "Radiologia", "priority_level": "%s"},
                  "confidence": {"classification": 0.99, "extraction": 0.94, "global": 0.96},
                  "extracted_data": {
                    "patient": {"name": "Paciente Sintetico", "age": 52},
                    "primary_diagnosis": "Diagnostico sintetico",
                    "requested_studies": [{"name": "Estudio sintetico"}]
                  },
                  "validation": {"missing_fields": [], "inconsistencies": [], "warnings": []},
                  "routing_decision": {
                    "primary_destination": "%s",
                    "audit_reasons": %s,
                    "justification": "Justificacion sintetica."
                  }
                }
                """.formatted(id, priority, destination, auditReasonsJson);
        return JSON.readValue(body, AiProcessResponse.class);
    }
}
