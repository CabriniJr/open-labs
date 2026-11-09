import { frameAt, type Film } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeDoCrescimento } from "./crescimento/filme.js";
import { filmeDoGrafo } from "./grafo/filme.js";
import { filmeDoTroco } from "./troco/filme.js";
import { SISTEMAS } from "./troco/troco.js";

const fimDe = <D,>(film: Film<D>) => frameAt(film, film.duration);

describe("os filmes saem do modelo", () => {
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
