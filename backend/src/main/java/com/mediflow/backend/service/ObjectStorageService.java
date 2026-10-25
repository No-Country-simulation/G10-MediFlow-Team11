package com.mediflow.backend.service;

import com.mediflow.backend.config.OciProperties;
import com.oracle.bmc.model.BmcException;
import com.oracle.bmc.objectstorage.ObjectStorageClient;
import com.oracle.bmc.objectstorage.requests.DeleteObjectRequest;
import com.oracle.bmc.objectstorage.requests.GetObjectRequest;
import com.oracle.bmc.objectstorage.requests.PutObjectRequest;
import com.oracle.bmc.objectstorage.responses.GetObjectResponse;

import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Profile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

@Service
@Profile("!local-demo")
public class ObjectStorageService {

    private final ObjectStorageClient client;
    private final OciProperties properties;

    public ObjectStorageService(
            ObjectStorageClient client,
            OciProperties properties
    ) {
        this.client = client;
        this.properties = properties;
    }

    public void putRawBytes(
            String objectKey,
            byte[] content,
            String contentType
    ) {
        put(objectKey, content, contentType, false);
    }

    public void putRawBytesIfAbsent(
            String objectKey,
            byte[] content,
            String contentType
    ) {
        put(objectKey, content, contentType, true);
    }

    private void put(
            String objectKey,
            byte[] content,
            String contentType,
            boolean onlyIfAbsent
    ) {
        Objects.requireNonNull(content, "El contenido es obligatorio");

        if (contentType == null || contentType.isBlank()) {
            throw new IllegalArgumentException(
                    "Content-Type es obligatorio"
            );
        }

        try {
            PutObjectRequest.Builder request = PutObjectRequest.builder()
                    .namespaceName(properties.getNamespace())
                    .bucketName(properties.getBucketName())
                    .objectName(objectKey)
                    .contentType(contentType)
                    .contentLength((long) content.length)
                    .putObjectBody(new ByteArrayInputStream(content));
            if (onlyIfAbsent) {
                request.ifNoneMatch("*");
            }

            client.putObject(request.build());

        } catch (BmcException e) {
            if (onlyIfAbsent && e.getStatusCode() == 412) {
                throw new ObjectAlreadyExistsException(
                        "El objeto OCI ya existe",
                        e
                );
            }
            throw new StorageOperationException(
                    "Fallo al subir objeto a OCI",
                    e
            );
        }
    }

    public void putJson(String objectKey, String json) {
        Objects.requireNonNull(json, "El JSON es obligatorio");

        putRawBytes(
                objectKey,
                json.getBytes(StandardCharsets.UTF_8),
                "application/json"
        );
    }

    public byte[] getObject(String objectKey) {
        try {
            GetObjectRequest request = GetObjectRequest.builder()
                    .namespaceName(properties.getNamespace())
                    .bucketName(properties.getBucketName())
                    .objectName(objectKey)
                    .build();

            GetObjectResponse response = client.getObject(request);

            try (InputStream input = response.getInputStream()) {
                return input.readAllBytes();
            }

        } catch (BmcException e) {
            if (isNotFound(e)) {
                throw new ObjectNotFoundException(
                        "Objeto OCI inexistente",
                        e
                );
            }
            throw new StorageOperationException(
                    "Fallo al leer objeto de OCI",
                    e
            );

        } catch (IOException e) {
            throw new StorageOperationException(
                    "Fallo de I/O al leer objeto de OCI",
                    e
            );
        }
    }

    public void deleteObject(String objectKey) {
        try {
            DeleteObjectRequest request =
                    DeleteObjectRequest.builder()
                            .namespaceName(properties.getNamespace())
                            .bucketName(properties.getBucketName())
                            .objectName(objectKey)
                            .build();

            client.deleteObject(request);

        } catch (BmcException e) {
            if (isNotFound(e)) {
                return;
            }
            throw new StorageOperationException(
                    "Fallo al eliminar objeto de OCI",
                    e
            );
        }
    }

    static boolean isNotFound(BmcException exception) {
        return exception.getStatusCode() == 404;
    }

    public void copyWithinBucket(
            String sourceKey,
            String destinationKey
    ) {
        byte[] content = getObject(sourceKey);

        putRawBytes(
                destinationKey,
                content,
                guessContentType(destinationKey)
        );
    }

    private String guessContentType(String key) {
        if (key.endsWith(".pdf")) {
            return "application/pdf";
        }

        if (key.endsWith(".jpg") || key.endsWith(".jpeg")) {
            return "image/jpeg";
        }

        if (key.endsWith(".png")) {
            return "image/png";
        }

        return "application/json";
    }

    public static class StorageOperationException
            extends RuntimeException {

        public StorageOperationException(
                String message,
                Throwable cause
        ) {
            super(message, cause);
        }
    }

    /**
     * El objeto no existe (HTTP 404 del SDK). No representa un fallo de
     * permisos, red o servicio; esos siguen siendo {@link StorageOperationException}.
     */
    public static class ObjectNotFoundException extends StorageOperationException {

        public ObjectNotFoundException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public static class ObjectAlreadyExistsException extends StorageOperationException {

        public ObjectAlreadyExistsException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
