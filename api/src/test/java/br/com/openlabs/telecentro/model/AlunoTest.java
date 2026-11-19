package br.com.openlabs.telecentro.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import br.com.openlabs.telecentro.exception.RegraDeNegocioException;

class AlunoTest {

    private static final LocalDate NASCIMENTO = LocalDate.of(2008, 3, 15);

    private Aluno alunoInativo() {
        return new Aluno(4L, 1L, "Aluno Inativo", NASCIMENTO, null, LocalDate.of(2026, 2, 1), false);
    }

    @Test
    void cadastroNovoNasceAtivoComDataDeHojeESemId() {
        Aluno aluno = Aluno.cadastrar(1L, "Ana Souza", NASCIMENTO, "ana.souza@example.com");

        assertTrue(aluno.isAtivo());
        assertEquals(LocalDate.now(), aluno.getDataCadastro());
        assertNull(aluno.getId());
    }

    @Test
    void desativarDeixaOAlunoInativo() {
        Aluno aluno = Aluno.cadastrar(1L, "Ana Souza", NASCIMENTO, null);

        aluno.desativar();

        assertFalse(aluno.isAtivo());
    }

    @Test
    void naoDesativaAlunoJaInativo() {
        assertThrows(RegraDeNegocioException.class, () -> alunoInativo().desativar());
    }

    @Test
    void reativarDeixaOAlunoAtivo() {
        Aluno aluno = alunoInativo();

        aluno.reativar();

        assertTrue(aluno.isAtivo());
    }

    @Test
    void naoReativaAlunoJaAtivo() {
        Aluno aluno = Aluno.cadastrar(1L, "Ana Souza", NASCIMENTO, null);

        assertThrows(RegraDeNegocioException.class, aluno::reativar);
    }

    @Test
    void nomeEmBrancoEhRecusado() {
        assertThrows(RegraDeNegocioException.class, () -> Aluno.cadastrar(1L, "   ", NASCIMENTO, null));
    }

    @Test
    void nascimentoNoFuturoEhRecusado() {
        LocalDate amanha = LocalDate.now().plusDays(1);

        assertThrows(RegraDeNegocioException.class, () -> Aluno.cadastrar(1L, "Ana Souza", amanha, null));
    }

    @Test
    void emailEmBrancoViraAlunoSemEmail() {
        Aluno aluno = Aluno.cadastrar(1L, "Ana Souza", NASCIMENTO, "  ");

        assertEquals(Optional.empty(), aluno.getEmail());
    }

    @Test
    void atualizarCadastroValidaOsNovosDados() {
        Aluno aluno = Aluno.cadastrar(1L, "Ana Souza", NASCIMENTO, null);

        aluno.atualizarCadastro(2L, "Ana Souza Lima", NASCIMENTO, "ana.lima@example.com");

        assertEquals(2L, aluno.getIdTelecentro());
        assertEquals("Ana Souza Lima", aluno.getNome());
        assertEquals(Optional.of("ana.lima@example.com"), aluno.getEmail());
    }

    @Test
    void atualizacaoRecusadaNaoMudaNenhumCampo() {
        Aluno aluno = Aluno.cadastrar(1L, "Ana Souza", NASCIMENTO, null);

        assertThrows(RegraDeNegocioException.class, () -> aluno.atualizarCadastro(3L, "", NASCIMENTO, null));

        assertEquals(1L, aluno.getIdTelecentro());
        assertEquals("Ana Souza", aluno.getNome());
    }

    @Test
    void alunosComOMesmoIdSaoIguaisEAlunosSemIdNao() {
        Aluno a = new Aluno(7L, 1L, "Ana", NASCIMENTO, null, LocalDate.of(2026, 2, 1), true);
        Aluno b = new Aluno(7L, 2L, "Outro nome", NASCIMENTO, null, LocalDate.of(2026, 3, 1), false);

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
        assertNotEquals(Aluno.cadastrar(1L, "Ana", NASCIMENTO, null), Aluno.cadastrar(1L, "Ana", NASCIMENTO, null));
    }
}
