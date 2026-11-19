package br.com.openlabs.telecentro.dto;

import br.com.openlabs.telecentro.model.Lab;
import br.com.openlabs.telecentro.model.TipoInteracao;

/** Lab do catálogo como sai no JSON. */
public record LabResponse(
        Long id,
        Long idFase,
        String slug,
        String nome,
        TipoInteracao tipoInteracao,
        int minutosEstimados,
        boolean disponivel) {

    public static LabResponse de(Lab lab) {
        return new LabResponse(lab.getId(), lab.getIdFase(), lab.getSlug(), lab.getNome(),
                lab.getTipoInteracao(), lab.getMinutosEstimados(), lab.isDisponivel());
    }
}
