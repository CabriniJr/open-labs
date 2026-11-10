import { describe, expect, it } from "vitest";
import { buscarNaCidade, BUSCAS_REAIS } from "./buscas.js";
import { saoPaulo } from "./dados.js";
import { CENARIOS, melhorOrdem, rodarCenario, rotaComParadas } from "./paradas.js";

const c = saoPaulo();
const poi = (id: string) => c.pois.find((p) => p.id === id)!.no;

describe("rotas com paradas", () => {
  it("a melhor ordem nunca é pior que a ordem em que as paradas foram largadas", () => {
    const paradas = [poi("masp"), poi("liberdade"), poi("copan"), poi("mercadao")];
    const { ordem, tempo, tempos } = melhorOrdem(c, paradas);
    expect(ordem[0]).toBe(paradas[0]);
    expect([...ordem].sort()).toEqual([...paradas].sort());
    const naOrdemDada = tempos[0]![1]! + tempos[1]![2]! + tempos[2]![3]!;
    expect(tempo).toBeLessThanOrEqual(naOrdemDada);
    // Força bruta conferindo: nenhuma das 6 ordens bate a escolhida.
    for (const meio of [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]) {
      const ord = [0, ...meio];
      let t = 0;
      for (let k = 1; k < ord.length; k += 1) t += tempos[ord[k - 1]!]![ord[k]!]!;
      expect(tempo).toBeLessThanOrEqual(t + 1e-9);
    }
  });

  it("fixar o fim mantém a última parada no lugar", () => {
    const paradas = [poi("masp"), poi("liberdade"), poi("copan"), poi("mercadao")];
    expect(melhorOrdem(c, paradas, true).ordem.at(-1)).toBe(poi("mercadao"));
  });

  it("a rota é a soma das pernas, e a fita marca a perna de cada passo", () => {
    const ordem = [poi("masp"), poi("theatro-municipal"), poi("liberdade")];
    const r = rotaComParadas(c, "astar", ordem);
    expect(r.pernas).toHaveLength(2);
    expect(r.tempo).toBeCloseTo(buscarNaCidade(c, "dijkstra", ordem[0]!, ordem[1]!).tempo + buscarNaCidade(c, "dijkstra", ordem[1]!, ordem[2]!).tempo, 6);
    expect(r.passos.filter((p) => p.perna === 1).length).toBe(r.pernas[1]!.passos.length);
    expect(r.arestas.length).toBe(r.pernas[0]!.arestas.length + r.pernas[1]!.arestas.length);
  });

  it("os cenários respondem quem é melhor onde, e os exatos sempre empatam no tempo", () => {
    const vencedoras = new Set<string>();
    for (const cen of CENARIOS) {
      const r = rodarCenario(c, cen);
      const exatas = r.linhas.filter((l) => ["dijkstra", "astar", "bidirectional"].includes(l.busca));
      for (const l of exatas) expect(l.excesso, `${cen.id} ${l.busca}`).toBeCloseTo(0, 6);
      for (const l of r.linhas) expect(l.excesso).toBeGreaterThanOrEqual(-1e-6);
      vencedoras.add(r.melhorExata);
      expect(r.linhas).toHaveLength(BUSCAS_REAIS.length);
    }
    // Não há uma busca exata que vença todo cenário: é o que o lab existe para mostrar.
    expect(vencedoras.size).toBeGreaterThan(1);
  });

  it("recusa menos de duas ou mais de quatro paradas", () => {
    expect(() => melhorOrdem(c, [1])).toThrow(RangeError);
    expect(() => melhorOrdem(c, [1, 2, 3, 4, 5])).toThrow(/at most 4/);
  });
});
