package com.mediflow.backend.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ObjectKeyGeneratorTest {

    private final ObjectKeyGenerator generator =
            new ObjectKeyGenerator();

    @Test
    void conservaCaracteresPermitidos() {
        assertEquals(
                "DOC-CLIN_2026-8942",
                generator.encodeId("DOC-CLIN_2026-8942")
        );
    }

    @Test
    void codificaEspaciosComoPorcentaje20() {
        assertEquals(
                "DOC%20123",
                generator.encodeId("DOC 123")
        );
    }

    @Test
    void codificaSeparadoresDeRuta() {
        assertEquals(
                "DOC%2F123",
                generator.encodeId("DOC/123")
        );
    }

    @Test
    void codificaCaracteresUnicodeEnUtf8() {
        assertEquals(
                "M%C3%A9xico",
                generator.encodeId("México")
        );
    }

    @Test
    void codificaPuntoYAsterisco() {
        assertEquals(
                "DOC%2E%2A",
                generator.encodeId("DOC.*")
        );
    }

    @Test
    void generaClaveOriginalConConvencionArquitectonica() {
        assertEquals(
                "recibidos/DOC%20123/original.pdf",
                generator.originalKey(
                        ObjectKeyGenerator.PREFIJO_RECIBIDOS,
                        "DOC 123",
                        "pdf"
                )
        );
    }

    @Test
    void generaClaveTriageConConvencionArquitectonica() {
        assertEquals(
                "procesados/urgentes/DOC%20123/triage.json",
                generator.triageKey(
                        ObjectKeyGenerator.PREFIJO_URGENTES,
                        "DOC 123"
                )
        );
    }

    @Test
    void rechazaMimeNoSoportado() {
        assertThrows(
                IllegalArgumentException.class,
                () -> generator.extensionForMime("text/html")
        );
    }

    @Test
    void rechazaIdentificadorVacio() {
        assertThrows(
                IllegalArgumentException.class,
                () -> generator.encodeId(" ")
        );
    }
}