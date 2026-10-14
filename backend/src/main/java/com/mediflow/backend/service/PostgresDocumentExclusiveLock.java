package com.mediflow.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.function.Supplier;

/**
 * {@code pg_advisory_lock(hashtext(document_id))} en una conexión retenida
 * durante toda la sección crítica. El lock de sesión no se libera al hacer
 * commit de otras transacciones JPA, y no mantiene un UPDATE abierto contra
 * {@code documents} mientras se llama a OCI.
 */
@Component
public class PostgresDocumentExclusiveLock implements DocumentExclusiveLock {

    private static final Logger log = LoggerFactory.getLogger(PostgresDocumentExclusiveLock.class);

    private final DataSource dataSource;

    public PostgresDocumentExclusiveLock(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public <T> T execute(String documentId, Supplier<T> work) {
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(true);
            acquire(connection, documentId);
            try {
                return work.get();
            } finally {
                release(connection, documentId);
            }
        } catch (SQLException e) {
            throw new IllegalStateException(
                    "No se pudo serializar la finalización del documento " + documentId, e);
        }
    }

    private void acquire(Connection connection, String documentId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "select pg_advisory_lock(hashtext(?))")) {
            statement.setString(1, documentId);
            statement.executeQuery().close();
        }
    }

    private void release(Connection connection, String documentId) {
        try (PreparedStatement statement = connection.prepareStatement(
                "select pg_advisory_unlock(hashtext(?))")) {
            statement.setString(1, documentId);
            statement.executeQuery().close();
        } catch (SQLException e) {
            log.error("No se pudo liberar el advisory lock de finalización para {}", documentId, e);
        }
    }
}
