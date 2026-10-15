package com.mediflow.backend.service;

import java.util.function.Supplier;

/**
 * Serializa la finalización de un mismo documento, incluyendo preparación OCI
 * y compensación. La implementación PostgreSQL usa un advisory lock de sesión
 * en una conexión dedicada. La revisión humana mantiene además una transacción
 * con bloqueo de fila desde su validación hasta el commit (arquitectura §9);
 * el advisory lock continúa protegiendo la compensación después del rollback.
 */
public interface DocumentExclusiveLock {

    <T> T execute(String documentId, Supplier<T> work);
}
