package br.com.openlabs.telecentro.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import br.com.openlabs.telecentro.exception.RegraDeNegocioException;

class AvaliacaoTest {

    /** Como a avaliação 1 do 02-dml.sql: 5 questões, aprova com 70%. */
    private final Avaliacao cincoQuestoes = new Avaliacao(1L, 1L, "Checkpoint: a rede do telecentro", 5, 70);

    /** Como a avaliação 5 do 02-dml.sql: 3 questões, aprova com 60%. */
    private final Avaliacao tresQuestoes = new Avaliacao(5L, 7L, "Checkpoint: ciclo de vida do Pod", 3, 60);

    @Test
    void notaEhAcertosSobreQuestoesVezesDez() {
        assertEquals(new BigDecimal("8.00"), cincoQuestoes.calcularNota(4));
        assertEquals(new BigDecimal("10.00"), cincoQuestoes.calcularNota(5));
        assertEquals(new BigDecimal("0.00"), cincoQuestoes.calcularNota(0));
    }

    @Test
    void notaTemDuasCasasComArredondamentoHalfUp() {
        assertEquals(new BigDecimal("6.67"), tresQuestoes.calcularNota(2));
        assertEquals(new BigDecimal("3.33"), tresQuestoes.calcularNota(1));
    }

    @Test
    void acertosForaDoIntervaloSaoRecusados() {
        assertThrows(RegraDeNegocioException.class, () -> cincoQuestoes.calcularNota(-1));
        assertThrows(RegraDeNegocioException.class, () -> cincoQuestoes.calcularNota(6));
    }

    @Test
    void aprovaQuandoANotaAlcancaOPercentualMinimo() {
        assertTrue(cincoQuestoes.aprova(new BigDecimal("7.00")));
        assertTrue(cincoQuestoes.aprova(new BigDecimal("8.00")));
        assertFalse(cincoQuestoes.aprova(new BigDecimal("6.99")));
    }

    @Test
    void avaliacaoSemQuestoesEhRecusada() {
        assertThrows(RegraDeNegocioException.class, () -> new Avaliacao(9L, 1L, "Vazia", 0, 70));
    }
}
