package br.com.openlabs.telecentro;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;

/** Título e descrição que aparecem no topo do Swagger UI. */
@OpenAPIDefinition(info = @Info(
        title = "OpenLabs no Telecentro — API",
        version = "1.0",
        description = "Telecentros, alunos, labs, progresso e avaliações do OpenLabs. "
                + "Global Solution 2026.2 (FIAP) — Domain Driven Design – Java."))
@SpringBootApplication
public class OpenLabsTelecentroApplication {

    public static void main(String[] args) {
        SpringApplication.run(OpenLabsTelecentroApplication.class, args);
    }
}
