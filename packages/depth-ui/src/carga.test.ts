import { describe, expect, it } from "vitest";
import { casasDaFila, comprimentoDaCarga, fila, formaDaCarga, itensDoFeixe } from "./Stage.js";

/**
 * A forma da carga vem da largura do fio, que o modelo declara.
 *
 * Antes disto tudo era o mesmo círculo, e a única diferença entre uma palavra
 * de 32 bits e um vai-um de um bit era a tinta. A transformação — que é o que
 * estes labs existem para mostrar — acontecia dentro da caixa, invisível.
 */
describe("a forma da carga", () => {
  it("um fio de uma via leva um ponto, e não uma barra", () => {
    expect(comprimentoDaCarga(1, 4)).toBe(0);
    expect(comprimentoDaCarga(undefined, 4)).toBe(0);
  });

  it("um barramento leva uma barra, e ela cresce com a largura", () => {
    expect(comprimentoDaCarga(4, 4)).toBeGreaterThan(0);
    expect(comprimentoDaCarga(32, 4)).toBeGreaterThan(comprimentoDaCarga(4, 4));
  });

  it("cresce por ordem de grandeza, e tem teto", () => {
    // Entre 1 e 8 há uma lição; entre 24 e 32 não há nenhuma. Linear faria a
    // carga de 32 atravessar a tela inteira.
    const de1a8 = comprimentoDaCarga(8, 4) - comprimentoDaCarga(1, 4);
    const de24a32 = comprimentoDaCarga(32, 4) - comprimentoDaCarga(24, 4);
    expect(de1a8).toBeGreaterThan(de24a32);
    expect(comprimentoDaCarga(4096, 4)).toBeLessThanOrEqual(4 * 5);
  });
});

describe("o feixe anda em fila", () => {
  it("os itens ficam num eixo só, espaçados e centrados", () => {
    // A roseta dizia "são vários" e mais nada. A fila diz também que eles
    // ocupam comprimento — que é o que torna "a esteira encheu" desenhável.
    const posicoes = fila(4, 7);
    expect(posicoes).toHaveLength(4);
    expect(new Set(posicoes).size).toBe(4);
    // Centrada: a soma das posições é zero.
    expect(posicoes.reduce((total, p) => total + p, 0)).toBeCloseTo(0);
    // E o passo é o mesmo entre quaisquer dois vizinhos.
    const passos = posicoes.slice(1).map((p, i) => p - posicoes[i]!);
    for (const passo of passos) expect(passo).toBeCloseTo(passos[0]!);
  });

  it("um item só fica no meio, e não deslocado", () => {
    expect(fila(1, 7)).toEqual([0]);
  });

  it("o feixe tem teto: acima dele quem conta é o rótulo", () => {
    expect(itensDoFeixe(3)).toBe(3);
    expect(itensDoFeixe(500)).toBe(itensDoFeixe(50));
    expect(itensDoFeixe(0)).toBe(1);
  });
});

describe("qual forma a carga toma", () => {
  it("a largura declarada ganha de tudo", () => {
    expect(formaDaCarga({ comprimento: 12, emPacote: true, quantos: 5 })).toBe("barra");
  });

  it("o canal serializa: o que o atravessa vira documento", () => {
    expect(formaDaCarga({ comprimento: 0, emPacote: true, quantos: 5 })).toBe("pacote");
  });

  it("peso maior que um é feixe; um é unidade", () => {
    expect(formaDaCarga({ comprimento: 0, emPacote: false, quantos: 2 })).toBe("feixe");
    expect(formaDaCarga({ comprimento: 0, emPacote: false, quantos: 1 })).toBe("unidade");
  });
});

describe("a fila com casas", () => {
  it("sem capacidade declarada não há casa nenhuma — a barra continua", () => {
    expect(casasDaFila(0.5, undefined)).toBeUndefined();
  });

  it("capacidade grande demais volta para a barra: mil casas viram textura", () => {
    expect(casasDaFila(0.5, 2048)).toBeUndefined();
    expect(casasDaFila(0.5, 24)).toBeDefined();
  });

  it("as ocupadas saem do nível, e nunca passam do total", () => {
    expect(casasDaFila(0.5, 4)).toEqual({ total: 4, ocupadas: 2 });
    expect(casasDaFila(1, 4)).toEqual({ total: 4, ocupadas: 4 });
    expect(casasDaFila(3, 4)).toEqual({ total: 4, ocupadas: 4 });
    expect(casasDaFila(0, 4)).toEqual({ total: 4, ocupadas: 0 });
    expect(casasDaFila(undefined, 4)).toEqual({ total: 4, ocupadas: 0 });
  });

  it("capacidade zero não desenha casa: fila que não cabe nada não é fila", () => {
    expect(casasDaFila(0, 0)).toBeUndefined();
  });
});
