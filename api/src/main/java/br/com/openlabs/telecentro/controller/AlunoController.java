package br.com.openlabs.telecentro.controller;

import java.net.URI;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import br.com.openlabs.telecentro.bo.AlunoBo;
import br.com.openlabs.telecentro.dto.AlunoRequest;
import br.com.openlabs.telecentro.dto.AlunoResponse;
import br.com.openlabs.telecentro.model.Aluno;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/alunos")
public class AlunoController {

    private final AlunoBo alunoBo;

    public AlunoController(AlunoBo alunoBo) {
        this.alunoBo = alunoBo;
    }

    /** GET /alunos ou GET /alunos?telecentro=1 */
    @GetMapping
    public List<AlunoResponse> listar(@RequestParam(name = "telecentro", required = false) Long idTelecentro) {
        return alunoBo.listar(idTelecentro).stream()
                .map(AlunoResponse::de)
                .toList();
    }

    @GetMapping("/{id}")
    public AlunoResponse buscar(@PathVariable Long id) {
        return AlunoResponse.de(alunoBo.buscar(id));
    }

    /** Devolve 201 com o cabeçalho Location apontando para /alunos/{id} do aluno criado. */
    @PostMapping
    public ResponseEntity<AlunoResponse> cadastrar(@RequestBody @Valid AlunoRequest dados) {
        Aluno aluno = alunoBo.cadastrar(dados);
        URI local = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(aluno.getId())
                .toUri();
        return ResponseEntity.created(local).body(AlunoResponse.de(aluno));
    }

    @PutMapping("/{id}")
    public AlunoResponse atualizar(@PathVariable Long id, @RequestBody @Valid AlunoRequest dados) {
        return AlunoResponse.de(alunoBo.atualizar(id, dados));
    }

    @PutMapping("/{id}/desativacao")
    public AlunoResponse desativar(@PathVariable Long id) {
        return AlunoResponse.de(alunoBo.desativar(id));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id) {
        alunoBo.excluir(id);
    }
}
