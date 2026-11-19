package br.com.openlabs.telecentro.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Dados que o cliente envia para cadastrar ou atualizar um aluno. */
public record AlunoRequest(
        @NotNull(message = "é obrigatório")
        Long idTelecentro,

        @NotBlank(message = "é obrigatório")
        @Size(max = 80, message = "deve ter no máximo 80 caracteres")
        String nome,

        @NotNull(message = "é obrigatória (formato aaaa-mm-dd)")
        LocalDate dataNascimento,

        @Email(message = "deve ser um e-mail válido")
        @Size(max = 120, message = "deve ter no máximo 120 caracteres")
        String email) {
}
