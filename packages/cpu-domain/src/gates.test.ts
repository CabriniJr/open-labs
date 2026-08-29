import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { World, shortcutDisagreement } from "@ovh/depth-core";
import { decide, somadorWorld } from "./gates.js";

/**
 * O somador de portas contra a conta.
 *
 * Ele é feito só de XOR, AND e OR, e nenhuma delas sabe somar. Se a conta sai
 * certa, é porque a composição está certa — que é a única coisa que este
 * modelo afirma.
 */
const BITS = 4;

function somar(a: number, b: number, comAtalho = false): { soma: number; vaium: boolean } {
  const mundo = new World(somadorWorld(BITS, comAtalho));
  mundo.setParam("a", a);
  mundo.setParam("b", b);
  // um tick para as entradas saírem, outro para a acomodação atravessar as
  // portas e os bits de saída serem guardados
  mundo.advance(4);
  const estado = mundo.state;
  let soma = 0;
  for (let i = 0; i < BITS; i += 1) {
    if ((estado.nodes[`soma${i}`] as { alto: boolean }).alto) soma |= 1 << i;
  }
  return { soma, vaium: (estado.nodes.vaium as { alto: boolean }).alto };
}

describe("o somador feito de portas lógicas", () => {
  it("o mundo é válido: nenhum laço combinacional entre as portas", () => {
    expect(() => new World(somadorWorld(BITS))).not.toThrow();
  });

  it("soma qualquer par de 4 bits, com vai-um", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 15 }), fc.integer({ min: 0, max: 15 }), (a, b) => {
        const total = a + b;
        const { soma, vaium } = somar(a, b);
        expect(soma).toBe(total & 0b1111);
        expect(vaium).toBe(total > 15);
      }),
    );
  });

  it("a profundidade da acomodação é a cascata do vai-um, e não uma constante", () => {
    // É o ponto pedagógico inteiro: somar custa profundidade, e a profundidade
    // cresce com o número de bits. Um somador que fechasse em profundidade fixa
    // estaria escondendo o que ele cobra.
    const raso = new World(somadorWorld(2));
    raso.setParam("a", 3);
    raso.setParam("b", 3);
    raso.advance(4);

    const fundo = new World(somadorWorld(8));
    fundo.setParam("a", 255);
    fundo.setParam("b", 255);
    fundo.advance(4);

    expect(fundo.state.substeps).toBeGreaterThan(raso.state.substeps);
  });

  it("a linha em zero também é uma linha: 0 + 0 percorre o circuito inteiro", () => {
    // Sob a codificação antiga, 0 + 0 não fazia nada acontecer — nenhuma porta
    // rodava, e o circuito parecia morto. Agora toda linha diz o que vale, a
    // porta roda dizendo zero, e é isso que um somador de verdade faz: o atraso
    // dele é da estrutura, e não do número que passa.
    const zeros = new World(somadorWorld(BITS));
    zeros.setParam("a", 0);
    zeros.setParam("b", 0);
    zeros.advance(4);

    expect(zeros.state.settled["bit0-xor1.out"]?.[0]?.data.bit).toBe(0);
    expect(zeros.state.substeps).toBeGreaterThan(0);

    // E é o MESMO atraso de um caso que acende o circuito todo: se a cascata do
    // vai-um custasse menos com zeros, o modelo estaria medindo o dado e não o
    // caminho.
    const cheio = new World(somadorWorld(BITS));
    cheio.setParam("a", 15);
    cheio.setParam("b", 15);
    cheio.advance(4);
    expect(zeros.state.substeps).toBe(cheio.state.substeps);
  });

  it("a saída de uma porta é o valor dela, e não o fato de ela ter emitido", () => {
    // 1 + 0: o primeiro XOR dá um, e o primeiro AND dá zero. As duas rodaram e
    // as duas emitiram — o que as separa é o que elas disseram. Contar emissão
    // não distingue mais as duas, e é por isso que a tela lê o valor.
    const mundo = new World(somadorWorld(BITS));
    mundo.setParam("a", 1);
    mundo.setParam("b", 0);
    mundo.advance(4);
    expect(mundo.state.settled["bit0-xor1.out"]?.[0]?.data.bit).toBe(1);
    expect(mundo.state.settled["bit0-and1.out"]?.[0]?.data.bit).toBe(0);
  });

  it("`not` existe agora, e é ela que a codificação antiga não expressava", () => {
    // Com entrada em zero uma porta antes nem rodava; hoje ela roda e inverte.
    expect(decide("not", 0, 1)).toBe(1);
    expect(decide("not", 1, 1)).toBe(0);
    // E com ela vêm as portas que o silício de fato tem.
    expect(decide("nand", 2, 2)).toBe(0);
    expect(decide("nand", 1, 2)).toBe(1);
    expect(decide("nor", 0, 2)).toBe(1);
    expect(decide("nor", 1, 2)).toBe(0);
  });

  it("réplica é verdade, não rótulo: os N somadores existem", () => {
    const spec = somadorWorld(BITS);
    const somador = spec.root.children?.find((c) => c.id === "somador");
    expect(somador?.replicas).toBe(BITS);
    expect(somador?.children).toHaveLength(BITS);
  });

  it("o atalho de um somador completo concorda com as cinco portas", () => {
    // O que torna isto possível são os bornes: a fiação de fora é a MESMA
    // aberta e fechada, então as duas versões são o mesmo modelo visto de dois
    // jeitos. Sem isso não haveria com o que comparar.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: BITS - 1 }),
        (a, b, bit) => {
          const spec = somadorWorld(BITS, true);
          expect(
            shortcutDisagreement({ ...spec, params: { a, b } }, `bit${bit}`, 6),
          ).toBeNull();
        },
      ),
      { numRuns: 40 },
    );
  });

  it("fechado nos atalhos, a conta é a mesma — e custa menos profundidade", () => {
    // O atalho não é uma segunda verdade: é a mesma conta com menos passos. Se
    // ele mudasse o resultado, o teste de equivalência acima cairia primeiro.
    for (const [a, b] of [
      [0, 0],
      [1, 1],
      [9, 6],
      [15, 15],
    ] as const) {
      expect(somar(a, b, true)).toEqual(somar(a, b, false));
    }
  });
});
