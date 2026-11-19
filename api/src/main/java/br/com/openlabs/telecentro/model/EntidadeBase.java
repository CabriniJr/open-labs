package br.com.openlabs.telecentro.model;

import java.util.Objects;

/**
 * Base de toda entidade: guarda o id gerado pelo Oracle.
 * O id é final. Uma entidade nova nasce sem id (null), e o DAO devolve
 * outra instância, já com o id, depois do INSERT.
 */
public abstract class EntidadeBase {

    private final Long id;

    protected EntidadeBase(Long id) {
        this.id = id;
    }

    public Long getId() {
        return id;
    }

    /** Duas entidades são a mesma quando têm a mesma classe e o mesmo id. Sem id, só é igual a si mesma. */
    @Override
    public boolean equals(Object outro) {
        if (this == outro) {
            return true;
        }
        if (outro == null || getClass() != outro.getClass()) {
            return false;
        }
        EntidadeBase entidade = (EntidadeBase) outro;
        return id != null && id.equals(entidade.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
