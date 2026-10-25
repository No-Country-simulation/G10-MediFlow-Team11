package com.mediflow.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Getter;

import java.util.LinkedHashMap;
import java.util.Map;

/** Flexible input for PATCH: omitted fields are distinct from explicit nulls. */
@Getter
public class HumanReviewRequest {
    @JsonIgnore
    private final Map<String, Object> fields = new LinkedHashMap<>();

    @JsonAnySetter
    public void add(String name, Object value) {
        fields.put(name, value);
    }
}
