package com.mediflow.backend.controller;

import com.mediflow.backend.config.JacksonConfig;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.service.FinalizationOutcome;
import com.mediflow.backend.service.HumanReviewService;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class DocumentReviewControllerTest {
    private final HumanReviewService service = mock(HumanReviewService.class);
    private final MockMvc mvc = standaloneSetup(new DocumentReviewController(service))
            .setMessageConverters(new JacksonJsonHttpMessageConverter(JacksonConfig.createJsonMapper()))
            .build();

    @Test
    void patchBindsDecisionAndReturnsConfirmedStatus() throws Exception {
        when(service.review(eq("DOC-71"), any())).thenReturn(FinalizationOutcome.confirmed(
                "DOC-71", DocumentStatus.REJECTED, 2, Instant.parse("2026-10-15T18:00:00Z")));

        mvc.perform(patch("/api/v1/documents/DOC-71/review")
                        .contentType("application/json")
                        .content("{\"decision\":\"REJECT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.document_id").value("DOC-71"))
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.message").value("Revisión humana registrada correctamente"));
        verify(service).review(eq("DOC-71"), any());
    }

    @Test
    void mapsReviewValidationFailureToArchitectureError() throws Exception {
        when(service.review(eq("DOC-71"), any())).thenThrow(new HumanReviewService.ReviewValidationException());

        mvc.perform(patch("/api/v1/documents/DOC-71/review")
                        .contentType("application/json")
                        .content("{\"decision\":\"APPROVE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("REVIEW_VALIDATION_FAILED"));
    }

    @Test
    void mapsInvalidStateToArchitectureError() throws Exception {
        when(service.review(eq("DOC-71"), any())).thenThrow(new HumanReviewService.InvalidReviewStateException());

        mvc.perform(patch("/api/v1/documents/DOC-71/review")
                        .contentType("application/json")
                        .content("{\"decision\":\"REJECT\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("INVALID_REVIEW_STATE"));
    }

    @Test
    void mapsMalformedJsonToInvalidRequest() throws Exception {
        mvc.perform(patch("/api/v1/documents/DOC-71/review")
                        .contentType("application/json")
                        .content("{not-json}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
    }
}
