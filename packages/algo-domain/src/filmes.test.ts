import { frameAt, type Film } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeDaBusca } from "./caminho/filme.js";
import { BUSCAS, buscarNoMapa, mapaDaCidade } from "./caminho/caminho.js";
import { filmeDoCrescimento } from "./crescimento/filme.js";
import { filmeDoGrafo } from "./grafo/filme.js";
import { ALGORITMOS, entrada, ordenar } from "./ordenacao/ordenacao.js";
import { filmeDaOrdenacao, FORMATOS_DO_FILME } from "./ordenacao/filme.js";
import { filmeDoTroco } from "./troco/filme.js";
import { SISTEMAS } from "./troco/troco.js";

/** A posição x de uma peça no fim do filme (caixa + dx). */
function xNoFim(film: Film, id: string): number {
  const fim = frameAt(film, film.duration);
  const e = fim.entities.find((x) => x.spec.id === id)!;
  return (e.spec as { box: { x: number } }).box.x + Number(e.state.dx);
}

const fimDe = <D,>(film: Film<D>) => frameAt(film, film.duration);

describe("os filmes saem do modelo", () => {
  it("ordenação: no fim do filme as barras estão em ordem crescente na estante, em todo algoritmo e formato", () => {
    for (const a of ALGORITMOS) {
      for (const formato of FORMATOS_DO_FILME) {
        const film = filmeDaOrdenacao(a, formato);
        const valores = entrada(formato, 8, 3);
        const porX = [...valores].sort((p, q) => xNoFim(film, `item:${p}`) - xNoFim(film, `item:${q}`));
        expect(porX, `${a} ${formato}`).toEqual([...valores].sort((p, q) => p - q));
        // Ninguém fica na auxiliar.
        for (const v of valores) expect(Number(fimDe(film).entities.find((e) => e.spec.id === `item:${v}`)!.state.dy)).toBe(0);
        // O detalhe do fim conta o mesmo que o modelo.
        const t = ordenar(a, valores);
        const d = fimDe(film).detail!;
        expect([d.comparacoes, d.trocas, d.escritas]).toEqual([t.comparacoes, t.trocas, t.escritas]);
      }
    }
  });

  it("ordenação: um capítulo por fase do modelo, mais a abertura e a conta", () => {
    for (const a of ALGORITMOS) expect(filmeDaOrdenacao(a).chapters).toHaveLength(ordenar(a, entrada("random", 8, 3)).fases.length + 2);
    expect(() => filmeDaOrdenacao("bubble", "few-unique")).toThrow(/distinct/);
  });

  it("ordenação: só o merge usa a auxiliar", () => {
    const usa = (a: (typeof ALGORITMOS)[number]) => {
      const film = filmeDaOrdenacao(a);
      return film.chapters.some((c) => c.steps.some((s) => (s.detail?.naAuxiliar ?? 0) > 0));
    };
    expect(ALGORITMOS.filter(usa)).toEqual(["merge"]);
  });

  it("busca: cada lugar resolvido sobe o tempo que levou para chegar nele, e a rota é a do modelo", () => {
    const mapa = mapaDaCidade();
    for (const b of BUSCAS) {
      const r = buscarNoMapa(b, mapa);
      const film = filmeDaBusca(b, mapa);
      const fim = fimDe(film);
      for (const e of r.eventos) {
        if (e.tipo !== "expand") continue;
        const no = fim.entities.find((x) => x.spec.id === `lugar:${e.no}`)!;
        expect(Number(no.state.lift), `${b} ${e.no}`).toBeCloseTo(e.g * 1.6);
        expect(no.state.tone).toBe("conduit");
      }
      const rotas = fim.entities.filter((x) => x.spec.id.startsWith("rota:"));
      expect(rotas).toHaveLength(r.ruas);
      for (const x of rotas) expect(Number(x.state.progress)).toBe(1);
    }
  });

  it("busca: o placar no detalhe é o mesmo para as quatro, e marca o ótimo", () => {
    const placares = BUSCAS.map((b) => fimDe(filmeDaBusca(b)).detail!.placar);
    for (const p of placares) expect(p).toEqual(placares[0]);
    expect(placares[0]!.filter((l) => l.otimo).map((l) => l.busca).sort()).toEqual(["astar", "dijkstra"]);
  });

  it("crescimento: a exponencial não roda depois de 20, e o filme diz isso", () => {
    const film = filmeDoCrescimento();
    const n4096 = film.chapters.find((c) => c.id === "n-4096")!;
    const detalhe = n4096.steps.at(-1)?.detail ?? frameAt(film, n4096.start + 10).detail!;
    const exp = detalhe.linhas.find((l) => l.classe === "exponential")!;
    expect(exp.medido).toBe(false);
    expect(n4096.body).toMatch(/was not run/);
    const barra = frameAt(film, n4096.end - 1).entities.find((e) => e.spec.id === "barra:exponential")!;
    expect(barra.state.label).toMatch(/not run/);
  });

  it("crescimento: a barra quadrática termina mais comprida que a linear, que termina mais comprida que a log", () => {
    const fim = fimDe(filmeDoCrescimento());
    const p = (c: string) => Number(fim.entities.find((e) => e.spec.id === `barra:${c}`)!.state.progress);
    expect(p("quadratic")).toBeGreaterThan(p("nlogn"));
    expect(p("nlogn")).toBeGreaterThan(p("linear"));
    expect(p("linear")).toBeGreaterThan(p("log"));
    expect(p("log")).toBeGreaterThan(p("constant"));
  });

  it("grafo: o painel do capítulo da direção mostra a matriz assimétrica", () => {
    const film = filmeDoGrafo();
    const dir = film.chapters.find((c) => c.id === "direction")!;
    const d = frameAt(film, dir.start + 5).detail!;
    expect(d.dirigido).toBe(true);
    expect(d.matriz.celulas).toEqual([
      [null, 5],
      [null, null],
    ]);
    const desvio = film.chapters.find((c) => c.id === "detour")!;
    expect(frameAt(film, desvio.start + 5).detail!.matriz.ids).toEqual(["A", "B", "C"]);
  });

  it("troco: em cima a resposta gulosa, embaixo a ótima, e as contagens são as do modelo", () => {
    for (const s of SISTEMAS) {
      const film = filmeDoTroco(s.id);
      const fim = fimDe(film);
      const visiveis = (prefixo: string) => fim.entities.filter((e) => new RegExp(`^${prefixo}:\\d+$`).test(e.spec.id) && Number(e.state.opacity) > 0.5).length;
      const d = fim.detail!;
      expect(visiveis("g"), s.id).toBe(d.gulosas.length);
      expect(visiveis("o"), s.id).toBe(d.otimas?.length ?? 0);
    }
    const toy = fimDe(filmeDoTroco("toy")).detail!;
    expect(toy.gulosas).toEqual([4, 1, 1]);
    expect(toy.otimas).toEqual([3, 3]);
    expect(toy.veredito).toMatch(/optimum is 2/);
    expect(fimDe(filmeDoTroco("brl")).detail!.veredito).toMatch(/agree/);
    expect(fimDe(filmeDoTroco("no-one")).detail!.veredito).toMatch(/stuck/);
  });
});
