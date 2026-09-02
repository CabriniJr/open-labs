import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXERCICIOS_DOS_PROVEDORES } from "@ovh/otel-domain";
import { montarExercicio } from "./exercicios.js";

describe("o recorte sai do arquivo que roda", () => {
  it.each(EXERCICIOS_DOS_PROVEDORES.map((e) => [e.id, e] as const))(
    "%s: o marcador existe e o trecho não vem vazio",
    (_id, definicao) => {
      const montado = montarExercicio(definicao);
      expect(montado.antes.length + montado.depois.length).toBeGreaterThan(0);
      expect(montado.certo.codigo.trim().length).toBeGreaterThan(0);
    },
  );

  it("o bloco certo é, caractere por caractere, o que está entre os marcadores de lacuna", () => {
    // É ESTE teste que transforma "a resposta é extraída" de promessa em fato.
    const definicao = EXERCICIOS_DOS_PROVEDORES[0]!;
    const montado = montarExercicio(definicao);
    const fonte = lerArquivo(definicao.arquivo);
    expect(fonte).toContain(montado.certo.codigo.trim());
  });

  it("nenhum distrator é igual ao certo — senão o exercício vira moeda", () => {
    for (const definicao of EXERCICIOS_DOS_PROVEDORES) {
      const montado = montarExercicio(definicao);
      const normal = (s: string) => s.replace(/\s+/gu, " ").trim();
      for (const bloco of montado.blocos) {
        if (bloco.certo === true) continue;
        expect(normal(bloco.codigo), bloco.id).not.toBe(normal(montado.certo.codigo));
      }
    }
  });

  it("a ordem dos blocos é estável entre dois builds", () => {
    // Sorteio real quebraria o SSG: o servidor renderiza uma ordem e o cliente
    // hidrata com outra. A ordem sai do id, e por isso é a mesma sempre.
    const definicao = EXERCICIOS_DOS_PROVEDORES[0]!;
    const a = montarExercicio(definicao).blocos.map((b) => b.id);
    const b = montarExercicio(definicao).blocos.map((b) => b.id);
    expect(a).toEqual(b);
  });

  it("um marcador que não existe FALHA, e diz qual", () => {
    const quebrado = { ...EXERCICIOS_DOS_PROVEDORES[0]!, trecho: "nao-existe" };
    expect(() => montarExercicio(quebrado)).toThrow(/nao-existe/u);
  });
});

function lerArquivo(caminho: string): string {
  // `readFileSync` importado no topo: `require` não existe num módulo ESM, e o
  // pacote é `"type": "module"`.
  return readFileSync(new URL(`../../../../${caminho}`, import.meta.url), "utf8");
}
