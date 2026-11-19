package br.com.openlabs.telecentro.model;

import java.time.LocalDate;
import java.util.Objects;
import java.util.Optional;

import br.com.openlabs.telecentro.exception.RegraDeNegocioException;

/**
 * Pessoa da comunidade cadastrada num telecentro para usar os laboratórios (tabela T_ALUNO).
 * Não há setters: o estado só muda por métodos de negócio que validam as regras.
 */
public class Aluno extends EntidadeBase {

    private Long idTelecentro;
    private String nome;
    private LocalDate dataNascimento;
    private String email;
    private final LocalDate dataCadastro;
    private boolean ativo;

    /** Reconstrói um aluno com todos os dados. O DAO usa este construtor ao ler do banco. */
    public Aluno(Long id, Long idTelecentro, String nome, LocalDate dataNascimento, String email,
                 LocalDate dataCadastro, boolean ativo) {
        super(id);
        this.idTelecentro = Objects.requireNonNull(idTelecentro, "O telecentro é obrigatório.");
        this.nome = validarNome(nome);
        this.dataNascimento = validarNascimento(dataNascimento);
        this.email = normalizarEmail(email);
        this.dataCadastro = Objects.requireNonNull(dataCadastro, "A data de cadastro é obrigatória.");
        this.ativo = ativo;
    }

    /** Cadastro novo: nasce ativo, com a data de hoje e ainda sem id. */
    public static Aluno cadastrar(Long idTelecentro, String nome, LocalDate dataNascimento, String email) {
        return new Aluno(null, idTelecentro, nome, dataNascimento, email, LocalDate.now(), true);
    }

    /** Valida tudo antes de mudar qualquer campo, para o aluno nunca ficar meio atualizado. */
    public void atualizarCadastro(Long idTelecentro, String nome, LocalDate dataNascimento, String email) {
        Objects.requireNonNull(idTelecentro, "O telecentro é obrigatório.");
        String nomeValidado = validarNome(nome);
        LocalDate nascimentoValidado = validarNascimento(dataNascimento);

        this.idTelecentro = idTelecentro;
        this.nome = nomeValidado;
        this.dataNascimento = nascimentoValidado;
        this.email = normalizarEmail(email);
    }

    public void desativar() {
        if (!ativo) {
            throw new RegraDeNegocioException("O aluno já está inativo.");
        }
        ativo = false;
    }

    public void reativar() {
        if (ativo) {
            throw new RegraDeNegocioException("O aluno já está ativo.");
        }
        ativo = true;
    }

    private static String validarNome(String nome) {
        Objects.requireNonNull(nome, "O nome é obrigatório.");
        if (nome.isBlank()) {
            throw new RegraDeNegocioException("O nome do aluno não pode ficar em branco.");
        }
        return nome.trim();
    }

    private static LocalDate validarNascimento(LocalDate dataNascimento) {
        Objects.requireNonNull(dataNascimento, "A data de nascimento é obrigatória.");
        if (dataNascimento.isAfter(LocalDate.now())) {
            throw new RegraDeNegocioException("A data de nascimento não pode estar no futuro.");
        }
        return dataNascimento;
    }

    /** O Oracle grava texto vazio como NULL; por isso e-mail em branco vira "sem e-mail". */
    private static String normalizarEmail(String email) {
        return (email == null || email.isBlank()) ? null : email.trim();
    }

    public Long getIdTelecentro() {
        return idTelecentro;
    }

    public String getNome() {
        return nome;
    }

    public LocalDate getDataNascimento() {
        return dataNascimento;
    }

    /** O e-mail é opcional: nem todo aluno tem um. */
    public Optional<String> getEmail() {
        return Optional.ofNullable(email);
    }

    public LocalDate getDataCadastro() {
        return dataCadastro;
    }

    public boolean isAtivo() {
        return ativo;
    }
}
