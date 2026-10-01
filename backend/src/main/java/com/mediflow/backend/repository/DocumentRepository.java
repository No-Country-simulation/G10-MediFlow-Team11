package com.mediflow.backend.repository;

import com.mediflow.backend.entity.DocumentRecord;
import com.mediflow.backend.enums.DocumentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentRepository extends JpaRepository<DocumentRecord, String> {

    List<DocumentRecord> findByStatusOrderByCreatedAtAscIdAsc(DocumentStatus status);
}
