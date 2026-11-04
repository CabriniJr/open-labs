import { describe, expect, it } from "vitest";
import { ETAPAS, ORDEM_CODIGO_PRIMEIRO, ORDEM_RECOMENDADA, planejar, riscos } from "./modelo.js";

describe("the rollout", () => {
  it("the recommended order never does a step before its prerequisites", () => {
    expect(riscos(planejar(ORDEM_RECOMENDADA))).toBe(0);
  });

  it("starting from code accumulates missing prerequisites, each with its consequence", () => {
    const plano = planejar(ORDEM_CODIGO_PRIMEIRO);
    expect(riscos(plano)).toBeGreaterThan(0);
    expect(plano[0]!.faltando.map((f) => f.de)).toEqual(["auto"]);
    expect(plano.every((p) => p.faltando.every((f) => f.sem.length > 0))).toBe(true);
  });

  it("every step names a lab of the handbook", () => {
    for (const e of ETAPAS) expect(e.lab.startsWith("labs/")).toBe(true);
  });

  it("answered questions accumulate, whatever the order", () => {
    const todas = ETAPAS.flatMap((e) => e.destrava).length;
    expect(planejar(ORDEM_RECOMENDADA).at(-1)!.respondidas).toHaveLength(todas);
    expect(planejar(ORDEM_CODIGO_PRIMEIRO).at(-1)!.respondidas).toHaveLength(todas);
  });
});
