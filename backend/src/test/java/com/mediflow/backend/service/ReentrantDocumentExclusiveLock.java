package com.mediflow.backend.service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

final class ReentrantDocumentExclusiveLock implements DocumentExclusiveLock {

    private final ConcurrentHashMap<String, ReentrantLock> locks = new ConcurrentHashMap<>();

    @Override
    public <T> T execute(String documentId, Supplier<T> work) {
        ReentrantLock lock = locks.computeIfAbsent(documentId, ignored -> new ReentrantLock());
        lock.lock();
        try {
            return work.get();
        } finally {
            lock.unlock();
        }
    }
}
