package br.com.openlabs.telecentro.dao;

import br.com.openlabs.telecentro.model.EntidadeBase;

/** CRUD completo: as consultas de LeituraDao mais inserir, atualizar e excluir. */
public interface CrudDao<T extends EntidadeBase> extends LeituraDao<T> {

    /** Grava a entidade e devolve uma nova instância já com o id gerado pelo Oracle. */
    T inserir(T entidade);

    void atualizar(T entidade);

    void excluir(Long id);
}
