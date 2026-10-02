package com.mediflow.backend.service;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;

@SpringBootTest
@Disabled("Habilitar manualmente solo con ~/.oci/config (OCI_AUTH_MODE=config_file) o desde la VM con InstancePrincipals")
class ObjectStorageServiceIT {

    @Autowired
    private ObjectStorageService service;

    @Test
    void subeYRecuperaUnObjetoDePrueba() {
        byte[] contenido = "contenido de prueba".getBytes();
        service.putRawBytes("recibidos/test-key/original.json", contenido, "application/json");

        byte[] recuperado = service.getObject("recibidos/test-key/original.json");

        assertArrayEquals(contenido, recuperado);
    }
}