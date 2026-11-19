package br.com.openlabs.telecentro.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import br.com.openlabs.telecentro.exception.RegraDeNegocioException;

class TelecentroTest {

    private static final LocalDate INAUGURACAO = LocalDate.of(2024, 3, 15);

    private Telecentro telecentro(String uf, int computadores) {
        return new Telecentro(null, "Telecentro Jardim Ângela", "Jardim Ângela", "São Paulo", uf, computadores,
                "192.168.10.0/24", INAUGURACAO);
    }

    @Test
    void ufComDuasLetrasMaiusculasEhAceita() {
        assertEquals("SP", telecentro("SP", 20).getUf());
    }

    @Test
    void ufMinusculaOuComTamanhoErradoEhRecusada() {
        assertThrows(RegraDeNegocioException.class, () -> telecentro("sp", 20));
        assertThrows(RegraDeNegocioException.class, () -> telecentro("SPA", 20));
    }

    @Test
    void zeroComputadoresEhAceito() {
        assertEquals(0, telecentro("SP", 0).getNumeroComputadores());
    }

    @Test
    void numeroNegativoDeComputadoresEhRecusado() {
        assertThrows(RegraDeNegocioException.class, () -> telecentro("SP", -1));
    }

    @Test
    void atualizarDadosTrocaOsCampos() {
        Telecentro telecentro = telecentro("SP", 20);

        telecentro.atualizarDados("Telecentro Novo", "Grajaú", "São Paulo", "SP", 25, "192.168.20.0/24", INAUGURACAO);

        assertEquals("Telecentro Novo", telecentro.getNome());
        assertEquals(25, telecentro.getNumeroComputadores());
    }

    @Test
    void atualizacaoRecusadaNaoMudaNenhumCampo() {
        Telecentro telecentro = telecentro("SP", 20);

        assertThrows(RegraDeNegocioException.class, () ->
                telecentro.atualizarDados("Outro Nome", "Grajaú", "São Paulo", "SP", -5, "192.168.20.0/24", INAUGURACAO));

        assertEquals("Telecentro Jardim Ângela", telecentro.getNome());
        assertEquals(20, telecentro.getNumeroComputadores());
    }
}
