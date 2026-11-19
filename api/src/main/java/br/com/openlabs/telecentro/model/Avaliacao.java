package br.com.openlabs.telecentro.model;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

import br.com.openlabs.telecentro.exception.RegraDeNegocioException;

/** Questionário de fim de lab (tabela T_AVALIACAO). Só leitura; sabe calcular a nota e dizer se ela aprova. */
public class Avaliacao extends EntidadeBase {

    private final Long idLab;
    private final String nome;
    private final int numeroQuestoes;
    private final int percentualAprovacao;

    public Avaliacao(Long id, Long idLab, String nome, int numeroQuestoes, int percentualAprovacao) {
        super(id);
        this.idLab = Objects.requireNonNull(idLab, "O lab é obrigatório.");
        this.nome = Objects.requireNonNull(nome, "O nome é obrigatório.");
        if (numeroQuestoes <= 0) {
            throw new RegraDeNegocioException("A avaliação precisa ter pelo menos uma questão.");
        }
        this.numeroQuestoes = numeroQuestoes;
        this.percentualAprovacao = percentualAprovacao;
    }

    /**
     * Nota de 0 a 10: acertos ÷ questões × 10, com 2 casas e arredondamento HALF_UP.
     * Multiplica antes de dividir para não arredondar duas vezes (2 de 3 = 6.67).
     */
    public BigDecimal calcularNota(int acertos) {
        if (acertos < 0 || acertos > numeroQuestoes) {
            throw new RegraDeNegocioException("Os acertos devem ficar entre 0 e " + numeroQuestoes + ".");
        }
        return BigDecimal.valueOf(acertos)
                .multiply(BigDecimal.TEN)
                .divide(BigDecimal.valueOf(numeroQuestoes), 2, RoundingMode.HALF_UP);
    }

    /** Aprova quando a nota, em percentual (nota × 10), alcança o percentual mínimo. */
    public boolean aprova(BigDecimal nota) {
        Objects.requireNonNull(nota, "A nota é obrigatória.");
        return nota.multiply(BigDecimal.TEN).compareTo(BigDecimal.valueOf(percentualAprovacao)) >= 0;
    }

    public Long getIdLab() {
        return idLab;
    }

    public String getNome() {
        return nome;
    }

    public int getNumeroQuestoes() {
        return numeroQuestoes;
    }

    public int getPercentualAprovacao() {
        return percentualAprovacao;
    }
}
