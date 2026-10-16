package com.mediflow.backend.service;

import com.mediflow.backend.dto.request.ProcessFileRequest;
import com.mediflow.backend.dto.request.ProcessTextRequest;
import com.mediflow.backend.enums.BackendErrorCode;
import com.mediflow.backend.enums.InputType;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
public class IncomingDocumentFactory {

    public static final long MAX_FILE_BYTES = 10L * 1024 * 1024;
    public static final int MAX_TEXT_CHARS = 100_000;
    public static final int MAX_ORIGIN_CHANNEL_LENGTH = 255;
    public static final int MAX_FILE_NAME_LENGTH = 255;

    private static final Pattern DOCUMENT_ID = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$");
    private static final String PDF = "application/pdf";
    private static final String JPEG = "image/jpeg";
    private static final String PNG = "image/png";
    private static final String JSON = "application/json";

    private final JsonMapper jsonMapper;

    public IncomingDocumentFactory(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    public IncomingDocument fromFile(ProcessFileRequest request) {
        if (request == null) {
            throw invalid("La solicitud es obligatoria.");
        }
        MultipartFile file = request.getFile();
        if (file == null) {
            throw invalid("file es obligatorio.");
        }
        String originChannel = validateOriginChannel(request.getOriginChannel());
        String documentId = resolveDocumentId(request.getDocumentId());
        if (file.isEmpty()) {
            throw invalid("El archivo está vacío.");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw tooLarge("El archivo supera el tamaño máximo permitido.");
        }
        String mimeType = normalizeMime(file.getContentType());
        if (!PDF.equals(mimeType) && !JPEG.equals(mimeType) && !PNG.equals(mimeType)) {
            throw new DocumentProcessingException(BackendErrorCode.INVALID_FILE_TYPE,
                    "El tipo de archivo enviado no está soportado.");
        }
        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException exception) {
            throw invalid("No se pudo leer el archivo enviado.");
        }
        if (content.length > MAX_FILE_BYTES) {
            throw tooLarge("El archivo supera el tamaño máximo permitido.");
        }
        if (!matchesSignature(mimeType, content)) {
            throw new DocumentProcessingException(BackendErrorCode.INVALID_FILE_TYPE,
                    "El contenido del archivo no corresponde al tipo declarado.");
        }
        return new IncomingDocument(documentId, InputType.FILE, mimeType,
                sanitizeFileName(file.getOriginalFilename()), content, null, originChannel);
    }

    public IncomingDocument fromText(ProcessTextRequest request) {
        if (request == null) {
            throw invalid("La solicitud es obligatoria.");
        }
        String text = request.getDocumentText();
        if (text == null || text.isBlank()) {
            throw invalid("document_text es obligatorio.");
        }
        String originChannel = validateOriginChannel(request.getOriginChannel());
        String documentId = resolveDocumentId(request.getDocumentId());
        if (text.length() > MAX_TEXT_CHARS) {
            throw tooLarge("El texto supera el tamaño máximo permitido.");
        }
        Map<String, Object> original = new LinkedHashMap<>();
        original.put("document_id", documentId);
        original.put("document_text", text);
        original.put("origin_channel", originChannel);
        byte[] content;
        try {
            content = jsonMapper.writeValueAsBytes(original);
        } catch (JacksonException exception) {
            throw invalid("No se pudo serializar el texto enviado.");
        }
        return new IncomingDocument(documentId, InputType.TEXT, JSON, null, content, text, originChannel);
    }

    private String resolveDocumentId(String provided) {
        if (provided == null || provided.isEmpty()) {
            return "DOC-" + UUID.randomUUID();
        }
        if (!DOCUMENT_ID.matcher(provided).matches()) {
            throw invalid("document_id no es válido.");
        }
        return provided;
    }

    private String validateOriginChannel(String originChannel) {
        if (originChannel == null || originChannel.isBlank()) {
            throw invalid("origin_channel es obligatorio.");
        }
        if (originChannel.length() > MAX_ORIGIN_CHANNEL_LENGTH) {
            throw invalid("origin_channel es demasiado largo.");
        }
        return originChannel;
    }

    private String normalizeMime(String contentType) {
        if (contentType == null) {
            return null;
        }
        int separator = contentType.indexOf(';');
        String base = separator < 0 ? contentType : contentType.substring(0, separator);
        return base.trim().toLowerCase(Locale.ROOT);
    }

    private boolean matchesSignature(String mimeType, byte[] content) {
        return switch (mimeType) {
            case PDF -> startsWith(content, '%', 'P', 'D', 'F', '-');
            case JPEG -> startsWith(content, 0xFF, 0xD8, 0xFF);
            case PNG -> startsWith(content, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A);
            default -> false;
        };
    }

    private boolean startsWith(byte[] content, int... signature) {
        if (content.length < signature.length) {
            return false;
        }
        for (int i = 0; i < signature.length; i++) {
            if ((content[i] & 0xFF) != signature[i]) {
                return false;
            }
        }
        return true;
    }

    private String sanitizeFileName(String originalName) {
        if (originalName == null) {
            return null;
        }
        int lastSeparator = Math.max(originalName.lastIndexOf('/'), originalName.lastIndexOf('\\'));
        String name = lastSeparator < 0 ? originalName : originalName.substring(lastSeparator + 1);
        StringBuilder cleaned = new StringBuilder();
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            if (!Character.isISOControl(c)) {
                cleaned.append(c);
            }
        }
        String result = cleaned.toString().trim();
        if (result.length() > MAX_FILE_NAME_LENGTH) {
            result = result.substring(0, MAX_FILE_NAME_LENGTH);
        }
        return result.isEmpty() ? null : result;
    }

    private DocumentProcessingException invalid(String message) {
        return new DocumentProcessingException(BackendErrorCode.INVALID_REQUEST, message);
    }

    private DocumentProcessingException tooLarge(String message) {
        return new DocumentProcessingException(BackendErrorCode.FILE_TOO_LARGE, message);
    }
}
