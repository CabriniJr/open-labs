package br.com.openlabs.telecentro.bo;

import java.util.List;

import org.springframework.stereotype.Service;

import br.com.openlabs.telecentro.dao.AvaliacaoDao;
import br.com.openlabs.telecentro.dao.LabDao;
import br.com.openlabs.telecentro.exception.RecursoNaoEncontradoException;
import br.com.openlabs.telecentro.model.Avaliacao;
import br.com.openlabs.telecentro.model.Lab;

/** Catálogo do OpenLabs: labs e suas avaliações. Só leitura. */
@Service
public class CatalogoBo {

    private final LabDao labDao;
    private final AvaliacaoDao avaliacaoDao;

    public CatalogoBo(LabDao labDao, AvaliacaoDao avaliacaoDao) {
        this.labDao = labDao;
        this.avaliacaoDao = avaliacaoDao;
    }

    public List<Lab> listarLabs() {
        return labDao.listar();
    }

    public Lab buscarLab(Long id) {
        return labDao.buscarPorId(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Lab " + id + " não encontrado."));
    }

    /** Lista todas as avaliações ou só as do lab informado. */
    public List<Avaliacao> listarAvaliacoes(Long idLab) {
        return idLab == null ? avaliacaoDao.listar() : avaliacaoDao.listarPorLab(idLab);
    }

    public Avaliacao buscarAvaliacao(Long id) {
        return avaliacaoDao.buscarPorId(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Avaliação " + id + " não encontrada."));
    }
}
