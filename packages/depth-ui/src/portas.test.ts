import { describe, expect, it } from "vitest";
import { indexTree } from "@ovh/depth-core";
import type { AnyObject, Wire } from "@ovh/depth-core";
import { PORTA_ANONIMA, portasDaCaixa, posicaoDaPorta } from "./portas.js";

const folha = (id: string): AnyObject => ({
  id,
  kind: "sink",
  label: id,
  leaf: true,
  behavior: (state) => ({ state, out: [] }),
});

const tree = indexTree({
  id: "raiz",
  kind: "composite",
  label: "raiz",
  children: [
    folha("fonte"),
    {
      id: "caixa",
      kind: "composite",
      label: "caixa",
      inlets: { a: ["dentro"], b: [{ node: "dentro", port: "outro" }] },
      outlets: { out: ["dentro"] },
      children: [folha("dentro")],
    },
    folha("destino"),
  ],
});

const wires: readonly Wire[] = [
  { from: "fonte", port: "out", to: "caixa", toPort: "a", timing: "settle" },
  { from: "caixa", port: "out", to: "destino", timing: "settle" },
  { from: "fonte", port: "out", to: "destino", timing: "settle" },
];

describe("as portas de uma caixa", () => {
  it("saem dos bornes declarados", () => {
    const p = portasDaCaixa(tree, [], "caixa");
    expect(p.entradas).toEqual(["a", "b"]);
    expect(p.saidas).toEqual(["out"]);
  });

  it("saem também dos fios que de fato chegam e saem", () => {
    const p = portasDaCaixa(tree, wires, "caixa");
    expect(p.entradas).toEqual(["a", "b"]);
    expect(p.saidas).toEqual(["out"]);
  });

  /**
   * Carga não nomeia porta — o motor acha a folha de entrada. A caixa ainda
   * tem uma entrada, e escondê-la seria desenhar um fio encostando em nada.
   */
  it("uma entrada sem nome ainda é uma entrada", () => {
    const p = portasDaCaixa(tree, wires, "destino");
    expect(p.entradas).toEqual([PORTA_ANONIMA]);
    expect(p.saidas).toEqual([]);
  });

  it("quem só emite não ganha entrada inventada", () => {
    const p = portasDaCaixa(tree, wires, "fonte");
    expect(p.entradas).toEqual([]);
    expect(p.saidas).toEqual(["out"]);
  });

  it("um objeto que ninguém liga não tem porta nenhuma", () => {
    expect(portasDaCaixa(tree, [], "fonte")).toEqual({ entradas: [], saidas: [] });
  });
});

describe("onde a porta fica na borda", () => {
  it("uma porta fica no meio do lado", () => {
    expect(posicaoDaPorta(0, 1)).toBe(0.5);
  });

  it("duas ou mais se distribuem com folga nas pontas", () => {
    // Encostadas no canto, duas portas de lados diferentes se tocam e a caixa
    // parece ter uma só.
    expect(posicaoDaPorta(0, 2)).toBeCloseTo(1 / 3, 6);
    expect(posicaoDaPorta(1, 2)).toBeCloseTo(2 / 3, 6);
    for (let n = 1; n <= 8; n += 1) {
      for (let i = 0; i < n; i += 1) {
        expect(posicaoDaPorta(i, n)).toBeGreaterThan(0);
        expect(posicaoDaPorta(i, n)).toBeLessThan(1);
      }
    }
  });

  it("a ordem na borda é a ordem da lista", () => {
    expect(posicaoDaPorta(0, 3)).toBeLessThan(posicaoDaPorta(1, 3));
    expect(posicaoDaPorta(1, 3)).toBeLessThan(posicaoDaPorta(2, 3));
  });
});
