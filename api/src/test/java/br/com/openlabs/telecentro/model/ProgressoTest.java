package br.com.openlabs.telecentro.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import br.com.openlabs.telecentro.exception.RegraDeNegocioException;

class ProgressoTest {

    private static final LocalDate INICIO = LocalDate.of(2026, 11, 10);

    private final Aluno alunoAtivo = new Aluno(1L, 1L, "Ana", LocalDate.of(2008, 4, 12), null, LocalDate.of(2026, 8, 3), true);
    private final Aluno alunoInativo = new Aluno(4L, 1L, "Diego", LocalDate.of(2007, 1, 9), null, LocalDate.of(2026, 8, 3), false);
    private final Lab labDisponivel = new Lab(1L, 1L, "telecentro-network", "Rede do telecentro", TipoInteracao.FILME, 30, true);
    private final Lab labIndisponivel = new Lab(2L, 1L, "subnetting-by-need", "Subnetting", TipoInteracao.DIRETO, 20, false);

    @Test
    void alunoAtivoIniciaLabDisponivelSemConclusao() {
        Progresso progresso = Progresso.iniciar(alunoAtivo, labDisponivel, INICIO);

        assertEquals(1L, progresso.getIdAluno());
        assertEquals(1L, progresso.getIdLab());
        assertFalse(progresso.isConcluido());
        assertEquals(Optional.empty(), progresso.getDataConclusao());
    }

    @Test
    void alunoInativoNaoComecaLab() {
        assertThrows(RegraDeNegocioException.class, () -> Progresso.iniciar(alunoInativo, labDisponivel, INICIO));
    }

    @Test
    void labIndisponivelNaoPodeSerIniciado() {
        assertThrows(RegraDeNegocioException.class, () -> Progresso.iniciar(alunoAtivo, labIndisponivel, INICIO));
    }

    @Test
    void concluirGuardaAData() {
        Progresso progresso = Progresso.iniciar(alunoAtivo, labDisponivel, INICIO);

        progresso.concluir(INICIO.plusDays(2));

        assertTrue(progresso.isConcluido());
        assertEquals(Optional.of(INICIO.plusDays(2)), progresso.getDataConclusao());
    }

    @Test
    void naoConcluiDuasVezes() {
        Progresso progresso = Progresso.iniciar(alunoAtivo, labDisponivel, INICIO);
        progresso.concluir(INICIO);

        assertThrows(RegraDeNegocioException.class, () -> progresso.concluir(INICIO.plusDays(1)));
    }

    @Test
    void conclusaoNaoPodeSerAntesDoInicio() {
        Progresso progresso = Progresso.iniciar(alunoAtivo, labDisponivel, INICIO);

        assertThrows(RegraDeNegocioException.class, () -> progresso.concluir(INICIO.minusDays(1)));
        assertFalse(progresso.isConcluido());
    }
}
