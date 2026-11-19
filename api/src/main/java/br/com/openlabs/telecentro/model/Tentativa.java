package br.com.openlabs.telecentro.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Objects;

import br.com.openlabs.telecentro.exception.RegraDeNegocioException;

/**
 * Uma entrega de avaliação feita por um aluno (tabela T_TENTATIVA).
 * Registro imutável: todos os campos são final e não há método que mude o estado.
 */
public class Tentativa extends EntidadeBase {

    private final Long idAluno;
    private final Long idAvaliacao;
    private final LocalDate dataEnvio;
    private final int acertos;
    private final BigDecimal nota;

    /** Reconstrói uma tentativa com todos os dados. O DAO usa este construtor ao ler do banco. */
    public Tentativa(Long id, Long idAluno, Long idAvaliacao, LocalDate dataEnvio, int acertos, BigDecimal nota) {
        super(id);
        this.idAluno = Objects.requireNonNull(idAluno, "O aluno é obrigatório.");
        this.idAvaliacao = Objects.requireNonNull(idAvaliacao, "A avaliação é obrigatória.");
        this.dataEnvio = Objects.requireNonNull(dataEnvio, "A data de envio é obrigatória.");
        this.acertos = acertos;
        this.nota = Objects.requireNonNull(nota, "A nota é obrigatória.");
    }

    /** Registra o envio. A nota é sempre calculada pela avaliação: o cliente nunca manda a nota. */
    public static Tentativa registrar(Aluno aluno, Avaliacao avaliacao, int acertos, LocalDate dataEnvio) {
        Objects.requireNonNull(aluno, "O aluno é obrigatório.");
        Objects.requireNonNull(avaliacao, "A avaliação é obrigatória.");
        if (!aluno.isAtivo()) {
            throw new RegraDeNegocioException("Aluno inativo não pode enviar avaliação.");
        }
        BigDecimal nota = avaliacao.calcularNota(acertos);
        return new Tentativa(null, aluno.getId(), avaliacao.getId(), dataEnvio, acertos, nota);
    }

    public Long getIdAluno() {
        return idAluno;
    }

    public Long getIdAvaliacao() {
        return idAvaliacao;
    }

    public LocalDate getDataEnvio() {
        return dataEnvio;
    }

    public int getAcertos() {
        return acertos;
    }

    public BigDecimal getNota() {
        return nota;
    }
}
