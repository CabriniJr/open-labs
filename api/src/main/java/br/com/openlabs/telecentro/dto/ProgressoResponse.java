package br.com.openlabs.telecentro.dto;

import java.time.LocalDate;

import br.com.openlabs.telecentro.model.Progresso;

/** Progresso como sai no JSON. dataConclusao é null enquanto o lab está em andamento. */
public record ProgressoResponse(
        Long id,
        Long idAluno,
        Long idLab,
        LocalDate dataInicio,
        LocalDate dataConclusao,
        boolean concluido) {

    public static ProgressoResponse de(Progresso progresso) {
        return new ProgressoResponse(progresso.getId(), progresso.getIdAluno(), progresso.getIdLab(),
                progresso.getDataInicio(), progresso.getDataConclusao().orElse(null), progresso.isConcluido());
    }
}
