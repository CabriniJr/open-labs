package br.com.openlabs.telecentro.bo;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import br.com.openlabs.telecentro.dao.TentativaDao;
import br.com.openlabs.telecentro.dto.TentativaRequest;
import br.com.openlabs.telecentro.dto.TentativaResponse;
import br.com.openlabs.telecentro.exception.RecursoNaoEncontradoException;
import br.com.openlabs.telecentro.model.Aluno;
import br.com.openlabs.telecentro.model.Avaliacao;
import br.com.openlabs.telecentro.model.Tentativa;

/**
 * Casos de uso da tentativa, que cruzam aluno e avaliação.
 * Este BO devolve o DTO pronto porque "aprovado" depende da Avaliacao, que só ele busca.
 */
@Service
public class TentativaBo {

    private final TentativaDao tentativaDao;
    private final AlunoBo alunoBo;
    private final CatalogoBo catalogoBo;

    public TentativaBo(TentativaDao tentativaDao, AlunoBo alunoBo, CatalogoBo catalogoBo) {
        this.tentativaDao = tentativaDao;
        this.alunoBo = alunoBo;
        this.catalogoBo = catalogoBo;
    }

    /** 404 se o aluno não existir. Cada tentativa sai com "aprovado" calculado pela sua avaliação. */
    public List<TentativaResponse> listarPorAluno(Long idAluno) {
        alunoBo.buscar(idAluno);
        Map<Long, Avaliacao> avaliacoesPorId = catalogoBo.listarAvaliacoes(null).stream()
                .collect(Collectors.toMap(Avaliacao::getId, Function.identity()));
        return tentativaDao.listarPorAluno(idAluno).stream()
                .map(tentativa -> {
                    Avaliacao avaliacao = avaliacoesPorId.get(tentativa.getIdAvaliacao());
                    return TentativaResponse.de(tentativa, avaliacao.aprova(tentativa.getNota()));
                })
                .toList();
    }

    public TentativaResponse registrar(TentativaRequest dados) {
        Aluno aluno = alunoBo.buscar(dados.idAluno());
        Avaliacao avaliacao = catalogoBo.buscarAvaliacao(dados.idAvaliacao());
        Tentativa nova = Tentativa.registrar(aluno, avaliacao, dados.acertos(), LocalDate.now());
        Tentativa gravada = tentativaDao.inserir(nova);
        return TentativaResponse.de(gravada, avaliacao.aprova(gravada.getNota()));
    }

    public void excluir(Long id) {
        tentativaDao.buscarPorId(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Tentativa " + id + " não encontrada."));
        tentativaDao.excluir(id);
    }
}
