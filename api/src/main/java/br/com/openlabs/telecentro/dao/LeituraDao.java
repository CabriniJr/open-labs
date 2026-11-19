package br.com.openlabs.telecentro.dao;

import java.util.List;
import java.util.Optional;

import br.com.openlabs.telecentro.model.EntidadeBase;

/** Consultas que todo DAO oferece. Os DAOs de Lab e Avaliacao, que são só leitura, param aqui. */
public interface LeituraDao<T extends EntidadeBase> {

    Optional<T> buscarPorId(Long id);

    List<T> listar();
}
