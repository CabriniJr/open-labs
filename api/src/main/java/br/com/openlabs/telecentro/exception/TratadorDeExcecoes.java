package br.com.openlabs.telecentro.exception;

import java.time.LocalDateTime;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Único lugar que traduz exceção em resposta HTTP.
 * Toda resposta de erro sai no formato ErroResposta.
 */
@RestControllerAdvice
public class TratadorDeExcecoes {

    private static final Logger log = LoggerFactory.getLogger(TratadorDeExcecoes.class);

    @ExceptionHandler(RecursoNaoEncontradoException.class)
    public ResponseEntity<ErroResposta> tratarNaoEncontrado(RecursoNaoEncontradoException e, HttpServletRequest requisicao) {
        return responder(HttpStatus.NOT_FOUND, e.getMessage(), requisicao);
    }

    @ExceptionHandler(RegraDeNegocioException.class)
    public ResponseEntity<ErroResposta> tratarRegraDeNegocio(RegraDeNegocioException e, HttpServletRequest requisicao) {
        return responder(HttpStatus.UNPROCESSABLE_ENTITY, e.getMessage(), requisicao);
    }

    /** Bean Validation dos DTOs: devolve cada campo inválido com o motivo. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErroResposta> tratarValidacao(MethodArgumentNotValidException e, HttpServletRequest requisicao) {
        String campos = e.getBindingResult().getFieldErrors().stream()
                .map(erro -> erro.getField() + ": " + erro.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return responder(HttpStatus.BAD_REQUEST, campos, requisicao);
    }

    /** JSON mal escrito, data fora do formato aaaa-mm-dd ou texto onde se esperava número. */
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ErroResposta> tratarRequisicaoMalFormada(Exception e, HttpServletRequest requisicao) {
        return responder(HttpStatus.BAD_REQUEST,
                "Requisição mal formada: confira o JSON, o formato das datas (aaaa-mm-dd) e os tipos dos campos.", requisicao);
    }

    /** Escolhe o status pelo código do erro Oracle guardado pelo DAO. */
    @ExceptionHandler(PersistenciaException.class)
    public ResponseEntity<ErroResposta> tratarPersistencia(PersistenciaException e, HttpServletRequest requisicao) {
        return switch (e.getCodigoOracle()) {
            case 1 -> responder(HttpStatus.CONFLICT,
                    "Já existe um registro igual: e-mail ou faixa de rede repetidos, ou o aluno já começou esse lab.",
                    requisicao);
            // 2290 = CHECK, 1400 = NOT NULL, 1438 = número grande demais, 12899 = texto maior que a coluna
            case 2290, 1400, 1438, 12899 -> responder(HttpStatus.BAD_REQUEST,
                    "Os dados não respeitam as regras do banco: campo obrigatório vazio, valor fora do permitido ou texto longo demais.",
                    requisicao);
            case 2291 -> responder(HttpStatus.NOT_FOUND,
                    "Um registro relacionado não existe. Confira os ids informados.", requisicao);
            case 2292 -> responder(HttpStatus.CONFLICT,
                    "O registro tem outros registros ligados a ele e não pode ser excluído.", requisicao);
            default -> erroInterno(e, requisicao);
        };
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErroResposta> tratarInesperado(Exception e, HttpServletRequest requisicao) {
        // Erros do próprio Spring MVC (rota inexistente, método HTTP errado...) já trazem o status certo.
        if (e instanceof ErrorResponse erroDoSpring) {
            HttpStatus status = HttpStatus.valueOf(erroDoSpring.getStatusCode().value());
            return responder(status, erroDoSpring.getBody().getDetail(), requisicao);
        }
        return erroInterno(e, requisicao);
    }

    /** 500 sem detalhes na resposta; o stack trace fica só no log do servidor. */
    private ResponseEntity<ErroResposta> erroInterno(Exception e, HttpServletRequest requisicao) {
        log.error("Erro inesperado em {} {}", requisicao.getMethod(), requisicao.getRequestURI(), e);
        return responder(HttpStatus.INTERNAL_SERVER_ERROR, "Erro interno. Tente novamente mais tarde.", requisicao);
    }

    private ResponseEntity<ErroResposta> responder(HttpStatus status, String mensagem, HttpServletRequest requisicao) {
        ErroResposta corpo = new ErroResposta(status.value(), status.getReasonPhrase(), mensagem,
                requisicao.getRequestURI(), LocalDateTime.now());
        return ResponseEntity.status(status).body(corpo);
    }
}
