package br.com.openlabs.telecentro.model;

import java.time.LocalDate;
import java.util.Objects;
import java.util.Optional;

import br.com.openlabs.telecentro.exception.RegraDeNegocioException;

/** O andamento de um aluno num lab (tabela T_PROGRESSO). */
public class Progresso extends EntidadeBase {

    private final Long idAluno;
    private final Long idLab;
    private final LocalDate dataInicio;
    private LocalDate dataConclusao;

    /** Reconstrói um progresso com todos os dados. O DAO usa este construtor ao ler do banco. */
    public Progresso(Long id, Long idAluno, Long idLab, LocalDate dataInicio, LocalDate dataConclusao) {
        super(id);
        this.idAluno = Objects.requireNonNull(idAluno, "O aluno é obrigatório.");
        this.idLab = Objects.requireNonNull(idLab, "O lab é obrigatório.");
        this.dataInicio = Objects.requireNonNull(dataInicio, "A data de início é obrigatória.");
        if (dataConclusao != null && dataConclusao.isBefore(dataInicio)) {
            throw new RegraDeNegocioException("A conclusão não pode ser antes do início.");
        }
        this.dataConclusao = dataConclusao;
    }

    /** Começa um lab: só aluno ativo, e só em lab disponível. */
    public static Progresso iniciar(Aluno aluno, Lab lab, LocalDate dataInicio) {
        Objects.requireNonNull(aluno, "O aluno é obrigatório.");
        Objects.requireNonNull(lab, "O lab é obrigatório.");
        if (!aluno.isAtivo()) {
            throw new RegraDeNegocioException("Aluno inativo não pode começar um lab.");
        }
        if (!lab.isDisponivel()) {
            throw new RegraDeNegocioException("O lab '" + lab.getNome() + "' ainda não está disponível.");
        }
        return new Progresso(null, aluno.getId(), lab.getId(), dataInicio, null);
    }

    public void concluir(LocalDate data) {
        Objects.requireNonNull(data, "A data de conclusão é obrigatória.");
        if (isConcluido()) {
            throw new RegraDeNegocioException("Este lab já foi concluído.");
        }
        if (data.isBefore(dataInicio)) {
            throw new RegraDeNegocioException("A conclusão não pode ser antes do início.");
        }
        this.dataConclusao = data;
    }

    public boolean isConcluido() {
        return dataConclusao != null;
    }

    public Long getIdAluno() {
        return idAluno;
    }

    public Long getIdLab() {
        return idLab;
    }

    public LocalDate getDataInicio() {
        return dataInicio;
    }

    /** Vazio enquanto o lab está em andamento. */
    public Optional<LocalDate> getDataConclusao() {
        return Optional.ofNullable(dataConclusao);
    }
}
