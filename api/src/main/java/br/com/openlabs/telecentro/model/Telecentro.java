package br.com.openlabs.telecentro.model;

import java.time.LocalDate;
import java.util.Objects;

import br.com.openlabs.telecentro.exception.RegraDeNegocioException;

/** Espaço comunitário e gratuito onde o OpenLabs roda, com computadores e Wi-Fi público (tabela T_TELECENTRO). */
public class Telecentro extends EntidadeBase {

    private String nome;
    private String bairro;
    private String cidade;
    private String uf;
    private int numeroComputadores;
    private String faixaRede;
    private LocalDate dataInauguracao;

    public Telecentro(Long id, String nome, String bairro, String cidade, String uf, int numeroComputadores,
                      String faixaRede, LocalDate dataInauguracao) {
        super(id);
        validar(nome, bairro, cidade, uf, numeroComputadores, faixaRede, dataInauguracao);
        this.nome = nome;
        this.bairro = bairro;
        this.cidade = cidade;
        this.uf = uf;
        this.numeroComputadores = numeroComputadores;
        this.faixaRede = faixaRede;
        this.dataInauguracao = dataInauguracao;
    }

    /** Valida tudo antes de mudar qualquer campo, para o telecentro nunca ficar meio atualizado. */
    public void atualizarDados(String nome, String bairro, String cidade, String uf, int numeroComputadores,
                               String faixaRede, LocalDate dataInauguracao) {
        validar(nome, bairro, cidade, uf, numeroComputadores, faixaRede, dataInauguracao);
        this.nome = nome;
        this.bairro = bairro;
        this.cidade = cidade;
        this.uf = uf;
        this.numeroComputadores = numeroComputadores;
        this.faixaRede = faixaRede;
        this.dataInauguracao = dataInauguracao;
    }

    private static void validar(String nome, String bairro, String cidade, String uf, int numeroComputadores,
                                String faixaRede, LocalDate dataInauguracao) {
        Objects.requireNonNull(nome, "O nome é obrigatório.");
        Objects.requireNonNull(bairro, "O bairro é obrigatório.");
        Objects.requireNonNull(cidade, "A cidade é obrigatória.");
        Objects.requireNonNull(uf, "A UF é obrigatória.");
        Objects.requireNonNull(faixaRede, "A faixa de rede é obrigatória.");
        Objects.requireNonNull(dataInauguracao, "A data de inauguração é obrigatória.");
        if (!uf.matches("[A-Z]{2}")) {
            throw new RegraDeNegocioException("A UF deve ter 2 letras maiúsculas, ex.: SP.");
        }
        if (numeroComputadores < 0) {
            throw new RegraDeNegocioException("O número de computadores não pode ser negativo.");
        }
    }

    public String getNome() {
        return nome;
    }

    public String getBairro() {
        return bairro;
    }

    public String getCidade() {
        return cidade;
    }

    public String getUf() {
        return uf;
    }

    public int getNumeroComputadores() {
        return numeroComputadores;
    }

    public String getFaixaRede() {
        return faixaRede;
    }

    public LocalDate getDataInauguracao() {
        return dataInauguracao;
    }
}
