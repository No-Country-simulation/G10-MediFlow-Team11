package com.mediflow.backend.service;

import org.springframework.stereotype.Component;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class ObjectKeyGenerator {
    public static final String PREFIJO_RECIBIDOS = "recibidos";
    public static final String PREFIJO_URGENTES = "procesados/urgentes";
    public static final String PREFIJO_RUTINA = "procesados/rutina";
    public static final String PREFIJO_AUDITORIA = "auditoria_humana";

    public String encodeId(String documentId) {
        return URLEncoder.encode(documentId, StandardCharsets.UTF_8);
    }

    public String originalKey(String prefijo, String documentId, String extension) {
        return prefijo + "/" + encodeId(documentId) + "/original." + extension;
    }

    public String triageKey(String prefijo, String documentId) {
        return prefijo + "/" + encodeId(documentId) + "/triage.json";
    }

    /** La extensión se deriva del MIME admitido, nunca del nombre subido por el usuario. */
    public String extensionForMime(String mimeType) {
        return switch (mimeType) {
            case "application/pdf" -> "pdf";
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            default -> "json"; // entradas TEXT
        };
    }
}