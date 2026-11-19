package br.com.openlabs.telecentro.model;

/** Tipo de modelo interativo de um lab. No banco fica em minúsculas ('fluxo', 'estado', 'filme', 'direto'). */
public enum TipoInteracao {
    FLUXO, ESTADO, FILME, DIRETO;

    /** Converte o texto da coluna tp_interacao ('fluxo') na constante do enum (FLUXO). */
    public static TipoInteracao doBanco(String texto) {
        return valueOf(texto.toUpperCase());
    }
}
