package br.com.openlabs.telecentro.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import br.com.openlabs.telecentro.model.Tentativa;

/** Tentativa como sai no JSON, com a nota calculada e se ela aprova na avaliação. */
public record TentativaResponse(
        Long id,
        Long idAluno,
        Long idAvaliacao,
        LocalDate dataEnvio,
        int acertos,
        BigDecimal nota,
        boolean aprovado) {

    /** "aprovado" vem de fora porque depende da Avaliacao (percentual mínimo), que o BO busca. */
    public static TentativaResponse de(Tentativa tentativa, boolean aprovado) {
        return new TentativaResponse(tentativa.getId(), tentativa.getIdAluno(), tentativa.getIdAvaliacao(),
                tentativa.getDataEnvio(), tentativa.getAcertos(), tentativa.getNota(), aprovado);
    }
}
