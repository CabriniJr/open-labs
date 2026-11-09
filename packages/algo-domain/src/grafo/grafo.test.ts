import { describe, expect, it } from "vitest";
import { adicionarAresta, adicionarNo, comDirecao, componentes, EXEMPLOS, ErroDeGrafo, graus, listaDeAdjacencia, matrizDeAdjacencia, oQueE, pesar, removerAresta, removerNo, temCiclo, vazio } from "./grafo.js";

const dois = EXEMPLOS["two-points"]!.grafo;

describe("grafo", () => {
  it("dois pontos e uma linha: a lista e a matriz dizem a mesma coisa", () => {
    expect([...listaDeAdjacencia(dois)]).toEqual([
      ["A", [{ para: "B", peso: 5 }]],
      ["B", [{ para: "A", peso: 5 }]],
    ]);
    expect(matrizDeAdjacencia(dois).celulas).toEqual([
      [null, 5],
      [5, null],
    ]);
    expect(oQueE(dois)).toMatch(/two points and one edge/);
  });

  it("dirigido: a seta vai e não volta, e a matriz deixa de ser simétrica", () => {
    const g = comDirecao(dois, true);
    expect(matrizDeAdjacencia(g).celulas).toEqual([
      [null, 5],
      [null, null],
    ]);
    expect(graus(g).get("A")).toEqual({ entra: 0, sai: 1 });
    expect(graus(g).get("B")).toEqual({ entra: 1, sai: 0 });
  });

  it("voltar para não dirigido funde as setas opostas", () => {
    let g = comDirecao(dois, true);
    g = adicionarAresta(g, "B", "A", 2);
    expect(g.arestas).toHaveLength(2);
    expect(comDirecao(g, false).arestas).toHaveLength(1);
  });

  it("property: a matriz de um não dirigido é simétrica, e a soma dos graus é 2·arestas", () => {
    for (const { grafo } of Object.values(EXEMPLOS)) {
      const { celulas } = matrizDeAdjacencia(grafo);
      const soma = [...graus(grafo).values()].reduce((s, x) => s + x.sai, 0);
      if (!grafo.dirigido) {
        celulas.forEach((linha, i) => linha.forEach((c, j) => expect(c).toBe(celulas[j]![i])));
        expect(soma).toBe(2 * grafo.arestas.length);
      } else expect(soma).toBe(grafo.arestas.length);
    }
  });

  it("árvore, ciclo e pedaços soltos têm nome", () => {
    expect(temCiclo(EXEMPLOS.tree!.grafo)).toBe(false);
    expect(oQueE(EXEMPLOS.tree!.grafo)).toMatch(/tree/);
    expect(temCiclo(EXEMPLOS.triangle!.grafo)).toBe(true);
    expect(temCiclo(EXEMPLOS["one-way"]!.grafo)).toBe(true);
    const solto = removerAresta(dois, "A", "B");
    expect(componentes(solto)).toHaveLength(2);
    expect(oQueE(adicionarNo(solto, 0, 0))).toMatch(/no edges/);
  });

  it("montar do zero, peso, e tirar um ponto leva as arestas dele", () => {
    let g = vazio();
    g = adicionarNo(g, 10, 10);
    g = adicionarNo(g, 50, 50);
    g = adicionarNo(g, 90, 10);
    expect(g.nos.map((n) => n.rotulo)).toEqual(["A", "B", "C"]);
    g = adicionarAresta(g, "A", "B");
    g = adicionarAresta(g, "B", "C");
    g = pesar(g, "C", "B", 9);
    expect(g.arestas[1]!.peso).toBe(9);
    g = removerNo(g, "B");
    expect(g.arestas).toHaveLength(0);
    expect(g.nos.map((n) => n.id)).toEqual(["A", "C"]);
  });

  it("recusa o que não é aresta deste lab", () => {
    expect(() => adicionarAresta(dois, "A", "A")).toThrow(ErroDeGrafo);
    expect(() => adicionarAresta(dois, "B", "A")).toThrow(/already linked/);
    expect(() => adicionarAresta(dois, "A", "Z")).toThrow(/existing points/);
    expect(() => adicionarAresta(adicionarNo(dois, 1, 1), "A", "C", 0)).toThrow(/positive/);
    expect(() => pesar(dois, "A", "B", -1)).toThrow(/positive/);
    let g = vazio();
    for (let k = 0; k < 16; k += 1) g = adicionarNo(g, k, k);
    expect(() => adicionarNo(g, 0, 0)).toThrow(/16 points/);
  });
});
