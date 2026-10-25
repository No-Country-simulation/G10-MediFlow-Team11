package com.mediflow.backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "mediflow.oci")
public class OciProperties {
    private String bucketName;
    private String namespace;
    private String region;
    private String authMode; // "instance_principal" (VM/OCI) o "config_file" (tu laptop)
}