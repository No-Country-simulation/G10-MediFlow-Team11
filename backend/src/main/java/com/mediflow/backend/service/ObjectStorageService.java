package com.mediflow.backend.service;

import com.mediflow.backend.config.OciProperties;
import com.oracle.bmc.model.BmcException;
import com.oracle.bmc.objectstorage.ObjectStorageClient;
import com.oracle.bmc.objectstorage.requests.GetObjectRequest;
import com.oracle.bmc.objectstorage.requests.PutObjectRequest;
import com.oracle.bmc.objectstorage.responses.GetObjectResponse;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Service
public class ObjectStorageService {
    private final ObjectStorageClient client;
    private final OciProperties properties;

    public ObjectStorageService(ObjectStorageClient client, OciProperties properties) {
        this.client = client;
        this.properties = properties;
    }

    public void putRawBytes(String objectKey, byte[] content, String contentType) {
        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .namespaceName(properties.getNamespace())
                    .bucketName(properties.getBucketName())
                    .objectName(objectKey)
                    .contentType(contentType)
                    .contentLength((long) content.length)
                    .putObjectBody(new ByteArrayInputStream(content))
                    .build();
            client.putObject(request);
        } catch (BmcException e) {
            throw new StorageOperationException("Fallo al subir objeto a OCI: " + objectKey, e);
        }
    }

    public void putJson(String objectKey, String json) {
        putRawBytes(objectKey, json.getBytes(StandardCharsets.UTF_8), "application/json");
    }

    public byte[] getObject(String objectKey) {
        try {
            GetObjectRequest request = GetObjectRequest.builder()
                    .namespaceName(properties.getNamespace())
                    .bucketName(properties.getBucketName())
                    .objectName(objectKey)
                    .build();
            GetObjectResponse response = client.getObject(request);
            try (InputStream is = response.getInputStream()) {
                return is.readAllBytes();
            }
        } catch (BmcException e) {
            throw new StorageOperationException("Fallo al leer objeto de OCI: " + objectKey, e);
        } catch (IOException e) {
            throw new StorageOperationException("Fallo de I/O al leer objeto de OCI: " + objectKey, e);
        }
    }

    /** get+put simple; para volúmenes mayores usar CopyObjectRequest nativo del SDK. */
    public void copyWithinBucket(String sourceKey, String destinationKey) {
        byte[] content = getObject(sourceKey);
        putRawBytes(destinationKey, content, guessContentType(destinationKey));
    }

    private String guessContentType(String key) {
        if (key.endsWith(".pdf")) return "application/pdf";
        if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
        if (key.endsWith(".png")) return "image/png";
        return "application/json";
    }

    public static class StorageOperationException extends RuntimeException {
        public StorageOperationException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}