package br.com.openlabs.telecentro.bo;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import br.com.openlabs.telecentro.dao.AlunoDao;
import br.com.openlabs.telecentro.dao.ProgressoDao;
import br.com.openlabs.telecentro.dao.TentativaDao;
import br.com.openlabs.telecentro.dto.IndicadorResponse;
import br.com.openlabs.telecentro.model.Aluno;
import br.com.openlabs.telecentro.model.Progresso;
import br.com.openlabs.telecentro.model.Telecentro;
import br.com.openlabs.telecentro.model.Tentativa;

/**
 * Indicador de impacto da Ficha: alunos ativos por telecentro e avaliações concluídas por mês,
 * mais labs concluídos e média das notas.
 */
@Service
public class IndicadorBo {

    private final TelecentroBo telecentroBo;
    private final AlunoDao alunoDao;
    private final ProgressoDao progressoDao;
    private final TentativaDao tentativaDao;

    public IndicadorBo(TelecentroBo telecentroBo, AlunoDao alunoDao, ProgressoDao progressoDao,
                       TentativaDao tentativaDao) {
        this.telecentroBo = telecentroBo;
        this.alunoDao = alunoDao;
        this.progressoDao = progressoDao;
        this.tentativaDao = tentativaDao;
    }

    public IndicadorResponse calcular(Long idTelecentro) {
        Telecentro telecentro = telecentroBo.buscar(idTelecentro);

        long alunosAtivos = alunoDao.listarPorTelecentro(idTelecentro).stream()
                .filter(Aluno::isAtivo)
                .count();

        List<Tentativa> tentativas = tentativaDao.listarPorTelecentro(idTelecentro);

        // TreeMap deixa os meses em ordem: 2026-06, 2026-07, 2026-08...
        Map<String, Long> avaliacoesPorMes = tentativas.stream()
                .collect(Collectors.groupingBy(
                        tentativa -> YearMonth.from(tentativa.getDataEnvio()).toString(),
                        TreeMap::new,
                        Collectors.counting()));

        long labsConcluidos = progressoDao.listarPorTelecentro(idTelecentro).stream()
                .filter(Progresso::isConcluido)
                .count();

        return new IndicadorResponse(telecentro.getId(), telecentro.getNome(), alunosAtivos,
                avaliacoesPorMes, labsConcluidos, media(tentativas));
    }

    /** Média das notas com 2 casas; null quando não há nenhuma tentativa. */
    private BigDecimal media(List<Tentativa> tentativas) {
        if (tentativas.isEmpty()) {
            return null;
        }
        BigDecimal soma = tentativas.stream()
                .map(Tentativa::getNota)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return soma.divide(BigDecimal.valueOf(tentativas.size()), 2, RoundingMode.HALF_UP);
    }
}
