package com.mediflow.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.jdbc.autoconfigure.JdbcConnectionDetails;
import org.springframework.dao.DataAccessResourceFailureException;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
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
}
