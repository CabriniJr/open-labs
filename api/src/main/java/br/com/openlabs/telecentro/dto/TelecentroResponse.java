package br.com.openlabs.telecentro.dto;

import java.time.LocalDate;

import br.com.openlabs.telecentro.model.Telecentro;

/** Telecentro como sai no JSON. */
public record TelecentroResponse(
        Long id,
        String nome,
        String bairro,
        String cidade,
        String uf,
        int numeroComputadores,
        String faixaRede,
        LocalDate dataInauguracao) {

    public static TelecentroResponse de(Telecentro telecentro) {
        return new TelecentroResponse(telecentro.getId(), telecentro.getNome(), telecentro.getBairro(),
                telecentro.getCidade(), telecentro.getUf(), telecentro.getNumeroComputadores(),
                telecentro.getFaixaRede(), telecentro.getDataInauguracao());
    }
}
