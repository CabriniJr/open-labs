import { describe, expect, it } from "vitest";
import { HANDBOOKS, handbookOf, readyCount, type Handbook } from "./handbooks.js";

/**
 * O catálogo é a promessa da landing. Um item apontando para uma fase que não
 * existe some da página sem aviso — é exatamente a mentira silenciosa que este
 * projeto trata como o pior defeito, então ela morre aqui e não no navegador.
 */
function itens(handbook: Handbook) {
  return [...handbook.articles, ...handbook.labs];
}

describe("catálogo do OpenLabs", () => {
  it("tem id único por handbook", () => {
    const ids = HANDBOOKS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("acha handbook por id, e não inventa o que não existe", () => {
    expect(handbookOf("otel")?.name).toContain("OpenTelemetry");
    expect(handbookOf("nao-existe")).toBeUndefined();
  });

  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: toda fase é numerada uma vez só e em ordem",
    (_id, handbook) => {
      const numeros = handbook.phases.map((f) => f.number);
      expect(new Set(numeros).size).toBe(numeros.length);
      expect([...numeros].sort((a, b) => a - b)).toEqual(numeros);
    },
  );

  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: todo artigo e todo lab caem numa fase que existe",
    (_id, handbook) => {
      const fases = new Set(handbook.phases.map((f) => f.number));
      for (const item of itens(handbook)) {
        expect(fases.has(item.phase), `${item.id} está na fase ${item.phase}`).toBe(true);
      }
    },
  );

  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: nenhuma fase fica vazia dos dois lados",
    (_id, handbook) => {
      for (const fase of handbook.phases) {
        const daFase = itens(handbook).filter((item) => item.phase === fase.number);
        expect(daFase.length, `fase ${fase.number} (${fase.title}) sem nada`).toBeGreaterThan(0);
      }
    },
  );

  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: id de item não se repete",
    (_id, handbook) => {
      const ids = itens(handbook).map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    },
  );

  it("conta como pronto só o que está pronto", () => {
    expect(readyCount([])).toBe(0);
    expect(
      readyCount([
        { id: "a", title: "A", status: "available", phase: 1 },
        { id: "b", title: "B", status: "coming", phase: 1 },
      ]),
    ).toBe(1);
  });
});
