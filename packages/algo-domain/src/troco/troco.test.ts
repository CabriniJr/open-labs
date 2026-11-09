import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ErroDeTroco, guloso, lerMoedas, menorContraexemplo, otimo, SISTEMAS, tabela } from "./troco.js";

const sistema = (id: string) => SISTEMAS.find((s) => s.id === id)!.moedas;

describe("troco", () => {
  it("o clássico: {1, 3, 4} para 6 — o guloso dá três moedas, o ótimo duas", () => {
    expect(guloso([1, 3, 4], 6).moedas).toEqual([4, 1, 1]);
    expect(otimo([1, 3, 4], 6).moedas).toEqual([3, 3]);
    expect(menorContraexemplo([1, 3, 4])).toBe(6);
  });

  it("a Inglaterra antes de 1971: 48 pence", () => {
    expect(guloso(sistema("pre-decimal"), 48).moedas).toEqual([30, 12, 6]);
    expect(otimo(sistema("pre-decimal"), 48).moedas).toEqual([24, 24]);
  });

  it("o real é canônico até R$ 5: o guloso nunca perde", () => {
    expect(menorContraexemplo(sistema("brl"))).toBeNull();
  });

  it("sem moeda de 1, há valor que não fecha — e o guloso às vezes desiste do que fecha", () => {
    expect(otimo([5, 7], 3).moedas).toBeNull();
    // 10 = 5 + 5, mas o guloso começa com 7 e fica com 3 sobrando.
    expect(guloso([5, 7], 10).moedas).toBeNull();
    expect(guloso([5, 7], 10).sobra).toBe(3);
    expect(otimo([5, 7], 10).moedas).toEqual([5, 5]);
  });

  it("property: o ótimo soma o valor e nunca usa mais moedas que o guloso", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.integer({ min: 2, max: 40 }), { maxLength: 5 }), fc.integer({ min: 1, max: 200 }), (resto, valor) => {
        const moedas = [1, ...resto];
        const o = otimo(moedas, valor);
        const g = guloso(moedas, valor);
        expect(o.moedas!.reduce((s, m) => s + m, 0)).toBe(valor);
        expect(g.moedas!.reduce((s, m) => s + m, 0)).toBe(valor);
        expect(o.moedas!.length).toBeLessThanOrEqual(g.moedas!.length);
      }),
    );
  });

  it("os passos: o guloso olha cada moeda uma vez; a tabela, cada valor com cada moeda", () => {
    expect(guloso([1, 3, 4], 6).passos).toBe(3);
    expect(tabela([1, 3, 4], 6).passos).toBe(18);
    expect(tabela([1, 3, 4], 6).minimo).toEqual([0, 1, 2, 1, 1, 2, 2]);
  });

  it("recusa moedas e valores fora do lab", () => {
    expect(lerMoedas("10, 1 5")).toEqual([1, 5, 10]);
    expect(() => lerMoedas("")).toThrow(ErroDeTroco);
    expect(() => lerMoedas("1 a")).toThrow(/coin 2/);
    expect(() => lerMoedas("1 0")).toThrow(/between 1/);
    expect(() => lerMoedas("3 3")).toThrow(/twice/);
    expect(() => guloso([1], 0)).toThrow(/amount/);
    expect(() => otimo([1], 501)).toThrow(/500/);
  });
});
