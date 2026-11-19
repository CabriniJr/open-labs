package br.com.openlabs.telecentro.exception;

/** Uma regra do domínio foi violada (ex.: desativar um aluno já inativo). Vira HTTP 422. */
public class RegraDeNegocioException extends RuntimeException {

    public RegraDeNegocioException(String mensagem) {
        super(mensagem);
    }
}
