import { describe, expect, it } from "vitest";
import type { Grafo } from "../grafo/grafo.js";
import { buscar, buscarNoMapa, BUSCAS, chaveDaRua, ErroDeBusca, fotoDaBusca, mapaDaCidade, reta, ruaEntre, velocidadeDe } from "./caminho.js";

/** Dijkstra de referência, escrito de outro jeito (força bruta por relaxação repetida). */
function referencia(g: Grafo, origem: string, destino: string): number {
  const d = new Map(g.nos.map((n) => [n.id, Number.POSITIVE_INFINITY]));
  d.set(origem, 0);
  for (let k = 0; k < g.nos.length; k += 1) {
    for (const a of g.arestas) {
      if (d.get(a.de)! + a.peso < d.get(a.para)!) d.set(a.para, d.get(a.de)! + a.peso);
      if (!g.dirigido && d.get(a.para)! + a.peso < d.get(a.de)!) d.set(a.de, d.get(a.para)! + a.peso);
    }
  }
  return d.get(destino)!;
}

describe("caminho no mapa", () => {
  const mapa = mapaDaCidade();
  const r = Object.fromEntries(BUSCAS.map((b) => [b, buscarNoMapa(b, mapa)])) as Record<(typeof BUSCAS)[number], ReturnType<typeof buscarNoMapa>>;

  it("a competição: cada um acerta o que promete, e só o que promete", () => {
    const otimo = referencia(mapa.grafo, "home", "harbor");
    expect(r.dijkstra.custo).toBe(otimo);
    expect(r.astar.custo).toBe(otimo);
    // BFS: menos ruas que qualquer outro, e mais minutos que o ótimo.
    expect(r.bfs.ruas).toBeLessThan(r.dijkstra.ruas);
    expect(r.bfs.custo).toBeGreaterThan(otimo);
    // Guloso: cai na balsa — o lugar que PARECE perto.
    expect(r.greedy.caminho).toContain("pier");
    expect(r.greedy.custo).toBeGreaterThan(r.bfs.custo);
    // A* visita menos que Dijkstra para a mesma resposta.
    expect(r.astar.expandidos).toBeLessThan(r.dijkstra.expandidos);
  });

  it("o custo devolvido é a soma das ruas do caminho", () => {
    for (const b of BUSCAS) {
      const res = r[b];
      let soma = 0;
      for (let k = 1; k < res.caminho.length; k += 1) soma += ruaEntre(mapa, res.caminho[k - 1]!, res.caminho[k]!)!.peso;
      expect(soma, b).toBe(res.custo);
      expect(res.caminho[0]).toBe("home");
      expect(res.caminho.at(-1)).toBe("harbor");
    }
  });

  it("h nunca passa do tempo real (é o que faz o A* ótimo)", () => {
    const v = velocidadeDe(mapa.grafo);
    const porId = new Map(mapa.grafo.nos.map((n) => [n.id, n]));
    for (const a of mapa.grafo.arestas) expect(reta(porId.get(a.de)!, porId.get(a.para)!) / v).toBeLessThanOrEqual(a.peso + 1e-9);
  });

  it("property: Dijkstra e A* acham o ótimo entre quaisquer dois lugares, com qualquer trânsito", () => {
    const ids = mapa.grafo.nos.map((n) => n.id);
    for (let s = 1; s <= 6; s += 1) {
      const congest = Object.fromEntries(mapa.ruas.map((rua, k) => [chaveDaRua(rua), 1 + ((k * 7 + s * 3) % 5)]));
      const m = mapaDaCidade(congest);
      for (const o of ids) for (const d of ids) {
        const ref = referencia(m.grafo, o, d);
        expect(buscarNoMapa("dijkstra", m, o, d).custo).toBe(ref);
        expect(buscarNoMapa("astar", m, o, d).custo).toBe(ref);
      }
    }
  });

  it("trânsito numa rua muda a resposta: engarrafe a Coast Rd e o caminho ótimo troca", () => {
    const m = mapaDaCidade({ "museum-harbor": 6 });
    const d = buscarNoMapa("dijkstra", m);
    expect(d.caminho).not.toContain("museum");
    expect(d.custo).toBeGreaterThan(r.dijkstra.custo);
  });

  it("a foto da busca: no fim, os expandidos são os do resultado, e a ordem é a de saída", () => {
    for (const b of BUSCAS) {
      const res = r[b];
      const fim = fotoDaBusca(res, res.eventos.length);
      expect(fim.fechados).toHaveLength(res.expandidos);
      expect(fim.fechados[0]).toBe("home");
      expect(fim.fechados.at(-1)).toBe("harbor");
      expect(fim.terminou).toBe(true);
      expect(fotoDaBusca(res, 0).fronteira.map((f) => f.no)).toEqual(["home"]);
    }
    // Dijkstra fecha em ordem de custo não decrescente: é a promessa dele.
    const gs = r.dijkstra.eventos.filter((e) => e.tipo === "expand").map((e) => (e.tipo === "expand" ? e.g : 0));
    expect(gs).toEqual([...gs].sort((a, b) => a - b));
  });

  it("recusa peso negativo em Dijkstra e A*, e diz por quê", () => {
    const g: Grafo = { ...mapa.grafo, arestas: mapa.grafo.arestas.map((a, k) => (k === 0 ? { ...a, peso: -3 } : a)) };
    expect(() => buscar("dijkstra", g, "home", "harbor")).toThrow(ErroDeBusca);
    expect(() => buscar("astar", g, "home", "harbor")).toThrow(/Bellman-Ford/);
    expect(() => buscar("bfs", g, "home", "harbor")).not.toThrow();
    expect(() => buscar("bfs", mapa.grafo, "home", "mars")).toThrow(/mars/);
  });

  it("sem caminho, diz que não há", () => {
    const g: Grafo = { nos: mapa.grafo.nos, arestas: [], dirigido: false, ponderado: true };
    const res = buscar("dijkstra", g, "home", "harbor");
    expect(res.caminho).toEqual([]);
    expect(res.custo).toBe(Number.POSITIVE_INFINITY);
  });
});
