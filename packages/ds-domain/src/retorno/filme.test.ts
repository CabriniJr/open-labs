import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import dados from "./dados.json" with { type: "json" };
import { filmeDoRetorno } from "./filme.js";
import { analisar, metricasDeClassificacao, type Base } from "./modelo.js";

const base = dados as unknown as Base;

describe("filme do retorno", () => {
  const film = filmeDoRetorno(base);
  const a = analisar(base);

  it("termina com a matriz de confusão do modelo, e as quatro casas somam o teste", () => {
    const fim = frameAt(film, film.duration);
    const m = metricasDeClassificacao(a.partes.teste.map((s) => s.voltou_em_7_dias), a.probabilidade, 0.5);
    const casas = ["vp", "fp", "fn", "vn"].map((k) => fim.entities.find((e) => e.spec.id === `m:${k}`)!);
    expect(casas.every((e) => Number(e.state.opacity) > 0.5)).toBe(true);
    expect(casas.reduce((s, e) => s + Number(e.state.label), 0)).toBe(a.partes.teste.length);
    expect(fim.detail!.classificacao!.F1).toBeCloseTo(m.F1, 9);
  });

  it("no capítulo da reta, o detalhe traz as métricas da regressão linear", () => {
    const reta = film.chapters.find((c) => c.id === "line")!;
    const d = frameAt(film, reta.end - 1).detail!;
    expect(d.regressao!.R2).toBeCloseTo(a.regressao.R2, 9);
    expect(d.teste!.pessoas).toBe(base.referencia.pessoas_no_teste.length);
  });

  it("na divisão, os pontos do treino ficam apagados e os do teste não", () => {
    const div = film.chapters.find((c) => c.id === "split")!;
    const q = frameAt(film, div.end - 1);
    const pontos = q.entities.filter((e) => /^s:\d+$/.test(e.spec.id));
    expect(pontos.some((e) => Number(e.state.dim) > 0.5)).toBe(true);
    expect(pontos.some((e) => Number(e.state.dim) < 0.1)).toBe(true);
  });
});
