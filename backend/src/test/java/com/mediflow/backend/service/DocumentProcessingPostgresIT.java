package com.mediflow.backend.service;

import com.mediflow.backend.dto.ProcessingRequest;
import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.enums.AuditReason;
import com.mediflow.backend.enums.DocumentStatus;
import com.mediflow.backend.enums.InputType;
import com.mediflow.backend.enums.PrimaryDestination;
import com.mediflow.backend.enums.StorageState;
import com.mediflow.backend.persistence.DocumentPersistenceService;
import com.oracle.bmc.auth.BasicAuthenticationDetailsProvider;
import com.oracle.bmc.objectstorage.ObjectStorageClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** HTTP real (Tomcat), PostgreSQL real y lock advisory real; OCI en memoria e IA simulada. */
@Testcontainers
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.jpa.hibernate.ddl-auto=create",
                "spring.datasource.hikari.maximum-pool-size=3",
                "spring.datasource.hikari.connection-timeout=20000"
        })
class DocumentProcessingPostgresIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @TestConfiguration
    static class StorageConfig {
        @Bean
        @Primary
        InMemoryObjectStorageService inMemoryStorage() {
            return new InMemoryObjectStorageService();
        }
    }

    @MockitoBean BasicAuthenticationDetailsProvider authenticationDetailsProvider;
    @MockitoBean ObjectStorageClient objectStorageClient;
    @MockitoBean AiCoreClient aiCoreClient;
    @Autowired InMemoryObjectStorageService storage;
    @Autowired DocumentPersistenceService persistence;
    @Autowired JdbcTemplate jdbc;
    @Autowired JsonMapper json;
    @Value("${local.server.port}") int port;

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    record Reply(int status, String body) {
        JsonNode json(JsonMapper mapper) {
            return mapper.readTree(body);
        }
    }

    @AfterEach
    void resetStorageFaults() {
        storage.failPutsMatching(key -> false);
        storage.failGetsMatching(key -> false);
        storage.failDeletesMatching(key -> false);
        storage.missingGetsMatching(key -> false);
    }

    private static String newId() {
        return "IT-" + UUID.randomUUID();
    }

    private void aiAnswers(String priority, String destination, String reasons) {
        when(aiCoreClient.process(any())).thenAnswer(invocation -> {
            ProcessingRequest request = invocation.getArgument(0);
            return ProcessingTestData.aiResponse(request.getDocumentId(), priority, destination, reasons);
        });
    }

    private Reply postFile(String id, byte[] content, String contentType, String fileName) throws Exception {
        String boundary = "----it" + UUID.randomUUID();
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        if (id != null) {
            textPart(body, boundary, "document_id", id);
        }
        textPart(body, boundary, "origin_channel", "Guardia_Emergencias");
        body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + fileName
                + "\"\r\nContent-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        body.write(content);
        body.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/documents/process-file"))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray()))
                .build();
        return send(request);
    }

    private void textPart(ByteArrayOutputStream body, String boundary, String name, String value) throws Exception {
        body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n" + value + "\r\n")
                .getBytes(StandardCharsets.UTF_8));
    }

    private Reply postText(String rawJson) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/documents/process-text"))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(rawJson, StandardCharsets.UTF_8))
                .build();
        return send(request);
    }

    private Reply get(String path) throws Exception {
        return send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build());
    }

    private Reply send(HttpRequest request) throws Exception {
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        return new Reply(response.statusCode(), response.body());
    }

    private String textBody(String id) {
        return "{" + (id == null ? "" : "\"document_id\":\"" + id + "\",")
                + "\"document_text\":\"Texto clinico sintetico\",\"origin_channel\":\"Consulta_Ambulatoria\"}";
    }

    private int rows(String id) {
        return jdbc.queryForObject("select count(*) from documents where id = ?", Integer.class, id);
    }

    private int history(String id) {
        return jdbc.queryForObject("select count(*) from document_triage_history where document_id = ?", Integer.class, id);
    }

    @Test
    void fileEndToEndOverHttpEndsProcessedAndMatchesTheQueryEndpoint() throws Exception {
        aiAnswers("ROUTINE", "MEDICAL_RECORD", "[]");
        String id = newId();

        Reply reply = postFile(id, ProcessingTestData.PDF, "application/pdf", "informe.pdf");

        assertEquals(200, reply.status(), reply.body());
        JsonNode body = reply.json(json);
        assertEquals(id, body.get("document_id").asString());
        assertEquals("PROCESSED", body.get("status").asString());
        assertEquals("SUCCESS", body.get("storage").get("state").asString());
        assertFalse(body.get("routing_decision").get("requires_human_review").asBoolean());
        assertFalse(reply.body().contains("object_key"));
        assertFalse(reply.body().contains("bucket"));
        assertEquals("PROCESSED", jdbc.queryForObject("select status from documents where id = ?", String.class, id));
        assertEquals("procesados/rutina/" + id + "/original.pdf",
                jdbc.queryForObject("select object_key from documents where id = ?", String.class, id));
        assertEquals(1, history(id));
        assertEquals("INITIAL_TRIAGE", jdbc.queryForObject(
                "select event_type from document_triage_history where document_id = ?", String.class, id));
        assertTrue(storage.contains("procesados/rutina/" + id + "/triage.json"));
        assertFalse(storage.contains("recibidos/" + id + "/original.pdf"));

        Reply query = get("/api/v1/documents/" + id);
        assertEquals(200, query.status());
        assertEquals(body, query.json(json));
    }

    @Test
    void textEndToEndWithAiTimeoutReturns200NeedsAuditAndPersistsFallback() throws Exception {
        when(aiCoreClient.process(any())).thenThrow(new AiCoreClient.AiClientFatalException(AuditReason.AI_TIMEOUT));
        String id = newId();

        Reply reply = postText(textBody(id));

        assertEquals(200, reply.status(), reply.body());
        JsonNode body = reply.json(json);
        assertEquals("NEEDS_AUDIT", body.get("status").asString());
        assertTrue(body.get("classification").isNull());
        assertTrue(body.get("confidence").isNull());
        assertEquals("HUMAN_REVIEW", body.get("routing_decision").get("primary_destination").asString());
        assertEquals("AI_TIMEOUT", body.get("routing_decision").get("audit_reasons").get(0).asString());
        assertTrue(body.get("routing_decision").get("requires_human_review").asBoolean());
        assertFalse(body.get("notification").get("generated").asBoolean());
        assertEquals("application/json",
                jdbc.queryForObject("select mime_type from documents where id = ?", String.class, id));
        assertEquals("TEXT", jdbc.queryForObject("select input_type from documents where id = ?", String.class, id));
        assertTrue(storage.contains("auditoria_humana/" + id + "/original.json"));
        assertEquals("Texto clinico sintetico", json.readTree(
                storage.readUtf8("auditoria_humana/" + id + "/original.json")).get("document_text").asString());
        assertEquals(1, history(id));
    }

    @Test
    void generatedIdOverHttpIsConsistentAcrossStorageDatabaseAndResponse() throws Exception {
        aiAnswers("URGENT", "MEDICAL_EMERGENCY", "[]");

        Reply reply = postText(textBody(null));

        assertEquals(200, reply.status(), reply.body());
        JsonNode body = reply.json(json);
        String id = body.get("document_id").asString();
        assertTrue(id.startsWith("DOC-"));
        assertEquals(1, rows(id));
        assertTrue(storage.contains("procesados/urgentes/" + id + "/original.json"));
        assertTrue(body.get("notification").get("generated").asBoolean());
        assertEquals("MEDICAL_EMERGENCY", body.get("notification").get("type").asString());
    }

    @Test
    void concurrentRequestsWithTheSameIdLeaveExactlyOneWinnerAndItsOriginalIntact() throws Exception {
        int contenders = 8;
        String id = newId();
        AtomicInteger aiCalls = new AtomicInteger();
        when(aiCoreClient.process(any())).thenAnswer(invocation -> {
            aiCalls.incrementAndGet();
            Thread.sleep(400);
            ProcessingRequest request = invocation.getArgument(0);
            return ProcessingTestData.aiResponse(request.getDocumentId(), "ROUTINE", "MEDICAL_RECORD", "[]");
        });
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(contenders);
        try {
            List<Future<Reply>> futures = new ArrayList<>();
            for (int i = 0; i < contenders; i++) {
                byte[] content = ("%PDF-1.4 contender-" + i).getBytes(StandardCharsets.US_ASCII);
                Callable<Reply> call = () -> {
                    start.await();
                    return postFile(id, content, "application/pdf", "c.pdf");
                };
                futures.add(pool.submit(call));
            }
            start.countDown();
            List<Reply> replies = new ArrayList<>();
            for (Future<Reply> future : futures) {
                replies.add(future.get(90, TimeUnit.SECONDS));
            }

            List<Reply> winners = replies.stream().filter(r -> r.status() == 200).toList();
            List<Reply> losers = replies.stream().filter(r -> r.status() != 200).toList();
            assertEquals(1, winners.size(), replies.toString());
            assertEquals(contenders - 1, losers.size());
            for (Reply loser : losers) {
                assertEquals(409, loser.status(), loser.body());
                assertEquals("DOCUMENT_ID_ALREADY_EXISTS", loser.json(json).get("error").get("code").asString());
            }
            assertEquals(1, aiCalls.get());
            assertEquals(1, rows(id));
            assertEquals(1, history(id));
            assertEquals("PROCESSED", jdbc.queryForObject("select status from documents where id = ?", String.class, id));

            int winnerIndex = -1;
            byte[] stored = storage.getObject("procesados/rutina/" + id + "/original.pdf");
            for (int i = 0; i < contenders; i++) {
                if (Arrays.equals(stored, ("%PDF-1.4 contender-" + i).getBytes(StandardCharsets.US_ASCII))) {
                    winnerIndex = i;
                }
            }
            assertTrue(winnerIndex >= 0, "el original almacenado debe ser el de un único contendiente");
            assertEquals(List.of("recibidos/" + id + "/original.pdf", "recibidos/" + id + "/triage.json"),
                    storage.deletedKeys().stream().filter(k -> k.contains(id)).toList(),
                    "solo la limpieza post-commit del ganador puede borrar claves de este documento");
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void duplicateWhileFirstRequestIsStillInAiIsRejectedAndFirstOriginalSurvives() throws Exception {
        String id = newId();
        CountDownLatch inAi = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicInteger advisoryLocksDuringAi = new AtomicInteger(-1);
        when(aiCoreClient.process(any())).thenAnswer(invocation -> {
            advisoryLocksDuringAi.set(jdbc.queryForObject(
                    "select count(*) from pg_locks where locktype = 'advisory' and granted", Integer.class));
            inAi.countDown();
            assertTrue(release.await(30, TimeUnit.SECONDS));
            ProcessingRequest request = invocation.getArgument(0);
            return ProcessingTestData.aiResponse(request.getDocumentId(), "ROUTINE", "MEDICAL_RECORD", "[]");
        });
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<Reply> first = pool.submit(() -> postFile(id, ProcessingTestData.PDF, "application/pdf", "a.pdf"));
            assertTrue(inAi.await(30, TimeUnit.SECONDS));

            assertEquals("PROCESSING", jdbc.queryForObject("select status from documents where id = ?", String.class, id));
            assertArrayEquals(ProcessingTestData.PDF, storage.getObject("recibidos/" + id + "/original.pdf"));
            assertEquals(0, advisoryLocksDuringAi.get(), "el lock de recepción no debe retenerse durante la llamada a IA");

            Reply duplicate = postFile(id, "%PDF-1.4 intruso".getBytes(StandardCharsets.US_ASCII), "application/pdf", "b.pdf");
            assertEquals(409, duplicate.status(), duplicate.body());
            assertArrayEquals(ProcessingTestData.PDF, storage.getObject("recibidos/" + id + "/original.pdf"));
            assertTrue(storage.deletedKeys().stream().noneMatch(k -> k.contains(id)));

            release.countDown();
            assertEquals(200, first.get(30, TimeUnit.SECONDS).status());
            verify(aiCoreClient, times(1)).process(any());
            assertArrayEquals(ProcessingTestData.PDF, storage.getObject("procesados/rutina/" + id + "/original.pdf"));
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    void orphanObjectWithoutRowIsRejectedAndLeftUntouched() throws Exception {
        String id = newId();
        storage.seed("recibidos/" + id + "/original.pdf", "huerfano");

        Reply reply = postFile(id, ProcessingTestData.PDF, "application/pdf", "a.pdf");

        assertEquals(409, reply.status(), reply.body());
        assertEquals("huerfano", storage.readUtf8("recibidos/" + id + "/original.pdf"));
        assertEquals(0, rows(id));
        verify(aiCoreClient, never()).process(any());
    }

    @Test
    void storageFailureDuringFinalizationReturns500StorageErrorButKeepsRecoverableNeedsAudit() throws Exception {
        aiAnswers("ROUTINE", "MEDICAL_RECORD", "[]");
        storage.failPutsMatching(key -> key.endsWith("triage.json"));
        String id = newId();

        Reply reply = postFile(id, ProcessingTestData.PDF, "application/pdf", "a.pdf");

        assertEquals(500, reply.status(), reply.body());
        assertEquals("STORAGE_ERROR", reply.json(json).get("error").get("code").asString());
        assertEquals("NEEDS_AUDIT", jdbc.queryForObject("select status from documents where id = ?", String.class, id));
        assertEquals("ERROR", jdbc.queryForObject("select storage_state from documents where id = ?", String.class, id));
        assertEquals(1, history(id));
        assertTrue(storage.contains("recibidos/" + id + "/original.pdf"));
    }

    @Test
    void uploadFailureReturns500WithoutRowOrAiCall() throws Exception {
        storage.failPutsMatching(key -> key.startsWith("recibidos/"));
        String id = newId();

        Reply reply = postFile(id, ProcessingTestData.PDF, "application/pdf", "a.pdf");

        assertEquals(500, reply.status());
        assertEquals("STORAGE_ERROR", reply.json(json).get("error").get("code").asString());
        assertEquals(0, rows(id));
        verify(aiCoreClient, never()).process(any());
    }

    @Test
    void validationAndBindingErrorsOverHttpCreateNothing() throws Exception {
        String id = newId();

        Reply badType = postFile(id, "hola".getBytes(StandardCharsets.UTF_8), "text/plain", "a.txt");
        assertEquals(400, badType.status());
        assertEquals("INVALID_FILE_TYPE", badType.json(json).get("error").get("code").asString());

        Reply fakePdf = postFile(id, ProcessingTestData.PNG, "application/pdf", "a.pdf");
        assertEquals(400, fakePdf.status());
        assertEquals("INVALID_FILE_TYPE", fakePdf.json(json).get("error").get("code").asString());

        Reply badId = postText("{\"document_id\":\"../x\",\"document_text\":\"t\",\"origin_channel\":\"c\"}");
        assertEquals(400, badId.status());
        assertEquals("INVALID_REQUEST", badId.json(json).get("error").get("code").asString());

        Reply malformed = postText("{\"document_text\":");
        assertEquals(400, malformed.status());
        assertEquals("INVALID_REQUEST", malformed.json(json).get("error").get("code").asString());

        Reply blankText = postText("{\"document_text\":\"  \",\"origin_channel\":\"c\"}");
        assertEquals(400, blankText.status());
        assertEquals("INVALID_REQUEST", blankText.json(json).get("error").get("code").asString());

        assertEquals(0, rows(id));
        assertTrue(storage.putKeys().stream().noneMatch(k -> k.contains(id)));
        verify(aiCoreClient, never()).process(any());
    }

    @Test
    void fileAbovePerFileLimitIsRejectedByTomcatMultipartAs413() throws Exception {
        byte[] big = new byte[(int) IncomingDocumentFactory.MAX_FILE_BYTES + 1024];
        System.arraycopy(ProcessingTestData.PDF, 0, big, 0, ProcessingTestData.PDF.length);
        String id = newId();

        Reply reply = postFile(id, big, "application/pdf", "grande.pdf");

        assertEquals(413, reply.status(), reply.body());
        assertEquals("FILE_TOO_LARGE", reply.json(json).get("error").get("code").asString());
        assertEquals(0, rows(id));
        verify(aiCoreClient, never()).process(any());
    }

    @Test
    void fileExactlyAtTheLimitIsAccepted() throws Exception {
        aiAnswers("ROUTINE", "MEDICAL_RECORD", "[]");
        byte[] exact = new byte[(int) IncomingDocumentFactory.MAX_FILE_BYTES];
        System.arraycopy(ProcessingTestData.PDF, 0, exact, 0, ProcessingTestData.PDF.length);
        String id = newId();

        Reply reply = postFile(id, exact, "application/pdf", "limite.pdf");

        assertEquals(200, reply.status(), reply.body());
        assertEquals(exact.length, storage.getObject("procesados/rutina/" + id + "/original.pdf").length);
    }

    @Test
    void createReceivedNeverOverwritesAnExistingDocument() {
        String id = newId();
        persistence.createReceived(received(id, "canal-original"));

        assertThrows(DocumentPersistenceService.DuplicateDocumentException.class,
                () -> persistence.createReceived(received(id, "canal-intruso")));

        assertEquals("canal-original", jdbc.queryForObject(
                "select origin_channel from documents where id = ?", String.class, id));
        assertEquals(1, rows(id));
    }

    @Test
    void markProcessingOnlyMovesReceivedDocuments() {
        String id = newId();
        persistence.createReceived(received(id, "canal"));

        assertTrue(persistence.markProcessing(id));
        assertEquals(DocumentStatus.PROCESSING, persistence.getDocument(id).getStatus());
        assertFalse(persistence.markProcessing(id));
        assertFalse(persistence.markProcessing("no-existe-" + id));
        assertTrue(persistence.existsDocument(id));
        assertFalse(persistence.existsDocument("no-existe-" + id));
    }

    @Test
    void createdReceivedRecordHasTheInitialContractValues() {
        String id = newId();
        persistence.createReceived(received(id, "canal"));

        DocumentRecord stored = persistence.getDocument(id);
        assertEquals(DocumentStatus.RECEIVED, stored.getStatus());
        assertEquals(StorageState.PENDING, stored.getStorageState());
        assertEquals(PrimaryDestination.HUMAN_REVIEW, stored.getRoutingDestination());
        assertEquals("Procesamiento pendiente", stored.getRoutingJustification());
        assertEquals(Map.of("generated", false), stored.getNotification());
        assertTrue(stored.getAuditReasons().isEmpty());
        assertNotNull(stored.getCreatedAt());
        assertEquals(0, history(id));
    }

    private DocumentRecord received(String id, String channel) {
        DocumentRecord record = new DocumentRecord();
        record.setId(id);
        record.setStatus(DocumentStatus.RECEIVED);
        record.setOriginChannel(channel);
        record.setInputType(InputType.FILE);
        record.setMimeType("application/pdf");
        record.setFileName("a.pdf");
        record.setBucket("test-bucket");
        record.setObjectKey("recibidos/" + id + "/original.pdf");
        record.setStorageState(StorageState.PENDING);
        record.setRoutingDestination(PrimaryDestination.HUMAN_REVIEW);
        record.setRoutingJustification("Procesamiento pendiente");
        return record;
    }
}
