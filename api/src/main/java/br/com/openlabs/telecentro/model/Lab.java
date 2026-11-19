package br.com.openlabs.telecentro.model;

import java.util.Objects;

/** Laboratório interativo do catálogo (tabela T_LAB). Só leitura: a API não cria nem altera labs. */
public class Lab extends EntidadeBase {

    private final Long idFase;
    private final String slug;
    private final String nome;
    private final TipoInteracao tipoInteracao;
    private final int minutosEstimados;
    private final boolean disponivel;

    public Lab(Long id, Long idFase, String slug, String nome, TipoInteracao tipoInteracao,
               int minutosEstimados, boolean disponivel) {
        super(id);
        this.idFase = Objects.requireNonNull(idFase, "A fase é obrigatória.");
        this.slug = Objects.requireNonNull(slug, "O slug é obrigatório.");
        this.nome = Objects.requireNonNull(nome, "O nome é obrigatório.");
        this.tipoInteracao = Objects.requireNonNull(tipoInteracao, "O tipo de interação é obrigatório.");
        this.minutosEstimados = minutosEstimados;
        this.disponivel = disponivel;
    }

    public Long getIdFase() {
        return idFase;
    }

    public String getSlug() {
        return slug;
    }

    public String getNome() {
        return nome;
    }

    public TipoInteracao getTipoInteracao() {
        return tipoInteracao;
    }

    public int getMinutosEstimados() {
        return minutosEstimados;
    }

    public boolean isDisponivel() {
        return disponivel;
    }
}
