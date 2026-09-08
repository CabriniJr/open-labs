import { describe, expect, it } from "vitest";
import { indexTree } from "@ovh/depth-core";
import type { AnyObject, Wire } from "@ovh/depth-core";
import { lequeDaCaixa, lequeDe, PORTA_ANONIMA, portasDaCaixa, posicaoDaPorta } from "./portas.js";

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

describe("para que lado o leque abre", () => {
  it("várias entram e uma sai: fecha, que é o mux e é a porta lógica", () => {
    expect(lequeDe(2, 1)).toBe("fecha");
    expect(lequeDe(8, 1)).toBe("fecha");
  });

  it("uma entra e várias saem: abre, que é o amostrador e é o dispersor", () => {
    // Aqui a forma antiga afirmava o CONTRÁRIO do que o modelo diz, e forma
    // afirma antes de qualquer rótulo ser lido.
    expect(lequeDe(1, 3)).toBe("abre");
    expect(lequeDe(1, 64)).toBe("abre");
  });

  it("sem leque, nada de trapézio: ele afirmaria um que não existe", () => {
    expect(lequeDe(1, 1)).toBe("reto");
    expect(lequeDe(2, 2)).toBe("reto");
    expect(lequeDe(0, 0)).toBe("reto");
  });
});

describe("o leque contado nas ligações", () => {
  const mundo = (wires: readonly Wire[]) => {
    const raiz: AnyObject = {
      id: "mundo",
      kind: "composite",
      role: "node",
      children: [
        { id: "dispersor", kind: "router", role: "node", leaf: true },
        { id: "coletor", kind: "router", role: "node", leaf: true },
      ],
    } as unknown as AnyObject;
    return { tree: indexTree(raiz), wires };
  };

  it("trinta e dois fios numa entrada anônima ainda são um leque que fecha", () => {
    // Pelos NOMES de porta o coletor tem uma entrada e uma saída — leque
    // nenhum. Pelo que o leitor vê, trinta e duas linhas chegam e uma sai.
    const wires = [
      ...Array.from({ length: 32 }, (_, i) => ({
        from: `peso${i}`,
        port: "out",
        to: "coletor",
      })),
      { from: "coletor", port: "out", to: "fora" },
    ] as unknown as Wire[];
    const { tree } = mundo(wires);
    expect(lequeDaCaixa(tree, wires, "coletor")).toBe("fecha");
  });

  it("uma entrada e sessenta e quatro saídas abre", () => {
    const wires = [
      { from: "fora", port: "out", to: "dispersor" },
      ...Array.from({ length: 64 }, (_, i) => ({
        from: "dispersor",
        port: `a${i}`,
        to: `bit${i}`,
      })),
    ] as unknown as Wire[];
    const { tree } = mundo(wires);
    expect(lequeDaCaixa(tree, wires, "dispersor")).toBe("abre");
  });

  it("fora do enquadramento, a forma vem do que o objeto declarou", () => {
    // Sem fio na vista não há o que contar — e uma caixa fora do quadro não
    // perde a forma que ela tem.
    const { tree } = mundo([]);
    expect(lequeDaCaixa(tree, [], "dispersor")).toBe("reto");
  });
});
