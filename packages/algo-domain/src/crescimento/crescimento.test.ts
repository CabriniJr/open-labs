import { describe, expect, it } from "vitest";
import { buscaBinaria, buscaLinear, CLASSES, curva, duracao, FICHAS_DAS_CLASSES, medir, somaDeSubconjunto, tempoEstimado, TAMANHOS } from "./crescimento.js";

describe("crescimento", () => {
  it("as buscas acham o que existe e contam o que viram", () => {
    const v = [1, 3, 5, 7, 9, 11];
    expect(buscaBinaria(v, 7).indice).toBe(3);
    expect(buscaLinear(v, 7)).toEqual({ indice: 3, ops: 4 });
    expect(buscaBinaria(v, 4).indice).toBe(-1);
    expect(somaDeSubconjunto([2, 4, 6], 10).achou).toBe(true);
    expect(somaDeSubconjunto([2, 4, 6], 1)).toEqual({ achou: false, ops: 8 });
  });

  it("o teste da duplicação separa as classes pela razão medida", () => {
    const ultima = (c: (typeof CLASSES)[number]) => curva(c).filter((m) => m.razao !== undefined).at(-1)!.razao!;
    expect(ultima("constant")).toBe(1);
    expect(ultima("log")).toBeGreaterThan(1);
    expect(ultima("log")).toBeLessThan(1.15);
    expect(ultima("linear")).toBe(2);
    expect(ultima("nlogn")).toBeGreaterThan(2);
    expect(ultima("nlogn")).toBeLessThan(2.3);
    expect(ultima("quadratic")).toBeCloseTo(4, 1);
    expect(ultima("exponential")).toBeGreaterThan(100);
  });

  it("a medida bate com a fórmula de referência onde a fórmula é exata", () => {
    for (const n of TAMANHOS) {
      expect(medir("constant", n)).toBe(1);
      expect(medir("linear", n)).toBe(n);
      expect(medir("log", n)).toBe(FICHAS_DAS_CLASSES.log.referencia(n));
      expect(medir("quadratic", n)).toBe(FICHAS_DAS_CLASSES.quadratic.referencia(n));
    }
    for (const n of [2, 4, 8, 16]) expect(medir("exponential", n)).toBe(2 ** n);
    // O merge fica abaixo de n·log2(n) e acima da metade disso.
    for (const n of TAMANHOS.slice(2)) {
      const m = medir("nlogn", n);
      expect(m).toBeLessThanOrEqual(FICHAS_DAS_CLASSES.nlogn.referencia(n));
      expect(m).toBeGreaterThan(FICHAS_DAS_CLASSES.nlogn.referencia(n) / 2);
    }
  });

  it("a exponencial para em 20, e a curva diz isso em vez de inventar", () => {
    const c = curva("exponential");
    expect(c.find((m) => m.n === 16)!.ops).toBe(65536);
    expect(c.find((m) => m.n === 32)!.ops).toBeUndefined();
    expect(() => somaDeSubconjunto(Array.from({ length: 21 }, () => 2), 1)).toThrow(RangeError);
  });

  it("o tempo estimado traduz a classe em palavras", () => {
    expect(duracao(tempoEstimado("linear", 1000))).toBe("1.0 µs");
    expect(duracao(tempoEstimado("exponential", 64))).toMatch(/years$/);
    expect(duracao(Number.POSITIVE_INFINITY)).toMatch(/universe/);
    expect(duracao(2e-8)).toBe("20 ns");
  });
});
