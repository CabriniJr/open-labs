package br.com.openlabs.telecentro.dto;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Indicador de impacto de um telecentro (o da Ficha da CitizenTech).
 * avaliacoesPorMes: "2026-08" -> quantidade de avaliações enviadas no mês.
 * mediaNotas: null quando o telecentro ainda não tem nenhuma avaliação enviada.
 */
public record IndicadorResponse(
        Long idTelecentro,
        String telecentro,
        long alunosAtivos,
        Map<String, Long> avaliacoesPorMes,
        long labsConcluidos,
        BigDecimal mediaNotas) {
}
