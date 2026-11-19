package br.com.openlabs.telecentro.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.openlabs.telecentro.bo.ProgressoBo;
import br.com.openlabs.telecentro.dto.ProgressoRequest;
import br.com.openlabs.telecentro.dto.ProgressoResponse;
import jakarta.validation.Valid;

/** Progresso do aluno nos labs. A listagem fica em /alunos/{id}/progressos porque é sempre de um aluno. */
@RestController
public class ProgressoController {

    private final ProgressoBo progressoBo;

    public ProgressoController(ProgressoBo progressoBo) {
        this.progressoBo = progressoBo;
    }

    @GetMapping("/alunos/{idAluno}/progressos")
    public List<ProgressoResponse> listarPorAluno(@PathVariable Long idAluno) {
        return progressoBo.listarPorAluno(idAluno).stream()
                .map(ProgressoResponse::de)
                .toList();
    }

    /** O aluno começa um lab hoje. */
    @PostMapping("/progressos")
    @ResponseStatus(HttpStatus.CREATED)
    public ProgressoResponse iniciar(@RequestBody @Valid ProgressoRequest dados) {
        return ProgressoResponse.de(progressoBo.iniciar(dados));
    }

    /** O aluno conclui o lab hoje. */
    @PutMapping("/progressos/{id}/conclusao")
    public ProgressoResponse concluir(@PathVariable Long id) {
        return ProgressoResponse.de(progressoBo.concluir(id));
    }

    @DeleteMapping("/progressos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id) {
        progressoBo.excluir(id);
    }
}
