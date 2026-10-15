package com.mediflow.backend.service;

import com.mediflow.backend.config.OciProperties;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Predicate;

/**
 * Doble determinista de Object Storage. No demuestra el SDK OCI real:
 * solo la coordinación de claves, copias y artefactos en memoria.
 */
class InMemoryObjectStorageService extends ObjectStorageService {

    private final ConcurrentHashMap<String, byte[]> objects = new ConcurrentHashMap<>();
    private final AtomicInteger concurrentPuts = new AtomicInteger();
    private final AtomicInteger maxConcurrentPuts = new AtomicInteger();
    private final CopyOnWriteArrayList<String> deletedKeys = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<String> putKeys = new CopyOnWriteArrayList<>();

    private volatile Predicate<String> failPut = key -> false;
    private volatile Predicate<String> failGet = key -> false;
    private volatile Predicate<String> failDelete = key -> false;
    private volatile Predicate<String> missingGet = key -> false;
    private volatile CyclicBarrier putBarrier;

    InMemoryObjectStorageService() {
        super(null, new OciProperties());
    }

    @Override
    public void putRawBytes(String objectKey, byte[] content, String contentType) {
        put(objectKey, content);
    }

    @Override
    public void putJson(String objectKey, String json) {
        put(objectKey, json.getBytes(StandardCharsets.UTF_8));
    }

    private void put(String objectKey, byte[] content) {
        CyclicBarrier barrier = putBarrier;
        if (barrier != null) {
            try {
                barrier.await();
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }
        int inFlight = concurrentPuts.incrementAndGet();
        maxConcurrentPuts.accumulateAndGet(inFlight, Math::max);
        try {
            if (failPut.test(objectKey)) {
                throw new StorageOperationException("put fail " + objectKey, new RuntimeException("induced"));
            }
            objects.put(objectKey, content);
            putKeys.add(objectKey);
        } finally {
            concurrentPuts.decrementAndGet();
        }
    }

    @Override
    public byte[] getObject(String objectKey) {
        if (failGet.test(objectKey)) {
            throw new StorageOperationException("get fail " + objectKey, new RuntimeException("induced"));
        }
        if (missingGet.test(objectKey) || !objects.containsKey(objectKey)) {
            throw new ObjectNotFoundException("missing " + objectKey, new RuntimeException("404"));
        }
        return objects.get(objectKey);
    }

    @Override
    public void deleteObject(String objectKey) {
        if (failDelete.test(objectKey)) {
            throw new StorageOperationException("delete fail " + objectKey, new RuntimeException("induced"));
        }
        objects.remove(objectKey);
        deletedKeys.add(objectKey);
    }

    @Override
    public void copyWithinBucket(String sourceKey, String destinationKey) {
        byte[] content = getObject(sourceKey);
        putRawBytes(destinationKey, content, "application/octet-stream");
    }

    void seed(String key, String content) {
        objects.put(key, content.getBytes(StandardCharsets.UTF_8));
    }

    void failPutsMatching(Predicate<String> predicate) {
        this.failPut = predicate;
    }

    void failGetsMatching(Predicate<String> predicate) {
        this.failGet = predicate;
    }

    void failDeletesMatching(Predicate<String> predicate) {
        this.failDelete = predicate;
    }

    void missingGetsMatching(Predicate<String> predicate) {
        this.missingGet = predicate;
    }

    void setPutBarrier(CyclicBarrier barrier) {
        this.putBarrier = barrier;
    }

    String readUtf8(String key) {
        byte[] value = objects.get(key);
        return value == null ? null : new String(value, StandardCharsets.UTF_8);
    }

    boolean contains(String key) {
        return objects.containsKey(key);
    }

    int maxConcurrentPuts() {
        return maxConcurrentPuts.get();
    }

    List<String> deletedKeys() {
        return new ArrayList<>(deletedKeys);
    }

    List<String> putKeys() {
        return new ArrayList<>(putKeys);
    }
}
