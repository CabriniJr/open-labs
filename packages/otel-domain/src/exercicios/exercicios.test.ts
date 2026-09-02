import { describe, expect, it } from "vitest";
import { EXERCICIOS_DOS_PROVEDORES } from "./providers.js";

describe("a definição do exercício", () => {
  it("todo bloco carrega a âncora na spec, como os mal-entendidos", () => {
    for (const e of EXERCICIOS_DOS_PROVEDORES) {
      expect(e.fonteCerto, e.id).toMatch(/^https:\/\/(opentelemetry\.io|www\.w3\.org)\//u);
      for (const d of e.distratores) {
        expect(d.fonte, d.id).toMatch(/^https:\/\/(opentelemetry\.io|www\.w3\.org)\//u);
      }
    }
  });

  it("cada exercício tem exatamente dois distratores", () => {
    // Um só vira sim/não; três empurram a lacuna para fora da tela.
    for (const e of EXERCICIOS_DOS_PROVEDORES) {
      expect(e.distratores.length, e.id).toBe(2);
    }
  });

  it("todo id é único, porque o placar é indexado por ele", () => {
    const ids = EXERCICIOS_DOS_PROVEDORES.flatMap((e) => [e.id, ...e.distratores.map((d) => d.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo exercício aponta para um arquivo dentro de labs/", () => {
    for (const e of EXERCICIOS_DOS_PROVEDORES) {
      expect(e.arquivo, e.id).toMatch(/^labs\//u);
    }
  });
});
