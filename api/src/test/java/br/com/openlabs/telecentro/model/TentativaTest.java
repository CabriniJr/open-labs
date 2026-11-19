package br.com.openlabs.telecentro.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import br.com.openlabs.telecentro.exception.RegraDeNegocioException;

class TentativaTest {

    private static final LocalDate ENVIO = LocalDate.of(2026, 11, 10);

    private final Aluno alunoAtivo = new Aluno(3L, 1L, "Camila", LocalDate.of(2009, 6, 1), null, LocalDate.of(2026, 8, 3), true);
    private final Aluno alunoInativo = new Aluno(4L, 1L, "Diego", LocalDate.of(2007, 1, 9), null, LocalDate.of(2026, 8, 3), false);
    private final Avaliacao tresQuestoes = new Avaliacao(5L, 7L, "Checkpoint: ciclo de vida do Pod", 3, 60);

    @Test
    void registrarCalculaANotaPelaAvaliacao() {
        Tentativa tentativa = Tentativa.registrar(alunoAtivo, tresQuestoes, 2, ENVIO);

        assertEquals(new BigDecimal("6.67"), tentativa.getNota());
        assertEquals(2, tentativa.getAcertos());
        assertEquals(3L, tentativa.getIdAluno());
        assertEquals(5L, tentativa.getIdAvaliacao());
    }

    @Test
    void alunoInativoNaoEnviaAvaliacao() {
        assertThrows(RegraDeNegocioException.class, () -> Tentativa.registrar(alunoInativo, tresQuestoes, 2, ENVIO));
    }

    @Test
    void acertosAcimaDoNumeroDeQuestoesSaoRecusados() {
        assertThrows(RegraDeNegocioException.class, () -> Tentativa.registrar(alunoAtivo, tresQuestoes, 4, ENVIO));
    }
}
