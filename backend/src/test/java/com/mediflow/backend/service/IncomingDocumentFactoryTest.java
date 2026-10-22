package com.mediflow.backend.service;

import com.mediflow.backend.config.JacksonConfig;
import com.mediflow.backend.dto.ProcessingRequest;
import com.mediflow.backend.dto.request.ProcessFileRequest;
import com.mediflow.backend.dto.request.ProcessTextRequest;
import com.mediflow.backend.enums.BackendErrorCode;
import com.mediflow.backend.enums.InputType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.JsonNode;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IncomingDocumentFactoryTest {

    private final IncomingDocumentFactory factory = new IncomingDocumentFactory(JacksonConfig.createJsonMapper());

    private ProcessFileRequest file(String id, MockMultipartFile file, String channel) {
        ProcessFileRequest request = new ProcessFileRequest();
        request.setDocumentId(id);
        request.setFile(file);
        request.setOriginChannel(channel);
        return request;
    }

    private ProcessTextRequest text(String id, String text, String channel) {
        ProcessTextRequest request = new ProcessTextRequest();
        request.setDocumentId(id);
        request.setDocumentText(text);
        request.setOriginChannel(channel);
        return request;
    }

    private MockMultipartFile pdf(String name) {
        return new MockMultipartFile("file", name, "application/pdf", ProcessingTestData.PDF);
    }

    private BackendErrorCode codeOf(Runnable action) {
        return assertThrows(DocumentProcessingException.class, action::run).getCode();
    }

    @Test
    void acceptsPdfJpegAndPngWithMatchingSignature() {
        IncomingDocument pdf = factory.fromFile(file("DOC-1", pdf("a.pdf"), "Guardia"));
        IncomingDocument jpg = factory.fromFile(file("DOC-2",
                new MockMultipartFile("file", "a.jpg", "image/jpeg", ProcessingTestData.JPEG), "Guardia"));
        IncomingDocument png = factory.fromFile(file("DOC-3",
                new MockMultipartFile("file", "a.png", "image/png", ProcessingTestData.PNG), "Guardia"));

        assertEquals("application/pdf", pdf.storedMimeType());
        assertEquals("image/jpeg", jpg.storedMimeType());
        assertEquals("image/png", png.storedMimeType());
        assertEquals(InputType.FILE, pdf.inputType());
        assertEquals("a.pdf", pdf.fileName());
        assertArrayEquals(ProcessingTestData.PDF, pdf.originalBytes());
    }

    @Test
    void contentTypeParametersAndCaseAreNormalized() {
        IncomingDocument document = factory.fromFile(file(null,
                new MockMultipartFile("file", "a.pdf", "Application/PDF; charset=binary", ProcessingTestData.PDF), "Guardia"));
        assertEquals("application/pdf", document.storedMimeType());
    }

    @Test
    void rejectsUnsupportedOrMissingContentType() {
        assertEquals(BackendErrorCode.INVALID_FILE_TYPE, codeOf(() -> factory.fromFile(file("DOC-1",
                new MockMultipartFile("file", "a.txt", "text/plain", "hola".getBytes()), "Guardia"))));
        assertEquals(BackendErrorCode.INVALID_FILE_TYPE, codeOf(() -> factory.fromFile(file("DOC-1",
                new MockMultipartFile("file", "a.pdf", null, ProcessingTestData.PDF), "Guardia"))));
        assertEquals(BackendErrorCode.INVALID_FILE_TYPE, codeOf(() -> factory.fromFile(file("DOC-1",
                new MockMultipartFile("file", "a.gif", "image/gif", ProcessingTestData.PNG), "Guardia"))));
    }

    @Test
    void rejectsDeclaredTypeThatDoesNotMatchSignature() {
        assertEquals(BackendErrorCode.INVALID_FILE_TYPE, codeOf(() -> factory.fromFile(file("DOC-1",
                new MockMultipartFile("file", "a.pdf", "application/pdf", ProcessingTestData.PNG), "Guardia"))));
        assertEquals(BackendErrorCode.INVALID_FILE_TYPE, codeOf(() -> factory.fromFile(file("DOC-1",
                new MockMultipartFile("file", "a.png", "image/png", "no es png".getBytes()), "Guardia"))));
    }

    @Test
    void rejectsMissingEmptyAndOversizedFiles() {
        assertEquals(BackendErrorCode.INVALID_REQUEST, codeOf(() -> factory.fromFile(file("DOC-1", null, "Guardia"))));
        assertEquals(BackendErrorCode.INVALID_REQUEST, codeOf(() -> factory.fromFile(file("DOC-1",
                new MockMultipartFile("file", "a.pdf", "application/pdf", new byte[0]), "Guardia"))));
        byte[] big = new byte[(int) IncomingDocumentFactory.MAX_FILE_BYTES + 1];
        System.arraycopy(ProcessingTestData.PDF, 0, big, 0, ProcessingTestData.PDF.length);
        assertEquals(BackendErrorCode.FILE_TOO_LARGE, codeOf(() -> factory.fromFile(file("DOC-1",
                new MockMultipartFile("file", "a.pdf", "application/pdf", big), "Guardia"))));
    }

    @Test
    void acceptsFileExactlyAtTheLimit() {
        byte[] exact = new byte[(int) IncomingDocumentFactory.MAX_FILE_BYTES];
        System.arraycopy(ProcessingTestData.PDF, 0, exact, 0, ProcessingTestData.PDF.length);
        IncomingDocument document = factory.fromFile(file("DOC-1",
                new MockMultipartFile("file", "a.pdf", "application/pdf", exact), "Guardia"));
        assertEquals(exact.length, document.originalBytes().length);
    }

    @ParameterizedTest
    @ValueSource(strings = {" ", "\t"})
    void rejectsBlankOriginChannel(String channel) {
        assertEquals(BackendErrorCode.INVALID_REQUEST,
                codeOf(() -> factory.fromFile(file("DOC-1", pdf("a.pdf"), channel))));
        assertEquals(BackendErrorCode.INVALID_REQUEST,
                codeOf(() -> factory.fromText(text("DOC-1", "texto", channel))));
    }

    @Test
    void rejectsMissingOrTooLongOriginChannel() {
        assertEquals(BackendErrorCode.INVALID_REQUEST, codeOf(() -> factory.fromText(text("DOC-1", "texto", null))));
        assertEquals(BackendErrorCode.INVALID_REQUEST, codeOf(() -> factory.fromText(
                text("DOC-1", "texto", "x".repeat(IncomingDocumentFactory.MAX_ORIGIN_CHANNEL_LENGTH + 1)))));
    }

    @ParameterizedTest
    @ValueSource(strings = {"../etc", "a b", "-leading", "_leading", "con/barra", "tilde-é", "dot.dot", " DOC", "DOC\n1"})
    void rejectsInvalidDocumentIds(String id) {
        assertEquals(BackendErrorCode.INVALID_REQUEST,
                codeOf(() -> factory.fromText(text(id, "texto", "Guardia"))));
    }

    @Test
    void enforcesDocumentIdMaximumLength() {
        assertEquals(BackendErrorCode.INVALID_REQUEST,
                codeOf(() -> factory.fromText(text("A".repeat(129), "texto", "Guardia"))));
        assertEquals("A".repeat(128), factory.fromText(text("A".repeat(128), "texto", "Guardia")).documentId());
    }

    @Test
    void keepsValidProvidedIdAndGeneratesWhenAbsentOrEmpty() {
        assertEquals("DOC-CLIN-2026-8942",
                factory.fromText(text("DOC-CLIN-2026-8942", "texto", "Guardia")).documentId());
        assertEquals("TEST-CASE-003", factory.fromText(text("TEST-CASE-003", "texto", "Guardia")).documentId());
        String generated = factory.fromText(text(null, "texto", "Guardia")).documentId();
        String generatedFromEmpty = factory.fromText(text("", "texto", "Guardia")).documentId();
        assertTrue(generated.matches("DOC-[0-9a-f-]{36}"));
        assertTrue(generatedFromEmpty.matches("DOC-[0-9a-f-]{36}"));
        assertNotEquals(generated, generatedFromEmpty);
    }

    @Test
    void fileNameIsStrippedOfPathsAndControlCharacters() {
        IncomingDocument windows = factory.fromFile(file(null, pdf("C:\\Users\\x\\informe.pdf"), "Guardia"));
        IncomingDocument unix = factory.fromFile(file(null, pdf("../../etc/in\nforme.pdf"), "Guardia"));
        IncomingDocument blank = factory.fromFile(file(null, pdf("   "), "Guardia"));
        IncomingDocument longName = factory.fromFile(file(null, pdf("n".repeat(400) + ".pdf"), "Guardia"));

        assertEquals("informe.pdf", windows.fileName());
        assertEquals("informe.pdf", unix.fileName());
        assertNull(blank.fileName());
        assertEquals(IncomingDocumentFactory.MAX_FILE_NAME_LENGTH, longName.fileName().length());
    }

    @Test
    void fileProcessingRequestCarriesBase64AndStoredMime() {
        IncomingDocument document = factory.fromFile(file("DOC-9", pdf("informe.pdf"), "Guardia"));
        ProcessingRequest request = document.toProcessingRequest();

        assertEquals("DOC-9", request.getDocumentId());
        assertEquals(InputType.FILE, request.getInputType());
        assertEquals("application/pdf", request.getMimeType());
        assertEquals("informe.pdf", request.getFileName());
        assertArrayEquals(ProcessingTestData.PDF, Base64.getDecoder().decode(request.getContentBase64()));
        assertNull(request.getDocumentText());
        assertEquals("Guardia", request.getOriginChannel());
        assertTrue(request.isValid());
    }

    @Test
    void textIsStoredAsOriginalJsonAndSentAsTextPlain() {
        IncomingDocument document = factory.fromText(text("DOC-T", "Informe sintético con ñ", "Guardia_Emergencias"));

        assertEquals(InputType.TEXT, document.inputType());
        assertEquals("application/json", document.storedMimeType());
        assertNull(document.fileName());
        JsonNode stored = JacksonConfig.createJsonMapper()
                .readTree(new String(document.originalBytes(), StandardCharsets.UTF_8));
        assertEquals(3, stored.size());
        assertEquals("DOC-T", stored.get("document_id").asString());
        assertEquals("Informe sintético con ñ", stored.get("document_text").asString());
        assertEquals("Guardia_Emergencias", stored.get("origin_channel").asString());

        ProcessingRequest request = document.toProcessingRequest();
        assertEquals(InputType.TEXT, request.getInputType());
        assertEquals("text/plain", request.getMimeType());
        assertNull(request.getFileName());
        assertNull(request.getContentBase64());
        assertEquals("Informe sintético con ñ", request.getDocumentText());
        assertTrue(request.isValid());
    }

    @Test
    void generatedIdIsEmbeddedInStoredTextJson() {
        IncomingDocument document = factory.fromText(text(null, "texto", "Guardia"));
        JsonNode stored = JacksonConfig.createJsonMapper()
                .readTree(new String(document.originalBytes(), StandardCharsets.UTF_8));
        assertEquals(document.documentId(), stored.get("document_id").asString());
    }

    @Test
    void rejectsBlankOrOversizedText() {
        assertEquals(BackendErrorCode.INVALID_REQUEST, codeOf(() -> factory.fromText(text("DOC-1", "   ", "Guardia"))));
        assertEquals(BackendErrorCode.INVALID_REQUEST, codeOf(() -> factory.fromText(text("DOC-1", null, "Guardia"))));
        assertEquals(BackendErrorCode.FILE_TOO_LARGE, codeOf(() -> factory.fromText(
                text("DOC-1", "x".repeat(IncomingDocumentFactory.MAX_TEXT_CHARS + 1), "Guardia"))));
        assertEquals(IncomingDocumentFactory.MAX_TEXT_CHARS, factory.fromText(
                text("DOC-1", "x".repeat(IncomingDocumentFactory.MAX_TEXT_CHARS), "Guardia")).documentText().length());
    }
}
