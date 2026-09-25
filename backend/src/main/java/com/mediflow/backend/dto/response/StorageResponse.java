package com.mediflow.backend.dto.response;

import com.mediflow.backend.enums.StorageState;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class StorageResponse {
    private String provider = "OCI_OBJECT_STORAGE";
    private StorageState state;
}
