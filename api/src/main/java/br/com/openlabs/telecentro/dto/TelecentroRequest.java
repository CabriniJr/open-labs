package br.com.openlabs.telecentro.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Dados que o cliente envia para criar ou atualizar um telecentro. */
public record TelecentroRequest(
        @NotBlank(message = "é obrigatório")
        @Size(max = 80, message = "deve ter no máximo 80 caracteres")
        String nome,

        @NotBlank(message = "é obrigatório")
        @Size(max = 60, message = "deve ter no máximo 60 caracteres")
        String bairro,

        @NotBlank(message = "é obrigatória")
        @Size(max = 60, message = "deve ter no máximo 60 caracteres")
        String cidade,

        @NotBlank(message = "é obrigatória")
        String uf,

        @NotNull(message = "é obrigatório")
        @Max(value = 999, message = "deve ser no máximo 999")
        Integer numeroComputadores,

        @NotBlank(message = "é obrigatória")
        @Size(max = 18, message = "deve ter no máximo 18 caracteres, ex.: 192.168.10.0/24")
        String faixaRede,

        @NotNull(message = "é obrigatória (formato aaaa-mm-dd)")
        LocalDate dataInauguracao) {
}
