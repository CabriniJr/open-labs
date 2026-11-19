package br.com.openlabs.telecentro.exception;

/** O id pedido não existe no banco. Vira HTTP 404. */
public class RecursoNaoEncontradoException extends RuntimeException {

    public RecursoNaoEncontradoException(String mensagem) {
        super(mensagem);
    }
}
