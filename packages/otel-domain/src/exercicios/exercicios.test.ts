import { describe, expect, it } from "vitest";
import * as pacote from "../index.js";
import { CONJUNTOS_DE_EXERCICIOS, exerciciosPorLab } from "./todos.js";
import type { DefinicaoDeExercicio } from "./tipos.js";

/**
 * Todos os conjuntos de exercícios, lidos do índice do pacote.
 *
 * Escrever a lista à mão aqui foi o que esta suíte fez até 16/10/2026, e o
 * preço apareceu na primeira vez que um conjunto novo entrou: as regras abaixo
 * — âncora na spec, dois distratores, id único, arquivo dentro de `labs/` —
 * passaram a valer para um conjunto e a não valer para o outro, sem avisar.
 *
 * A convenção que isto usa é a mesma das varreduras de mundo: nome exportado
 * com prefixo conhecido. Conjunto que não é exportado do índice fica invisível
 * aqui, e é o limite declarado desta checagem.
 */
const CONJUNTOS: readonly (readonly [string, readonly DefinicaoDeExercicio[]])[] =
  Object.entries(CONJUNTOS_DE_EXERCICIOS);

/** Os mesmos nomes, vistos pelo índice do pacote. A guarda cruza os dois. */
const NO_INDICE: readonly string[] = Object.keys(pacote as unknown as Record<string, unknown>)
  .filter((nome) => nome.startsWith("EXERCICIOS_"))
  .sort();

/** Todos os exercícios de todos os conjuntos, para as regras globais. */
const TODOS: readonly DefinicaoDeExercicio[] = CONJUNTOS.flatMap(([, lista]) => lista);

describe("os conjuntos de exercícios", () => {
  it("o barril e o índice do pacote expõem os MESMOS conjuntos", () => {
    /*
      Os dois existem, e por motivo mecânico: o índice puxa `anatomy.mmd?raw`,
      que o transpilador do Playwright não resolve, então o e2e importa o
      barril. O risco de ter dois é um conjunto novo entrar só num deles — e aí
      ou o e2e não cobra a página nova, ou as regras abaixo não valem para ela.

      Zero conjunto seria verde sem medir nada, que é o defeito que a lista
      escrita à mão tinha até 16/10/2026.
    */
    expect(CONJUNTOS.length).toBeGreaterThanOrEqual(2);
    expect(CONJUNTOS.map(([nome]) => nome).sort()).toEqual(NO_INDICE);
  });

  it("a contagem por lab é derivada, e todo lab tem pelo menos um", () => {
    // É o número que o e2e cobra da página. Derivado aqui, não escrito lá.
    const porLab = exerciciosPorLab();
    expect(porLab.size).toBeGreaterThanOrEqual(2);
    for (const [lab, quantos] of porLab) expect(quantos, lab).toBeGreaterThan(0);
  });

  it("todo exercício declara o lab a que pertence, e o id dele não repete entre conjuntos", () => {
    for (const e of TODOS) expect(e.lab.length, e.id).toBeGreaterThan(0);
    const ids = TODOS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("a definição do exercício", () => {
  it("todo bloco carrega a âncora na spec, como os mal-entendidos", () => {
    for (const e of TODOS) {
      expect(e.fonteCerto, e.id).toMatch(/^https:\/\/(opentelemetry\.io|www\.w3\.org)\//u);
      for (const d of e.distratores) {
        expect(d.fonte, d.id).toMatch(/^https:\/\/(opentelemetry\.io|www\.w3\.org)\//u);
      }
    }
  });

  it("cada exercício tem exatamente dois distratores", () => {
    // Um só vira sim/não; três empurram a lacuna para fora da tela.
    for (const e of TODOS) {
      expect(e.distratores.length, e.id).toBe(2);
    }
  });

  it("todo id é único, porque o placar é indexado por ele", () => {
    const ids = TODOS.flatMap((e) => [
      e.id,
      ...e.distratores.map((d) => d.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo exercício aponta para um arquivo dentro de labs/", () => {
    for (const e of TODOS) {
      expect(e.arquivo, e.id).toMatch(/^labs\//u);
    }
  });
});
