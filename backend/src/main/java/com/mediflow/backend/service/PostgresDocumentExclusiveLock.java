package com.mediflow.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(PostgresDocumentExclusiveLock.class);

    private final JdbcConnectionDetails connectionDetails;

    public PostgresDocumentExclusiveLock(JdbcConnectionDetails connectionDetails) {
        this.connectionDetails = connectionDetails;
    }

    @Override
    public <T> T execute(String documentId, Supplier<T> work) {
        // Los titulares y los waiters del lock no deben ocupar el pool JPA:
        // con dos conexiones, un titular y un waiter impedirían abrir el commit.
        Connection connection;
        try {
            connection = DriverManager.getConnection(
                    connectionDetails.getJdbcUrl(), connectionDetails.getUsername(), connectionDetails.getPassword());
        } catch (SQLException e) {
            throw persistenceFailure("adquirir", documentId, e);
        }

        try {
            connection.setAutoCommit(true);
            acquire(connection, documentId);
        } catch (SQLException e) {
            closeAfterFailure(connection, documentId);
            throw persistenceFailure("adquirir", documentId, e);
        }

        try {
            return work.get();
        } finally {
            // La decisión puede haberse confirmado antes de fallar unlock/close.
            // Esos fallos se registran, pero no sustituyen un resultado confirmado
            // ni la excepción original de work.
            release(connection, documentId);
            close(connection, documentId);
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

    private void close(Connection connection, String documentId) {
        try {
            connection.close();
        } catch (SQLException e) {
            log.error("No se pudo cerrar la conexión del advisory lock para {}", documentId, e);
        }
    }

    private void closeAfterFailure(Connection connection, String documentId) {
        close(connection, documentId);
    }

    private DataAccessResourceFailureException persistenceFailure(String operation, String documentId,
                                                                    SQLException cause) {
        return new DataAccessResourceFailureException(
                "No se pudo " + operation + " el advisory lock de finalización del documento " + documentId, cause);
    }
}
