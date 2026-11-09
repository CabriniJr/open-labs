import { describe, expect, it } from "vitest";
import { buscarNaCidade, BUSCAS_REAIS, CLASSES_DE_BUSCA, FICHAS_REAIS, trabalhoPorDistancia } from "./buscas.js";
import { linhaReta, maisPerto, tempoEmTexto, tracado } from "./cidade.js";
import { saoPaulo } from "./dados.js";

const c = saoPaulo();
const poi = (id: string) => c.pois.find((p) => p.id === id)!.no;

/** Bellman-Ford: a referência escrita de outro jeito — relaxa todas as arestas até nada mudar. */
function referencia(origem: number): Float64Array {
  const d = new Float64Array(c.n).fill(Number.POSITIVE_INFINITY);
  d[origem] = 0;
  for (let mudou = true; mudou; ) {
    mudou = false;
    for (let e = 0; e < c.m; e += 1) {
      const nd = d[c.de[e]!]! + c.peso[e]!;
      if (nd < d[c.para[e]!]!) {
        d[c.para[e]!] = nd;
        mudou = true;
      }
    }
  }
  return d;
}

describe("a cidade", () => {
  it("é São Paulo de verdade: o recorte, os pontos de interesse e o crédito do OSM", () => {
    expect(c.n).toBeGreaterThan(1500);
    expect(c.m).toBeGreaterThan(3000);
    expect(c.pois.map((p) => p.nome)).toEqual(expect.arrayContaining(["MASP", "Copan", "Theatro Municipal", "Catedral da Sé", "Mercadão"]));
    expect(c.credito).toMatch(/OpenStreetMap/);
    // ≈ 4 × 4,4 km
    expect(c.largura).toBeGreaterThan(3800);
    expect(c.altura).toBeGreaterThan(4000);
  });

  it("todo cruzamento alcança todo outro (componente fortemente conexa)", () => {
    const d = referencia(0);
    expect([...d].every(Number.isFinite)).toBe(true);
  });

  it("o traçado de uma aresta começa e termina nos cruzamentos dela", () => {
    const t = tracado(c, 10);
    expect([t[0], t[1]]).toEqual([c.x[c.de[10]!], c.y[c.de[10]!]]);
    expect([t.at(-2), t.at(-1)]).toEqual([c.x[c.para[10]!], c.y[c.para[10]!]]);
    expect(maisPerto(c, c.x[42]!, c.y[42]!)).toBe(42);
    expect(tempoEmTexto(1234)).toBe("2 min 03 s");
  });
});

describe("as buscas nas ruas de verdade", () => {
  it("os três exatos acham o tempo da referência, entre muitos pares", () => {
    for (let k = 0; k < 6; k += 1) {
      const o = (k * 331) % c.n;
      const ref = referencia(o);
      for (let j = 0; j < 8; j += 1) {
        const dd = (k * 977 + j * 419 + 13) % c.n;
        for (const b of ["dijkstra", "astar", "bidirectional"] as const) {
          expect(buscarNaCidade(c, b, o, dd).tempo, `${b} ${o}→${dd}`).toBeCloseTo(ref[dd]!, 6);
        }
      }
    }
  });

  it("a rota devolvida é contínua e soma o tempo que diz", () => {
    for (const b of BUSCAS_REAIS) {
      const r = buscarNaCidade(c, b, poi("masp"), poi("mercadao"));
      expect(r.rota[0]).toBe(poi("masp"));
      expect(r.rota.at(-1)).toBe(poi("mercadao"));
      r.arestas.forEach((e, k) => {
        expect(c.de[e]).toBe(r.rota[k]);
        expect(c.para[e]).toBe(r.rota[k + 1]);
      });
      expect(r.arestas.reduce((s, e) => s + c.peso[e]!, 0)).toBeCloseTo(r.tempo, 6);
    }
  });

  it("MASP → Mercadão: a competição diz o que cada classe promete", () => {
    const r = Object.fromEntries(BUSCAS_REAIS.map((b) => [b, buscarNaCidade(c, b, poi("masp"), poi("mercadao"))])) as Record<(typeof BUSCAS_REAIS)[number], ReturnType<typeof buscarNaCidade>>;
    const otimo = r.dijkstra.tempo;
    expect(r.astar.tempo).toBeCloseTo(otimo, 6);
    expect(r.bidirectional.tempo).toBeCloseTo(otimo, 6);
    // A* e a bidirecional olham menos da cidade que o Dijkstra.
    expect(r.astar.resolvidos).toBeLessThan(r.dijkstra.resolvidos);
    expect(r.bidirectional.resolvidos).toBeLessThan(r.dijkstra.resolvidos);
    // Os rápidos: nunca abaixo do ótimo; o A* ×2 fica dentro de 2×.
    expect(r.greedy.tempo).toBeGreaterThanOrEqual(otimo);
    expect(r.weighted.tempo).toBeGreaterThanOrEqual(otimo);
    expect(r.weighted.tempo).toBeLessThanOrEqual(2 * otimo);
    expect(r.greedy.resolvidos).toBeLessThan(r.astar.resolvidos);
    // BFS: menos cruzamentos que qualquer um, e não o menor tempo garantido.
    for (const b of BUSCAS_REAIS) expect(r.bfs.rota.length).toBeLessThanOrEqual(r[b].rota.length);
    expect(r.bfs.tempo).toBeGreaterThanOrEqual(otimo);
  });

  it("Dijkstra resolve em ordem de tempo não decrescente", () => {
    const r = buscarNaCidade(c, "dijkstra", poi("copan"), poi("liberdade"));
    const ds = r.passos.filter((p) => p.t === "settle").map((p) => (p.t === "settle" ? p.d : 0));
    expect(ds).toEqual([...ds].sort((a, b) => a - b));
  });

  it("toda linha de pseudocódigo citada existe na ficha do algoritmo", () => {
    for (const b of BUSCAS_REAIS) {
      const r = buscarNaCidade(c, b, poi("masp"), poi("copan"));
      const linhas = FICHAS_REAIS[b].pseudo.length - 1;
      for (const p of r.passos) expect(p.linha).toBeLessThanOrEqual(linhas);
    }
    for (const classe of Object.values(CLASSES_DE_BUSCA)) expect(classe.buscas.length).toBeGreaterThanOrEqual(2);
  });

  it("o Big-O do mapa: o Dijkstra cresce com a área, o A* bem menos", () => {
    const pontos = trabalhoPorDistancia(c, ["dijkstra", "astar"], 40);
    const longe = pontos.slice(-10);
    const perto = pontos.slice(0, 10);
    const media = (xs: typeof pontos, b: string) => xs.reduce((s, p) => s + p.resolvidos[b]!, 0) / xs.length;
    expect(media(longe, "dijkstra")).toBeGreaterThan(3 * media(perto, "dijkstra"));
    expect(media(longe, "astar")).toBeLessThan(media(longe, "dijkstra"));
    expect(pontos[0]!.distancia).toBeLessThanOrEqual(pontos.at(-1)!.distancia);
    expect(linhaReta(c, 0, 0)).toBe(0);
  });

  it("origem igual ao destino: rota de um ponto, tempo zero", () => {
    for (const b of BUSCAS_REAIS) {
      const r = buscarNaCidade(c, b, 5, 5);
      expect(r.tempo).toBe(0);
      expect(r.rota).toEqual([5]);
    }
    expect(() => buscarNaCidade(c, "dijkstra", -1, 3)).toThrow(RangeError);
  });
});
