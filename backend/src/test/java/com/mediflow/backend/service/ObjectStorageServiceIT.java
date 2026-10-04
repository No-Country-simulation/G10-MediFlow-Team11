package com.mediflow.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;

@SpringBootTest
@EnabledIfEnvironmentVariable(
        named = "RUN_OCI_IT",
        matches = "true"
)
class ObjectStorageServiceIT {

    @Autowired
    private ObjectStorageService service;

    @Test
    void subeRecuperaYEliminaObjetoDePrueba() {

        String objectKey = "recibidos/oci-it-"
                + UUID.randomUUID()
                + "/original.json";

        byte[] contenido =
                "{\"test\":\"MediFlow OCI integration\"}"
                        .getBytes(StandardCharsets.UTF_8);

        try {
            service.putRawBytes(
                    objectKey,
                    contenido,
                    "application/json"
            );

            byte[] recuperado = service.getObject(objectKey);

            assertArrayEquals(contenido, recuperado);

        } finally {
            service.deleteObject(objectKey);
        }
    }
}