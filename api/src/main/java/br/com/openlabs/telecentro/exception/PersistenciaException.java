package br.com.openlabs.telecentro.exception;

import java.sql.SQLException;

/**
 * Erro de banco vindo de um DAO. Guarda a SQLException original como causa
 * e o código do erro Oracle (ex.: 1 = UNIQUE, 2292 = registro com filhos),
 * que o TratadorDeExcecoes usa para escolher o status HTTP.
 */
public class PersistenciaException extends RuntimeException {

    private final int codigoOracle;

    public PersistenciaException(String mensagem, SQLException causa) {
        super(mensagem, causa);
        this.codigoOracle = causa.getErrorCode();
    }

    public int getCodigoOracle() {
        return codigoOracle;
    }
}
