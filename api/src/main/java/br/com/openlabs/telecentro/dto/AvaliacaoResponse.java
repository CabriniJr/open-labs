package br.com.openlabs.telecentro.dto;

import br.com.openlabs.telecentro.model.Avaliacao;

/** Avaliação como sai no JSON. */
public record AvaliacaoResponse(
        Long id,
        Long idLab,
        String nome,
        int numeroQuestoes,
        int percentualAprovacao) {

    public static AvaliacaoResponse de(Avaliacao avaliacao) {
        return new AvaliacaoResponse(avaliacao.getId(), avaliacao.getIdLab(), avaliacao.getNome(),
                avaliacao.getNumeroQuestoes(), avaliacao.getPercentualAprovacao());
    }
}
