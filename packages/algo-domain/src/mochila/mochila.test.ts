import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CATALOGO,
  CENARIOS_DA_MOCHILA,
  chamadasComMemoria,
  chamadasSemMemoria,
  ErroDeMochila,
  forcaBruta,
  gulosa,
  itensDoCenario,
  mochila,
  PASSO,
  porQue,
  type ItemDaMochila,
} from "./mochila.js";

const cenario = (id: string) => {
  const c = CENARIOS_DA_MOCHILA.find((x) => x.id === id)!;
  return { itens: itensDoCenario(c), sessao: c.sessao };
};

const arbItens = fc
  .uniqueArray(
    fc.record({ id: fc.string({ minLength: 1, maxLength: 4 }), minutos: fc.integer({ min: 1, max: 12 }).map((k) => k * PASSO), pontos: fc.integer({ min: 0, max: 10 }) }),
    { selector: (r) => r.id, maxLength: 9 },
  )
  .map((rs) => rs.map((r): ItemDaMochila => ({ ...r, nome: r.id })));
const arbSessao = fc.integer({ min: 0, max: 36 }).map((k) => k * PASSO);

describe("mochila da sessão", () => {
  it("Rafa, 90 min: a tabela faz 14 pontos, a gulosa 13 — os mesmos números do planejador em Python", () => {
    const { itens, sessao } = cenario("rafa");
    const m = mochila(itens, sessao);
    expect(m.pontos).toBe(14);
    expect(m.minutos).toBe(90);
    expect(gulosa(itens, sessao).pontos).toBe(13);
  });

  it("a armadilha menor: a gulosa pega os dois mais densos e sobra tempo que ninguém usa", () => {
    const { itens, sessao } = cenario("trap");
    const g = gulosa(itens, sessao);
    expect(g.pontos).toBe(6);
    expect(g.minutos).toBe(40);
    const m = mochila(itens, sessao);
    expect(m.pontos).toBe(7);
    expect(m.escolhidos.map((k) => itens[k]!.id)).toEqual(["how-work-grows", "three-pillars"]);
  });

  it("Dona Cida, 60 min: as duas concordam", () => {
    const { itens, sessao } = cenario("cida");
    expect(mochila(itens, sessao).pontos).toBe(9);
    expect(gulosa(itens, sessao).pontos).toBe(9);
  });

  it("property: tabela = força bruta = memória, e a reconstrução cabe e soma o ótimo", () => {
    fc.assert(
      fc.property(arbItens, arbSessao, (itens, sessao) => {
        const m = mochila(itens, sessao);
        expect(m.pontos).toBe(forcaBruta(itens, sessao));
        expect(m.minutos).toBeLessThanOrEqual(sessao);
        expect(m.escolhidos.reduce((s, k) => s + itens[k]!.pontos, 0)).toBe(m.pontos);
        expect(gulosa(itens, sessao).pontos).toBeLessThanOrEqual(m.pontos);
      }),
    );
  });

  it("o caminho de volta desce uma linha por lab e termina na linha 0", () => {
    const { itens, sessao } = cenario("rafa");
    const m = mochila(itens, sessao);
    expect(m.caminho).toHaveLength(itens.length + 1);
    expect(m.caminho[0]).toEqual([itens.length, sessao / PASSO]);
    expect(m.caminho.at(-1)![0]).toBe(0);
  });

  it("porQue explica a célula: o máximo entre deixar e levar", () => {
    const { itens, sessao } = cenario("trap");
    const m = mochila(itens, sessao);
    const p = porQue(itens, m.T, 3, sessao / PASSO);
    expect(p.valor).toBe(Math.max(p.deixa, p.leva ?? -1));
    expect(porQue(itens, m.T, 1, 0).leva).toBeNull(); // nada cabe em 0 minutos
  });

  it("o custo contado: sem memória explode, com memória não passa das células", () => {
    const itens = CATALOGO;
    const sem = chamadasSemMemoria(itens, 180);
    const com = chamadasComMemoria(itens, 180);
    const m = mochila(itens, 180);
    expect(m.celulas).toBe(12 * 37);
    expect(sem).toBeGreaterThan(2000);
    expect(com).toBeLessThan(sem / 2);
    expect(com).toBeLessThanOrEqual(2 * (m.celulas + 1) + 1);
  });

  it("recusa o que não é uma sessão", () => {
    expect(() => mochila([], 7)).toThrow(ErroDeMochila);
    expect(() => mochila([], 185)).toThrow(/180/);
    expect(() => mochila([{ id: "a", nome: "A", minutos: 12, pontos: 1 }], 60)).toThrow(/multiple of 5/);
    expect(() => mochila([{ id: "a", nome: "A", minutos: 10, pontos: 11 }], 60)).toThrow(/points/);
    const a = CATALOGO[0]!;
    expect(() => mochila([a, a], 60)).toThrow(/twice/);
    expect(() => mochila([...CATALOGO, { id: "x", nome: "X", minutos: 5, pontos: 1 }], 60)).toThrow(/at most/);
  });
});
