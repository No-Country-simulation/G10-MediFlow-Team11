package com.mediflow.backend.service;

import java.util.function.Supplier;

/**
 * Serializa la finalización de un mismo documento, incluyendo preparación OCI
 * y compensación. No abre una transacción de escritura durante I/O externo:
 * la implementación PostgreSQL usa un advisory lock de sesión en una conexión
 * dedicada (arquitectura §12.4 y concurrencia de §9).
 */
public interface DocumentExclusiveLock {

    <T> T execute(String documentId, Supplier<T> work);
}
