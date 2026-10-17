package com.mediflow.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.jdbc.autoconfigure.JdbcConnectionDetails;
import org.springframework.dao.DataAccessResourceFailureException;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

class PostgresDocumentExclusiveLockTest {

    @Test
    void mapsAdvisoryLockConnectionFailureToPersistenceException() {
        JdbcConnectionDetails connectionDetails = mock(JdbcConnectionDetails.class);
        when(connectionDetails.getJdbcUrl()).thenReturn("jdbc:driver-that-does-not-exist:test");
        when(connectionDetails.getUsername()).thenReturn("mediflow");
        when(connectionDetails.getPassword()).thenReturn("test");
        PostgresDocumentExclusiveLock lock = new PostgresDocumentExclusiveLock(connectionDetails);

        assertThrows(DataAccessResourceFailureException.class,
                () -> lock.execute("DOC-71", () -> "must not execute"));
    }

    @Test
    void acquisitionSqlFailureRemainsPersistenceException() throws Exception {
        JdbcConnectionDetails connectionDetails = connectionDetails();
        Connection connection = mock(Connection.class);
        PreparedStatement acquire = mock(PreparedStatement.class);
        when(connection.prepareStatement("select pg_advisory_lock(hashtext(?))")).thenReturn(acquire);
        when(acquire.executeQuery()).thenThrow(new SQLException("lock acquisition failed"));
        try (var driverManager = mockStatic(DriverManager.class)) {
            driverManager.when(() -> DriverManager.getConnection(
                    "jdbc:postgresql://localhost/test", "mediflow", "test")).thenReturn(connection);
            PostgresDocumentExclusiveLock lock = new PostgresDocumentExclusiveLock(connectionDetails);

            assertThrows(DataAccessResourceFailureException.class,
                    () -> lock.execute("DOC-71", () -> "must not execute"));
            verify(connection, never()).prepareStatement("select pg_advisory_unlock(hashtext(?))");
        }
    }

    @Test
    void unlockAndConnectionCloseFailuresDoNotReplaceConfirmedResult() throws Exception {
        JdbcConnectionDetails connectionDetails = connectionDetails();
        Connection connection = mock(Connection.class);
        PreparedStatement acquire = mock(PreparedStatement.class);
        PreparedStatement release = mock(PreparedStatement.class);
        ResultSet acquiredResult = mock(ResultSet.class);
        when(connection.prepareStatement("select pg_advisory_lock(hashtext(?))")).thenReturn(acquire);
        when(connection.prepareStatement("select pg_advisory_unlock(hashtext(?))")).thenReturn(release);
        when(acquire.executeQuery()).thenReturn(acquiredResult);
        when(release.executeQuery()).thenThrow(new SQLException("unlock failed"));
        org.mockito.Mockito.doThrow(new SQLException("connection close failed")).when(connection).close();

        try (var driverManager = mockStatic(DriverManager.class)) {
            driverManager.when(() -> DriverManager.getConnection(
                    "jdbc:postgresql://localhost/test", "mediflow", "test")).thenReturn(connection);
            PostgresDocumentExclusiveLock lock = new PostgresDocumentExclusiveLock(connectionDetails);

            String result = lock.execute("DOC-71", () -> "confirmed");

            assertEquals("confirmed", result);
        }
    }

    @Test
    void processingFailureRemainsPrimaryWhenUnlockAlsoFails() throws Exception {
        JdbcConnectionDetails connectionDetails = connectionDetails();
        Connection connection = mock(Connection.class);
        PreparedStatement acquire = mock(PreparedStatement.class);
        PreparedStatement release = mock(PreparedStatement.class);
        ResultSet acquiredResult = mock(ResultSet.class);
        SQLException unlockFailure = new SQLException("unlock failed");
        IllegalStateException processingFailure = new IllegalStateException("review failed");
        when(connection.prepareStatement("select pg_advisory_lock(hashtext(?))")).thenReturn(acquire);
        when(connection.prepareStatement("select pg_advisory_unlock(hashtext(?))")).thenReturn(release);
        when(acquire.executeQuery()).thenReturn(acquiredResult);
        when(release.executeQuery()).thenThrow(unlockFailure);

        try (var driverManager = mockStatic(DriverManager.class)) {
            driverManager.when(() -> DriverManager.getConnection(
                    "jdbc:postgresql://localhost/test", "mediflow", "test")).thenReturn(connection);
            PostgresDocumentExclusiveLock lock = new PostgresDocumentExclusiveLock(connectionDetails);

            IllegalStateException thrown = assertThrows(IllegalStateException.class,
                    () -> lock.execute("DOC-71", () -> { throw processingFailure; }));

            assertSame(processingFailure, thrown);
        }
    }

    private JdbcConnectionDetails connectionDetails() {
        JdbcConnectionDetails details = mock(JdbcConnectionDetails.class);
        when(details.getJdbcUrl()).thenReturn("jdbc:postgresql://localhost/test");
        when(details.getUsername()).thenReturn("mediflow");
        when(details.getPassword()).thenReturn("test");
        return details;
    }
}
