package com.mediflow.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.Objects;

@Service
@Profile("local-demo")
public class LocalFileObjectStorageService extends ObjectStorageService {
    private final Path root;

    public LocalFileObjectStorageService(@Value("${mediflow.local-demo.storage-root}") String storageRoot) {
        super(null, null);
        Path configured = Path.of(storageRoot);
        if (!configured.isAbsolute() || configured.getNameCount() < 2) {
            throw new IllegalArgumentException("local-demo requires a dedicated absolute storage directory");
        }
        root = configured.normalize();
        try {
            Files.createDirectories(root);
            if (Files.isSymbolicLink(root)) {
                throw new IllegalArgumentException("local-demo storage directory cannot be a symbolic link");
            }
        } catch (IOException exception) {
            throw new StorageOperationException("Cannot initialize local-demo storage", exception);
        }
    }

    @Override
    public void putRawBytes(String objectKey, byte[] content, String contentType) {
        validateContent(content, contentType);
        Path target = resolve(objectKey, true);
        Path temporary = null;
        try {
            temporary = Files.createTempFile(target.getParent(), ".mediflow-", ".tmp");
            Files.write(temporary, content);
            try {
                Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (java.nio.file.AtomicMoveNotSupportedException exception) {
                Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            throw new StorageOperationException("Cannot write local-demo object", exception);
        } finally {
            if (temporary != null) {
                try { Files.deleteIfExists(temporary); } catch (IOException ignored) { /* best effort */ }
            }
        }
    }

    @Override
    public void putRawBytesIfAbsent(String objectKey, byte[] content, String contentType) {
        validateContent(content, contentType);
        Path target = resolve(objectKey, true);
        try (var output = Files.newOutputStream(target, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
            output.write(content);
        } catch (FileAlreadyExistsException exception) {
            throw new ObjectAlreadyExistsException("Local-demo object already exists", exception);
        } catch (IOException exception) {
            try { Files.deleteIfExists(target); } catch (IOException ignored) { /* best effort */ }
            throw new StorageOperationException("Cannot write local-demo object", exception);
        }
    }

    @Override
    public void putJson(String objectKey, String json) {
        Objects.requireNonNull(json, "JSON is required");
        putRawBytes(objectKey, json.getBytes(java.nio.charset.StandardCharsets.UTF_8), "application/json");
    }

    @Override
    public byte[] getObject(String objectKey) {
        Path target = resolve(objectKey, false);
        try {
            return Files.readAllBytes(target);
        } catch (NoSuchFileException exception) {
            throw new ObjectNotFoundException("Local-demo object not found", exception);
        } catch (IOException exception) {
            throw new StorageOperationException("Cannot read local-demo object", exception);
        }
    }

    @Override
    public void deleteObject(String objectKey) {
        Path target = resolve(objectKey, false);
        try {
            Files.deleteIfExists(target);
        } catch (IOException exception) {
            throw new StorageOperationException("Cannot delete local-demo object", exception);
        }
    }

    @Override
    public void copyWithinBucket(String sourceKey, String destinationKey) {
        putRawBytes(destinationKey, getObject(sourceKey), "application/octet-stream");
    }

    private void validateContent(byte[] content, String contentType) {
        Objects.requireNonNull(content, "Content is required");
        if (contentType == null || contentType.isBlank()) {
            throw new IllegalArgumentException("Content-Type is required");
        }
    }

    private Path resolve(String objectKey, boolean createParent) {
        if (objectKey == null || objectKey.isBlank()) {
            throw new StorageOperationException("Invalid local-demo object key", new IllegalArgumentException("empty key"));
        }
        String[] segments = objectKey.split("/", -1);
        for (String segment : segments) {
            if (segment.isEmpty() || segment.equals(".") || segment.equals("..")
                    || !segment.matches("[A-Za-z0-9_%.-]+")) {
                throw new StorageOperationException("Invalid local-demo object key", new IllegalArgumentException(objectKey));
            }
        }
        Path target = root.resolve(String.join("/", segments)).normalize();
        if (!target.startsWith(root) || target.equals(root)) {
            throw new StorageOperationException("Object key escapes local-demo storage", new IllegalArgumentException(objectKey));
        }
        try {
            if (createParent) Files.createDirectories(target.getParent());
            for (Path path = target.getParent(); path != null && path.startsWith(root); path = path.getParent()) {
                if (Files.isSymbolicLink(path)) {
                    throw new StorageOperationException("Symbolic links are not allowed in local-demo storage",
                            new IllegalArgumentException(path.toString()));
                }
            }
            if (Files.isSymbolicLink(target)) {
                throw new StorageOperationException("Symbolic links are not allowed in local-demo storage",
                        new IllegalArgumentException(target.toString()));
            }
        } catch (IOException exception) {
            throw new StorageOperationException("Cannot access local-demo storage path", exception);
        }
        return target;
    }
}
