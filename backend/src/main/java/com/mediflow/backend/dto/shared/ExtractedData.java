package com.mediflow.backend.dto.shared;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Getter;
import lombok.Setter;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Estructura común de extracted_data (arquitectura §5).
 * Las claves conocidas son opcionales; se permiten campos adicionales por tipo de documento.
 */
@Getter
@Setter
public class ExtractedData {

    private Patient patient;
    private RequestingDoctor requestingDoctor;
    private String primaryDiagnosis;
    private String suggestedIcd10;
    private List<Medication> medications;

    @JsonIgnore
    private Map<String, Object> additionalProperties = new LinkedHashMap<>();

    @JsonAnySetter
    public void setAdditionalProperty(String name, Object value) {
        additionalProperties.put(name, value);
    }

    @JsonAnyGetter
    public Map<String, Object> getAdditionalProperties() {
        return additionalProperties;
    }

    @Getter
    @Setter
    public static class Patient {
        private String name;
        private Integer age;
    }

    @Getter
    @Setter
    public static class RequestingDoctor {
        private String name;
        private String licenseNumber;
    }

    @Getter
    @Setter
    public static class Medication {
        private String name;
        private String dosage;
    }
}
