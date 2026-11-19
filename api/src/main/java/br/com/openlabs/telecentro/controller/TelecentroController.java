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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import br.com.openlabs.telecentro.bo.IndicadorBo;
import br.com.openlabs.telecentro.bo.TelecentroBo;
import br.com.openlabs.telecentro.dto.IndicadorResponse;
import br.com.openlabs.telecentro.dto.TelecentroRequest;
import br.com.openlabs.telecentro.dto.TelecentroResponse;
import br.com.openlabs.telecentro.model.Telecentro;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/telecentros")
public class TelecentroController {

    private final TelecentroBo telecentroBo;
    private final IndicadorBo indicadorBo;

    public TelecentroController(TelecentroBo telecentroBo, IndicadorBo indicadorBo) {
        this.telecentroBo = telecentroBo;
        this.indicadorBo = indicadorBo;
    }

    @GetMapping
    public List<TelecentroResponse> listar() {
        return telecentroBo.listar().stream()
                .map(TelecentroResponse::de)
                .toList();
    }

    @GetMapping("/{id}")
    public TelecentroResponse buscar(@PathVariable Long id) {
        return TelecentroResponse.de(telecentroBo.buscar(id));
    }

    /** Devolve 201 com o cabeçalho Location apontando para /telecentros/{id}. */
    @PostMapping
    public ResponseEntity<TelecentroResponse> cadastrar(@RequestBody @Valid TelecentroRequest dados) {
        Telecentro telecentro = telecentroBo.cadastrar(dados);
        URI local = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(telecentro.getId())
                .toUri();
        return ResponseEntity.created(local).body(TelecentroResponse.de(telecentro));
    }

    @PutMapping("/{id}")
    public TelecentroResponse atualizar(@PathVariable Long id, @RequestBody @Valid TelecentroRequest dados) {
        return TelecentroResponse.de(telecentroBo.atualizar(id, dados));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id) {
        telecentroBo.excluir(id);
    }

    /** Indicador de impacto: alunos ativos, avaliações por mês, labs concluídos e média das notas. */
    @GetMapping("/{id}/indicadores")
    public IndicadorResponse indicadores(@PathVariable Long id) {
        return indicadorBo.calcular(id);
    }
}
