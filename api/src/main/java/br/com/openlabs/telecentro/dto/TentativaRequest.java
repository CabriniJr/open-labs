package br.com.openlabs.telecentro.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Envio de uma avaliação. O cliente manda só os acertos: a nota é calculada pela API.
 * O limite superior dos acertos (o número de questões) é regra do domínio, em Avaliacao.calcularNota.
 */
public record TentativaRequest(
        @NotNull(message = "é obrigatório")
        Long idAluno,

        @NotNull(message = "é obrigatório")
        Long idAvaliacao,

        @NotNull(message = "é obrigatório")
        @Min(value = 0, message = "não pode ser negativo")
        Integer acertos) {
}
