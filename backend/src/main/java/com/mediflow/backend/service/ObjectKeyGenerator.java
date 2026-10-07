package com.mediflow.backend.service;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Objects;

@Component
public class ObjectKeyGenerator {

    public static final String PREFIJO_RECIBIDOS = "recibidos";
    public static final String PREFIJO_URGENTES = "procesados/urgentes";
    public static final String PREFIJO_RUTINA = "procesados/rutina";
    public static final String PREFIJO_AUDITORIA = "auditoria_humana";

    public String encodeId(String documentId) {
        Objects.requireNonNull(documentId, "documentId no puede ser null");

        if (documentId.isBlank()) {
            throw new IllegalArgumentException(
                    "documentId no puede estar vacío"
            );
        }

        StringBuilder encoded = new StringBuilder();

        for (byte rawByte : documentId.getBytes(StandardCharsets.UTF_8)) {
            int value = rawByte & 0xFF;

            boolean allowed =
                    (value >= 'A' && value <= 'Z')
                            || (value >= 'a' && value <= 'z')
                            || (value >= '0' && value <= '9')
                            || value == '-'
                            || value == '_';

            if (allowed) {
                encoded.append((char) value);
            } else {
                encoded.append('%');

                String hex = Integer.toHexString(value)
                        .toUpperCase(java.util.Locale.ROOT);

                if (hex.length() == 1) {
                    encoded.append('0');
                }

                encoded.append(hex);
            }
        }

        return encoded.toString();
    }

    public String originalKey(
            String prefix,
            String documentId,
            String extension
    ) {
        validatePrefix(prefix);

        if (extension == null || extension.isBlank()) {
            throw new IllegalArgumentException(
                    "La extensión es obligatoria"
            );
        }

        return prefix + "/" + encodeId(documentId)
                + "/original." + extension;
    }

    public String triageKey(String prefix, String documentId) {
        validatePrefix(prefix);

        return prefix + "/" + encodeId(documentId)
                + "/triage.json";
    }

    public String extensionForMime(String mimeType) {
        if (mimeType == null) {
            throw new IllegalArgumentException(
                    "El MIME type es obligatorio"
            );
        }

        return switch (mimeType) {
            case "application/pdf" -> "pdf";
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "application/json" -> "json";

            default -> throw new IllegalArgumentException(
                    "MIME type no soportado: " + mimeType
            );
        };
    }

    private void validatePrefix(String prefix) {
        if (!PREFIJO_RECIBIDOS.equals(prefix)
                && !PREFIJO_URGENTES.equals(prefix)
                && !PREFIJO_RUTINA.equals(prefix)
                && !PREFIJO_AUDITORIA.equals(prefix)) {

            throw new IllegalArgumentException(
                    "Prefijo OCI no permitido: " + prefix
            );
        }
    }
}