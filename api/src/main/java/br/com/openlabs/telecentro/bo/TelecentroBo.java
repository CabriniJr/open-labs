package br.com.openlabs.telecentro.bo;

import java.util.List;

import org.springframework.stereotype.Service;

import br.com.openlabs.telecentro.dao.TelecentroDao;
import br.com.openlabs.telecentro.dto.TelecentroRequest;
import br.com.openlabs.telecentro.exception.RecursoNaoEncontradoException;
import br.com.openlabs.telecentro.model.Telecentro;

/** Casos de uso do telecentro. As regras de UF e de computadores ficam na entidade Telecentro. */
@Service
public class TelecentroBo {

    private final TelecentroDao telecentroDao;

    public TelecentroBo(TelecentroDao telecentroDao) {
        this.telecentroDao = telecentroDao;
    }

    public List<Telecentro> listar() {
        return telecentroDao.listar();
    }

    public Telecentro buscar(Long id) {
        return telecentroDao.buscarPorId(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Telecentro " + id + " não encontrado."));
    }

    /** Se a faixa de rede já for de outro telecentro, o Oracle recusa (UNIQUE, ORA-00001) e o tratador devolve 409. */
    public Telecentro cadastrar(TelecentroRequest dados) {
        Telecentro novo = new Telecentro(null, dados.nome(), dados.bairro(), dados.cidade(), dados.uf(),
                dados.numeroComputadores(), dados.faixaRede(), dados.dataInauguracao());
        return telecentroDao.inserir(novo);
    }

    public Telecentro atualizar(Long id, TelecentroRequest dados) {
        Telecentro telecentro = buscar(id);
        telecentro.atualizarDados(dados.nome(), dados.bairro(), dados.cidade(), dados.uf(),
                dados.numeroComputadores(), dados.faixaRede(), dados.dataInauguracao());
        telecentroDao.atualizar(telecentro);
        return telecentro;
    }

    /** Se o telecentro tiver alunos (ou monitores e computadores), o Oracle recusa (ORA-02292) e o tratador devolve 409. */
    public void excluir(Long id) {
        buscar(id);
        telecentroDao.excluir(id);
    }
}
