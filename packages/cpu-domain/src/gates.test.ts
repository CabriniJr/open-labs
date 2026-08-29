import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { World, shortcutDisagreement } from "@ovh/depth-core";
import { somadorWorld } from "./gates.js";

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

  it("uma porta só emite quando a saída dela é alta: ausência é zero", () => {
    // 0 + 0 não faz nada acontecer no circuito, e é isso mesmo: sem nível alto
    // em lugar nenhum, nenhuma linha muda de estado.
    const mundo = new World(somadorWorld(BITS));
    mundo.setParam("a", 0);
    mundo.setParam("b", 0);
    mundo.advance(4);
    expect(mundo.state.ledger["out:bit0-xor1.out"]).toBeUndefined();
    expect(mundo.state.substeps).toBe(0);
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
