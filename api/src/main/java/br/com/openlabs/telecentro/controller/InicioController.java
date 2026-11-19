package br.com.openlabs.telecentro.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import br.com.openlabs.telecentro.dto.InicioResponse;

@RestController
public class InicioController {

    @GetMapping("/")
    public InicioResponse inicio() {
        return new InicioResponse("OpenLabs no Telecentro - API", "no ar", "/swagger-ui.html");
    }
}
