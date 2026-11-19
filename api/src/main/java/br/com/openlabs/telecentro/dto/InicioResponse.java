package br.com.openlabs.telecentro.dto;

/** Resposta do GET /: mostra que a API está no ar e onde fica o Swagger. */
public record InicioResponse(String servico, String status, String swagger) {
}
