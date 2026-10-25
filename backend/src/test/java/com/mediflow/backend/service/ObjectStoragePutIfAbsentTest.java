package com.mediflow.backend.service;

import com.mediflow.backend.config.OciProperties;
import com.oracle.bmc.model.BmcException;
import com.oracle.bmc.objectstorage.ObjectStorageClient;
import com.oracle.bmc.objectstorage.requests.PutObjectRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ObjectStoragePutIfAbsentTest {

    private ObjectStorageClient client;
    private ObjectStorageService service;

    @BeforeEach
    void setUp() {
        client = mock(ObjectStorageClient.class);
        OciProperties properties = new OciProperties();
        properties.setNamespace("ns");
        properties.setBucketName("bucket");
        service = new ObjectStorageService(client, properties);
    }

    @Test
    void ifAbsentSendsIfNoneMatchWildcard() {
        service.putRawBytesIfAbsent("recibidos/DOC-1/original.pdf", new byte[]{1}, "application/pdf");

        ArgumentCaptor<PutObjectRequest> captor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(client).putObject(captor.capture());
        assertEquals("*", captor.getValue().getIfNoneMatch());
        assertEquals("recibidos/DOC-1/original.pdf", captor.getValue().getObjectName());
        assertEquals("application/pdf", captor.getValue().getContentType());
    }

    @Test
    void regularPutDoesNotSendIfNoneMatch() {
        service.putRawBytes("k", new byte[]{1}, "application/pdf");

        ArgumentCaptor<PutObjectRequest> captor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(client).putObject(captor.capture());
        assertNull(captor.getValue().getIfNoneMatch());
    }

    @Test
    void preconditionFailedMapsToObjectAlreadyExists() {
        when(client.putObject(any())).thenThrow(new BmcException(412, "NoneMatch", "exists", "req"));

        assertThrows(ObjectStorageService.ObjectAlreadyExistsException.class,
                () -> service.putRawBytesIfAbsent("k", new byte[]{1}, "application/pdf"));
    }

    @Test
    void otherFailuresAreStorageErrorsNotCollisions() {
        when(client.putObject(any())).thenThrow(new BmcException(500, "InternalError", "boom", "req"));

        ObjectStorageService.StorageOperationException error = assertThrows(
                ObjectStorageService.StorageOperationException.class,
                () -> service.putRawBytesIfAbsent("k", new byte[]{1}, "application/pdf"));
        assertFalse(error instanceof ObjectStorageService.ObjectAlreadyExistsException);
    }

    @Test
    void preconditionFailedOnRegularPutIsNotACollision() {
        when(client.putObject(any())).thenThrow(new BmcException(412, "x", "x", "req"));

        ObjectStorageService.StorageOperationException error = assertThrows(
                ObjectStorageService.StorageOperationException.class,
                () -> service.putRawBytes("k", new byte[]{1}, "application/pdf"));
        assertFalse(error instanceof ObjectStorageService.ObjectAlreadyExistsException);
    }
}
