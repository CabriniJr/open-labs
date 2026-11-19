package br.com.openlabs.telecentro.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.openlabs.telecentro.bo.TentativaBo;
import br.com.openlabs.telecentro.dto.TentativaRequest;
import br.com.openlabs.telecentro.dto.TentativaResponse;
import jakarta.validation.Valid;

/** Envios de avaliação. A listagem fica em /alunos/{id}/tentativas porque é sempre de um aluno. */
@RestController
public class TentativaController {

    private final TentativaBo tentativaBo;

    public TentativaController(TentativaBo tentativaBo) {
        this.tentativaBo = tentativaBo;
    }

    @GetMapping("/alunos/{idAluno}/tentativas")
    public List<TentativaResponse> listarPorAluno(@PathVariable Long idAluno) {
        return tentativaBo.listarPorAluno(idAluno);
    }

    /** O aluno envia os acertos; a resposta traz a nota calculada e se ela aprova. */
    @PostMapping("/tentativas")
    @ResponseStatus(HttpStatus.CREATED)
    public TentativaResponse registrar(@RequestBody @Valid TentativaRequest dados) {
        return tentativaBo.registrar(dados);
    }

    /** Remove uma tentativa lançada errada. */
    @DeleteMapping("/tentativas/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id) {
        tentativaBo.excluir(id);
    }
}
