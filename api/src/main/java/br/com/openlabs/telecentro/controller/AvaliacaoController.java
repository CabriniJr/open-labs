package br.com.openlabs.telecentro.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.openlabs.telecentro.bo.CatalogoBo;
import br.com.openlabs.telecentro.dto.AvaliacaoResponse;

/** Avaliações dos labs: só leitura. */
@RestController
@RequestMapping("/avaliacoes")
public class AvaliacaoController {

    private final CatalogoBo catalogoBo;

    public AvaliacaoController(CatalogoBo catalogoBo) {
        this.catalogoBo = catalogoBo;
    }

    /** GET /avaliacoes ou GET /avaliacoes?lab=1 */
    @GetMapping
    public List<AvaliacaoResponse> listar(@RequestParam(name = "lab", required = false) Long idLab) {
        return catalogoBo.listarAvaliacoes(idLab).stream()
                .map(AvaliacaoResponse::de)
                .toList();
    }

    @GetMapping("/{id}")
    public AvaliacaoResponse buscar(@PathVariable Long id) {
        return AvaliacaoResponse.de(catalogoBo.buscarAvaliacao(id));
    }
}
