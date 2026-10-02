package com.mediflow.backend.config;

import com.oracle.bmc.ConfigFileReader;
import com.oracle.bmc.auth.BasicAuthenticationDetailsProvider;
import com.oracle.bmc.auth.ConfigFileAuthenticationDetailsProvider;
import com.oracle.bmc.auth.InstancePrincipalsAuthenticationDetailsProvider;
import com.oracle.bmc.objectstorage.ObjectStorageClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ObjectStorageConfig {

    @Bean
    public BasicAuthenticationDetailsProvider authenticationDetailsProvider(OciProperties properties) throws Exception {
        if ("config_file".equals(properties.getAuthMode())) {
            // Solo para tu máquina: usa ~/.oci/config, nunca credenciales en el repo
            ConfigFileReader.ConfigFile configFile = ConfigFileReader.parseDefault();
            return new ConfigFileAuthenticationDetailsProvider(configFile);
        }
        // En MediFlow_Core_VM: InstancePrincipals, sin ninguna clave
        return InstancePrincipalsAuthenticationDetailsProvider.builder().build();
    }

    @Bean
    public ObjectStorageClient objectStorageClient(BasicAuthenticationDetailsProvider provider) {
        return ObjectStorageClient.builder().build(provider);
    }
}