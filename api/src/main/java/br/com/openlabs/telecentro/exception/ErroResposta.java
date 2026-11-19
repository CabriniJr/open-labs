package br.com.openlabs.telecentro.exception;

import java.time.LocalDateTime;

/** Corpo JSON de toda resposta de erro da API. */
public record ErroResposta(int status, String erro, String mensagem, String caminho, LocalDateTime momento) {
}
