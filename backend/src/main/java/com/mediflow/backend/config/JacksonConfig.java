package com.mediflow.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.json.JsonMapper;

@Configuration
public class JacksonConfig {

    public static JsonMapper createJsonMapper() {
        return JsonMapper.builder()
                .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
                .build();
    }

    @Bean
    public JsonMapper jsonMapper() {
        return createJsonMapper();
    }
}
