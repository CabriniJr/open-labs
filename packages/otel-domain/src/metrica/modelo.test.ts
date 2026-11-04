import { describe, expect, it } from "vitest";
import { baldeDe, coletar, lerNoBackend, novoAgregador, registrar, roteiro, rodar } from "./modelo.js";

describe("the explicit bucket histogram", () => {
  it("upper bounds are inclusive, and the last bucket is open", () => {
    expect([25, 26, 50, 51, 250, 251].map(baldeDe)).toEqual([0, 1, 1, 2, 3, 4]);
  });

  it("buckets always add up to the count", () => {
    const c = rodar(roteiro({ temporalidade: "cumulative", reinicio: false }), "cumulative");
    for (const p of c.pontos) expect(p.baldes.reduce((a, b) => a + b, 0)).toBe(p.contagem);
  });
});

describe("temporality", () => {
  it("delta forgets on every collect; cumulative keeps counting from the start", () => {
    let d = registrar(registrar(novoAgregador("delta"), 10), 20);
    let c = registrar(registrar(novoAgregador("cumulative"), 10), 20);
    const d1 = coletar(d, 1000);
    const c1 = coletar(c, 1000);
    d = registrar(d1.agregador, 30);
    c = registrar(c1.agregador, 30);
    expect(coletar(d, 2000).ponto).toMatchObject({ inicio: 1000, contagem: 1, soma: 30 });
    expect(coletar(c, 2000).ponto).toMatchObject({ inicio: 0, contagem: 3, soma: 60 });
  });

  it("without a restart, both readings agree with what happened", () => {
    for (const t of ["cumulative", "delta"] as const) {
      const c = rodar(roteiro({ temporalidade: t, reinicio: false }), t);
      expect(lerNoBackend(c.pontos, { respeitaInicio: true })).toEqual(c.reais);
      expect(c.reais).toEqual([6, 5, 4, 4]);
    }
  });

  it("a restart drops cumulative to a new start time, and a backend that ignores it reads negative requests", () => {
    const c = rodar(roteiro({ temporalidade: "cumulative", reinicio: true }), "cumulative");
    expect(c.pontos[2]!.inicio).not.toBe(c.pontos[1]!.inicio);
    expect(c.pontos[2]!.contagem).toBeLessThan(c.pontos[1]!.contagem);
    expect(lerNoBackend(c.pontos, { respeitaInicio: false })[2]).toBe(2 - 11);
    expect(lerNoBackend(c.pontos, { respeitaInicio: true })).toEqual([6, 5, 2, 4]);
  });

  it("what was measured and not yet collected dies with the process, in either temporality", () => {
    for (const t of ["cumulative", "delta"] as const) {
      const c = rodar(roteiro({ temporalidade: t, reinicio: true }), t);
      expect(c.perdidas).toBe(2);
      const lido = lerNoBackend(c.pontos, { respeitaInicio: true });
      expect(lido.reduce((a, b) => a + b, 0)).toBe(c.reais.reduce((a, b) => a + b, 0) - c.perdidas);
    }
  });
});
