package com.mediflow.backend.service;

import java.util.function.Supplier;

final class PassThroughDocumentExclusiveLock implements DocumentExclusiveLock {

    @Override
    public <T> T execute(String documentId, Supplier<T> work) {
        return work.get();
    }
}
