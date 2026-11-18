import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import dados from "./dados.json" with { type: "json" };
import { analisar, ErroDoModelo, metricasDeClassificacao, preparar, regressaoLinear, resolver, retornoPorCaminhada, type Base } from "./modelo.js";

const base = dados as unknown as Base;
const ref = base.referencia;
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

describe("quem volta ao telecentro", () => {
  it("dados.json está em dia com o CSV e a referência do notebook", () => {
    const novo = execFileSync(process.execPath, [join(raiz, "packages", "ds-domain", "gerar.mjs"), "--check"], { encoding: "utf8" });
    expect(novo).toMatch(/em dia/);
    expect(readFileSync(join(raiz, "data-science", "dados", "sessoes_telecentro.csv"), "utf8").trim().split("\n")).toHaveLength(base.colunas.id_sessao.length + 1);
  });

  it("a divisão por pessoa é a do notebook, e ninguém fica nos dois lados", () => {
    const a = analisar(base);
    expect(a.partes.pessoasNosDois).toBe(0);
    expect(new Set(a.partes.teste.map((s) => s.id_aluno)).size).toBe(ref.pessoas_no_teste.length);
  });

  it("a regressão linear dá os coeficientes e as métricas do scikit-learn", () => {
    const a = analisar(base);
    expect(a.linear.intercepto).toBeCloseTo(ref.linear.coeficientes.intercepto!, 6);
    a.linear.nomes.forEach((n, k) => expect(a.linear.pesos[k], n).toBeCloseTo(ref.linear.coeficientes[n]!, 6));
    expect(a.regressao.MAE).toBeCloseTo(ref.linear.MAE, 6);
    expect(a.regressao.RMSE).toBeCloseTo(ref.linear.RMSE, 6);
    expect(a.regressao.R2).toBeCloseTo(ref.linear["R²"], 6);
    expect(a.linhaDeBase.R2).toBeLessThan(0.01);
  });

  it("a logística dá os coeficientes e as métricas do scikit-learn (o notebook usa tol=1e-8)", () => {
    const a = analisar(base);
    expect(a.logistica.intercepto).toBeCloseTo(ref.logistica.coeficientes.intercepto!, 3);
    a.logistica.nomes.forEach((n, k) => expect(a.logistica.pesos[k], n).toBeCloseTo(ref.logistica.coeficientes[n]!, 3));
    const m = metricasDeClassificacao(a.partes.teste.map((s) => s.voltou_em_7_dias), a.probabilidade, 0.5);
    expect(m.acuracia).toBeCloseTo(ref.logistica["acurácia"], 6);
    expect(m.precisao).toBeCloseTo(ref.logistica["precisão"], 6);
    expect(m.recall).toBeCloseTo(ref.logistica.recall, 6);
    expect(m.F1).toBeCloseTo(ref.logistica.F1, 6);
  });

  it("dividir por linha vaza: a mesma pessoa nos dois lados", () => {
    const a = analisar(base, { divisao: "linha" });
    expect(a.partes.pessoasNosDois).toBeGreaterThan(50);
  });

  it("andar mais reduz o retorno previsto", () => {
    const r = retornoPorCaminhada(analisar(base), [5, 15, 30]);
    expect(r[0]).toBeGreaterThan(r[1]!);
    expect(r[1]).toBeGreaterThan(r[2]!);
  });

  it("a preparação trata o cronômetro ligado e mantém a idade faltando para imputar", () => {
    const s = preparar(base);
    expect(s.filter((x) => x.ritmo === null).length).toBeGreaterThan(0);
    expect(s.filter((x) => x.idade === null).length).toBeGreaterThan(0);
    expect(s.every((x) => x.ritmo === null || x.ritmo <= 4)).toBe(true);
  });

  it("recusa o que não dá para ajustar", () => {
    const { treino } = analisar(base).partes;
    expect(() => regressaoLinear(treino, [])).toThrow(ErroDoModelo);
    expect(() => regressaoLinear([], ["idade"])).toThrow(/empty/);
    expect(() => resolver([[1, 2], [2, 4]], [1, 2])).toThrow(/collinear/);
  });

  it("o corte move a troca entre precisão e recall", () => {
    const a = analisar(base);
    const y = a.partes.teste.map((s) => s.voltou_em_7_dias);
    const baixo = metricasDeClassificacao(y, a.probabilidade, 0.3);
    const alto = metricasDeClassificacao(y, a.probabilidade, 0.7);
    expect(baixo.recall).toBeGreaterThan(alto.recall);
    expect(alto.precisao).toBeGreaterThan(baixo.precisao);
  });
});
