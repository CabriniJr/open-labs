import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ALGORITMOS, custo, entrada, ErroDeVetor, FORMATOS, instante, lerVetor, ordenar, podio } from "./ordenacao.js";

describe("ordenação", () => {
  it("cada algoritmo ordena igual ao sort da linguagem, em todo formato", () => {
    for (const formato of FORMATOS) {
      for (const n of [1, 2, 3, 8, 33]) {
        const v = entrada(formato, n, 11);
        const esperado = [...v].sort((a, b) => a - b);
        for (const a of ALGORITMOS) expect(ordenar(a, v).saida, `${a} ${formato} n=${n}`).toEqual(esperado);
      }
    }
  });

  it("property: qualquer vetor de inteiros sai ordenado, por qualquer algoritmo", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 40 }), (v) => {
        const esperado = [...v].sort((a, b) => a - b);
        for (const a of ALGORITMOS) expect(ordenar(a, v).saida).toEqual(esperado);
      }),
      { numRuns: 200 },
    );
  });

  it("property: em qualquer instante da fita, o vetor é uma permutação da entrada (trocas)", () => {
    // O merge escreve a partir da auxiliar e por um instante duplica um valor;
    // para os outros quatro, a invariante vale passo a passo.
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 16 }), fc.nat(), (v, k) => {
        const ordenada = [...v].sort((a, b) => a - b);
        for (const a of ["bubble", "insertion", "selection", "quick"] as const) {
          const t = ordenar(a, v);
          const passo = t.ops.length === 0 ? 0 : k % (t.ops.length + 1);
          expect([...instante(t, passo).v].sort((x, y) => x - y)).toEqual(ordenada);
        }
      }),
    );
  });

  it("repetir a fita até o fim dá a saída, e as contagens batem com as do algoritmo", () => {
    for (const a of ALGORITMOS) {
      const t = ordenar(a, entrada("random", 24, 5));
      const fim = instante(t, t.ops.length);
      expect(fim.v).toEqual(t.saida);
      expect([fim.comparacoes, fim.trocas, fim.escritas]).toEqual([t.comparacoes, t.trocas, t.escritas]);
      expect(fim.terminou).toBe(true);
    }
  });

  it("casos conhecidos: as contagens são as das fórmulas", () => {
    const n = 16;
    // Bolha e inserção em vetor ordenado: n − 1 comparações, zero trocas.
    for (const a of ["bubble", "insertion"] as const) {
      const t = ordenar(a, entrada("sorted", n));
      expect([t.comparacoes, t.trocas]).toEqual([n - 1, 0]);
    }
    // Seleção compara n(n−1)/2 em QUALQUER entrada.
    for (const f of FORMATOS) expect(ordenar("selection", entrada(f, n, 2)).comparacoes).toBe((n * (n - 1)) / 2);
    // Inversão total: bolha e inserção fazem n(n−1)/2 trocas.
    expect(ordenar("bubble", entrada("reversed", n)).trocas).toBe((n * (n - 1)) / 2);
    expect(ordenar("insertion", entrada("reversed", n)).trocas).toBe((n * (n - 1)) / 2);
    // Quicksort com pivô no fim, vetor já ordenado: o pior caso, n(n−1)/2 comparações.
    expect(ordenar("quick", entrada("sorted", n)).comparacoes).toBe((n * (n - 1)) / 2);
    // Merge escreve n·log2(n) vezes quando n é potência de 2.
    expect(ordenar("merge", entrada("random", n, 1)).escritas).toBe(n * Math.log2(n));
  });

  it("memória: o merge usa n posições extras, os outros nenhuma além da pilha", () => {
    expect(ordenar("merge", entrada("random", 32, 1)).memoriaExtra).toBe(32);
    expect(ordenar("bubble", entrada("random", 32, 1)).memoriaExtra).toBe(0);
    // Quicksort: profundidade de recursão — n − 1 no ordenado, bem menos no aleatório.
    expect(ordenar("quick", entrada("sorted", 32)).memoriaExtra).toBe(31);
    expect(ordenar("quick", entrada("random", 32, 1)).memoriaExtra).toBeLessThan(16);
  });

  it("a mesma semente dá o mesmo vetor; outra semente dá outro", () => {
    expect(entrada("random", 20, 3)).toEqual(entrada("random", 20, 3));
    expect(entrada("random", 20, 3)).not.toEqual(entrada("random", 20, 4));
    expect(new Set(entrada("few-unique", 50, 1)).size).toBeLessThanOrEqual(4);
  });

  it("no aleatório, os O(n log n) vencem os O(n²); no ordenado, bolha e inserção vencem", () => {
    const aleatorio = podio(ALGORITMOS.map((a) => ordenar(a, entrada("random", 64, 7))));
    expect(aleatorio.slice(0, 2).map((c) => c.algoritmo).sort()).toEqual(["merge", "quick"]);
    const ordenado = podio(ALGORITMOS.map((a) => ordenar(a, entrada("sorted", 64))));
    expect(ordenado.slice(0, 2).map((c) => c.algoritmo).sort()).toEqual(["bubble", "insertion"]);
    expect(ordenado.at(-1)!.algoritmo === "quick" || ordenado.at(-1)!.algoritmo === "selection").toBe(true);
  });

  it("o pódio divide o lugar no empate", () => {
    const p = podio(["bubble", "insertion"].map((a) => ordenar(a as "bubble", entrada("sorted", 8))));
    expect(p.map((c) => c.lugar)).toEqual([1, 1]);
    expect(custo(ordenar("bubble", entrada("sorted", 8)))).toBe(7);
  });

  it("gravar: false conta igual, sem guardar a fita", () => {
    const v = entrada("random", 200, 9);
    const com = ordenar("merge", v);
    const sem = ordenar("merge", v, false);
    expect(sem.ops).toHaveLength(0);
    expect([sem.comparacoes, sem.escritas]).toEqual([com.comparacoes, com.escritas]);
  });

  it("recusa, com a posição, o que não é um vetor da corrida", () => {
    expect(lerVetor("5, 3 8;1")).toEqual([5, 3, 8, 1]);
    expect(() => lerVetor("  ")).toThrow(ErroDeVetor);
    expect(() => lerVetor("4 x 2")).toThrow(/item 2/);
    expect(() => lerVetor("1.5")).toThrow(/item 1/);
    expect(() => lerVetor(Array.from({ length: 65 }, () => "1").join(" "))).toThrow(/at most 64/);
    expect(() => entrada("random", 0)).toThrow(ErroDeVetor);
    expect(() => entrada("random", 5000)).toThrow(/4096/);
  });
});
