package com.mediflow.backend.service;

import org.springframework.stereotype.Component;
import org.springframework.boot.jdbc.autoconfigure.JdbcConnectionDetails;
import org.springframework.dao.DataAccessResourceFailureException;

import java.sql.Connection;
import java.sql.DriverManager;
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

    private final JdbcConnectionDetails connectionDetails;

    public PostgresDocumentExclusiveLock(JdbcConnectionDetails connectionDetails) {
        this.connectionDetails = connectionDetails;
    }

    @Override
    public <T> T execute(String documentId, Supplier<T> work) {
        // Los titulares y los waiters del lock no deben ocupar el pool JPA:
        // con dos conexiones, un titular y un waiter impedirían abrir el commit.
        // Al cerrar esta sesión física también se libera el lock si unlock falla.
        try (Connection connection = DriverManager.getConnection(
                connectionDetails.getJdbcUrl(), connectionDetails.getUsername(), connectionDetails.getPassword())) {
            connection.setAutoCommit(true);
            acquire(connection, documentId);
            try {
                return work.get();
            } finally {
                release(connection, documentId);
            }
        } catch (SQLException e) {
            throw new DataAccessResourceFailureException(
                    "No se pudo adquirir el advisory lock de finalización del documento " + documentId, e);
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
            throw new DataAccessResourceFailureException(
                    "No se pudo liberar el advisory lock de finalización del documento " + documentId, e);
        }
    }
}
