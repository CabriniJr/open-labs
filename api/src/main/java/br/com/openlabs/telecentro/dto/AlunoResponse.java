package br.com.openlabs.telecentro.dto;

import java.time.LocalDate;

import br.com.openlabs.telecentro.model.Aluno;

/** Aluno como sai no JSON. A entidade Aluno nunca sai da API: o controller converte com AlunoResponse.de(). */
public record AlunoResponse(
        Long id,
        Long idTelecentro,
        String nome,
        LocalDate dataNascimento,
        String email,
        LocalDate dataCadastro,
        boolean ativo) {

    public static AlunoResponse de(Aluno aluno) {
        return new AlunoResponse(aluno.getId(), aluno.getIdTelecentro(), aluno.getNome(),
                aluno.getDataNascimento(), aluno.getEmail().orElse(null),
                aluno.getDataCadastro(), aluno.isAtivo());
    }
}
