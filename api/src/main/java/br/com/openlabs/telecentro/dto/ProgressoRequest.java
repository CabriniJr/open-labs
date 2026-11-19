package br.com.openlabs.telecentro.dto;

import jakarta.validation.constraints.NotNull;

/** Pedido para um aluno começar um lab. A data de início é sempre a de hoje. */
public record ProgressoRequest(
        @NotNull(message = "é obrigatório")
        Long idAluno,

        @NotNull(message = "é obrigatório")
        Long idLab) {
}
