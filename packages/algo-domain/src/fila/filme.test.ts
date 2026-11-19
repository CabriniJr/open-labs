import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { rodarFila } from "./fila.js";
import { CHEGADAS_DO_FILME, filmeDaFila, VAGAS_DO_FILME } from "./filme.js";

const rodada = (politica: "recusar" | "expulsar", estrutura: "anel" | "vetor") =>
  rodarFila({ estrutura, politica, carga: "burst", semente: 1, vagas: VAGAS_DO_FILME, servico: 2, chegadas: CHEGADAS_DO_FILME });

describe("filme da fila", () => {
  it("termina com os números do modelo: os mesmos atendidos, as mesmas perdas, e a conta de cada estrutura", () => {
    for (const politica of ["recusar", "expulsar"] as const) {
      const film = filmeDaFila(politica);
      const d = frameAt(film, film.duration).detail!;
      const anel = rodada(politica, "anel");
      const vetor = rodada(politica, "vetor");
      expect(d.atendidos, politica).toEqual(anel.ordemAtendida);
      expect(d.perdidos, politica).toEqual(anel.ordemPerdida);
      expect(d.opsAnel).toBe(anel.ops);
      expect(d.opsVetor).toBe(vetor.ops);
      expect(d.fila).toEqual([]);
      expect(anel.perdidos, "o filme precisa encher a fila").toBeGreaterThan(0);
    }
  });

  it("a barra do vetor termina cheia e a do anel, menor, na proporção das operações", () => {
    const film = filmeDaFila("recusar");
    const fim = frameAt(film, film.duration);
    const p = (id: string) => Number(fim.entities.find((e) => e.spec.id === id)!.state.progress);
    expect(p("barra:v")).toBeCloseTo(1, 5);
    expect(p("barra:a")).toBeCloseTo(rodada("recusar", "anel").ops / rodada("recusar", "vetor").ops, 5);
  });

  it("a conta começa em zero: no primeiro quadro, as duas barras estão vazias", () => {
    const film = filmeDaFila("recusar");
    const inicio = frameAt(film, 0);
    for (const id of ["barra:a", "barra:v"]) expect(Number(inicio.entities.find((e) => e.spec.id === id)!.state.progress), id).toBe(0);
  });

  it("recusar perde quem chegou; expulsar perde quem esperava", () => {
    const fimDe = (politica: "recusar" | "expulsar") => {
      const film = filmeDaFila(politica);
      return frameAt(film, film.duration).detail!;
    };
    const r = fimDe("recusar");
    const e = fimDe("expulsar");
    expect(Math.min(...r.perdidos)).toBeGreaterThan(Math.max(...e.perdidos));
    expect(filmeDaFila("recusar").chapters.find((c) => c.id === "full")!.title).toMatch(/turned away/);
    expect(filmeDaFila("expulsar").chapters.find((c) => c.id === "full")!.title).toMatch(/dropped/);
  });

  it("no meio do filme, as vagas do anel no palco são as do modelo", () => {
    const film = filmeDaFila("recusar");
    const cheia = film.chapters.find((c) => c.id === "full")!;
    const quadro = frameAt(film, cheia.start + 1);
    const ocupadas = quadro.entities.filter((e) => /^vaga:a:\d+$/.test(e.spec.id) && e.state.label !== "").length;
    expect(ocupadas).toBe(VAGAS_DO_FILME);
    expect(quadro.detail!.fila).toHaveLength(VAGAS_DO_FILME);
  });
});
