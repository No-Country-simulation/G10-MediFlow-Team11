package com.mediflow.backend.service;

import com.mediflow.backend.config.ObjectStorageConfig;
import com.oracle.bmc.objectstorage.ObjectStorageClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LocalFileObjectStorageServiceTest {
    @TempDir Path temporary;

    @Test
    void survivesServiceRecreationAndPreservesObjectOperations() {
        Path volume = temporary.resolve("isolated-volume");
        var first = new LocalFileObjectStorageService(volume.toString());
        byte[] original = "synthetic document".getBytes(StandardCharsets.UTF_8);
        first.putRawBytesIfAbsent("recibidos/DOC-1/original.json", original, "application/json");
        assertThrows(ObjectStorageService.ObjectAlreadyExistsException.class,
                () -> first.putRawBytesIfAbsent("recibidos/DOC-1/original.json", new byte[]{1}, "application/json"));

        var restarted = new LocalFileObjectStorageService(volume.toString());
        assertArrayEquals(original, restarted.getObject("recibidos/DOC-1/original.json"));
        restarted.copyWithinBucket("recibidos/DOC-1/original.json", "auditoria_humana/DOC-1/original.json");
        assertArrayEquals(original, restarted.getObject("auditoria_humana/DOC-1/original.json"));
        restarted.putJson("auditoria_humana/DOC-1/triage.json", "{\"status\":\"NEEDS_AUDIT\"}");
        assertEquals("{\"status\":\"NEEDS_AUDIT\"}",
                new String(restarted.getObject("auditoria_humana/DOC-1/triage.json"), StandardCharsets.UTF_8));
        restarted.deleteObject("recibidos/DOC-1/original.json");
        restarted.deleteObject("recibidos/DOC-1/original.json");
        assertThrows(ObjectStorageService.ObjectNotFoundException.class,
                () -> restarted.getObject("recibidos/DOC-1/original.json"));
    }

    @Test
    void rejectsKeysOutsideDedicatedVolume() {
        var storage = new LocalFileObjectStorageService(temporary.resolve("objects").toString());
        assertThrows(ObjectStorageService.StorageOperationException.class,
                () -> storage.putRawBytes("../outside", new byte[]{1}, "application/json"));
        assertThrows(ObjectStorageService.StorageOperationException.class,
                () -> storage.getObject("C:\\outside"));
        assertThrows(IllegalArgumentException.class,
                () -> new LocalFileObjectStorageService(temporary.getRoot().toString()));
    }

    @Test
    void localDemoRegistersOnlyLocalStorageAndNoOciClient() {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.getEnvironment().setActiveProfiles("local-demo");
            context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("test", Map.of(
                    "mediflow.local-demo.storage-root", temporary.resolve("objects").toString())));
            context.register(ObjectStorageConfig.class, ObjectStorageService.class, LocalFileObjectStorageService.class);
            context.refresh();
            assertInstanceOf(LocalFileObjectStorageService.class, context.getBean(ObjectStorageService.class));
            assertEquals(1, context.getBeansOfType(ObjectStorageService.class).size());
            assertTrue(context.getBeansOfType(ObjectStorageClient.class).isEmpty());
        }
    }
}
