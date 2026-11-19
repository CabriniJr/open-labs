package br.com.openlabs.telecentro.bo;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;

import br.com.openlabs.telecentro.dao.ProgressoDao;
import br.com.openlabs.telecentro.dto.ProgressoRequest;
import br.com.openlabs.telecentro.exception.RecursoNaoEncontradoException;
import br.com.openlabs.telecentro.model.Aluno;
import br.com.openlabs.telecentro.model.Lab;
import br.com.openlabs.telecentro.model.Progresso;

/**
 * Casos de uso do progresso, que cruzam aluno e lab: o BO busca os dois
 * e a entidade Progresso decide se o lab pode ser iniciado ou concluído.
 */
@Service
public class ProgressoBo {

    private final ProgressoDao progressoDao;
    private final AlunoBo alunoBo;
    private final CatalogoBo catalogoBo;

    public ProgressoBo(ProgressoDao progressoDao, AlunoBo alunoBo, CatalogoBo catalogoBo) {
        this.progressoDao = progressoDao;
        this.alunoBo = alunoBo;
        this.catalogoBo = catalogoBo;
    }

    /** 404 se o aluno não existir; lista vazia se ele ainda não começou nenhum lab. */
    public List<Progresso> listarPorAluno(Long idAluno) {
        alunoBo.buscar(idAluno);
        return progressoDao.listarPorAluno(idAluno);
    }

    public Progresso buscar(Long id) {
        return progressoDao.buscarPorId(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Progresso " + id + " não encontrado."));
    }

    /** Se o aluno já começou esse lab, o Oracle recusa (UNIQUE aluno+lab, ORA-00001) e o tratador devolve 409. */
    public Progresso iniciar(ProgressoRequest dados) {
        Aluno aluno = alunoBo.buscar(dados.idAluno());
        Lab lab = catalogoBo.buscarLab(dados.idLab());
        Progresso novo = Progresso.iniciar(aluno, lab, LocalDate.now());
        return progressoDao.inserir(novo);
    }

    public Progresso concluir(Long id) {
        Progresso progresso = buscar(id);
        progresso.concluir(LocalDate.now());
        progressoDao.atualizar(progresso);
        return progresso;
    }

    public void excluir(Long id) {
        buscar(id);
        progressoDao.excluir(id);
    }
}
