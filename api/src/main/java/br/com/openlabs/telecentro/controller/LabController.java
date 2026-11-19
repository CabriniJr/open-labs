package br.com.openlabs.telecentro.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.com.openlabs.telecentro.bo.CatalogoBo;
import br.com.openlabs.telecentro.dto.LabResponse;

/** Catálogo de labs: só leitura. */
@RestController
@RequestMapping("/labs")
public class LabController {

    private final CatalogoBo catalogoBo;

    public LabController(CatalogoBo catalogoBo) {
        this.catalogoBo = catalogoBo;
    }

    @GetMapping
    public List<LabResponse> listar() {
        return catalogoBo.listarLabs().stream()
                .map(LabResponse::de)
                .toList();
    }

    @GetMapping("/{id}")
    public LabResponse buscar(@PathVariable Long id) {
        return LabResponse.de(catalogoBo.buscarLab(id));
    }
}
