// packages/depth-core/src/scheduler.property.test.ts
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { boundaryCrossings } from "./meters.js";
import { spec as fronteiraSpec } from "./meters.test-fixture.js";
import { DROP } from "./model.js";
import { indexTree } from "./tree.js";
import type { TreeIndex } from "./tree.js";
import { initialWorld, stepWorld } from "./scheduler.js";
import { spec } from "./scheduler.test-fixture.js";

const tree = indexTree(spec.root);
const params = fc.record({
  rate: fc.integer({ min: 0, max: 1 }),
  keepAll: fc.integer({ min: 0, max: 1 }),
});

function rodar(ticks: number, p: Record<string, number>) {
  let estado = initialWorld(tree);
  for (let i = 0; i < ticks; i += 1) estado = stepWorld(spec, tree, estado, p);
  return estado;
}

const fronteira = indexTree(fronteiraSpec.root);

function rodarFronteira(ticks: number) {
  let estado = initialWorld(fronteira);
  for (let i = 0; i < ticks; i += 1) {
    estado = stepWorld(fronteiraSpec, fronteira, estado, fronteiraSpec.params);
  }
  return estado;
}

/**
 * O rótulo que um lado de uma mensagem deve receber num foco, derivado do zero
 * a partir de `tree.parent`. É a segunda opinião: se ele viesse de meters.ts,
 * o teste e o código concordariam mesmo estando os dois errados.
 */
function rotulo(indice: TreeIndex, foco: string, ponta: string): string {
  if (ponta === DROP) return DROP;
  if (ponta === foco) return foco;
  let cursor: string | undefined = ponta;
  while (cursor !== undefined) {
    const acima: string | undefined = indice.parent.get(cursor);
    if (acima === foco) return cursor;
    cursor = acima;
  }
  return "outside";
}

describe("propriedades do tick", () => {
  it("é determinístico: a mesma entrada dá o mesmo mundo, sempre", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), params, (ticks, p) => {
        expect(rodar(ticks, p)).toEqual(rodar(ticks, p));
      }),
    );
  });

  it("nunca muta o estado que recebeu, em nenhum tick", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), params, (ticks, p) => {
        const antes = rodar(ticks, p);
        const foto = JSON.stringify(antes);
        stepWorld(spec, tree, antes, p);
        expect(JSON.stringify(antes)).toBe(foto);
      }),
    );
  });

  it("o tick anda exatamente um por passo", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), params, (ticks, p) => {
        expect(rodar(ticks, p).tick).toBe(ticks);
      }),
    );
  });

  it("todo id de mensagem em trânsito é único", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), params, (ticks, p) => {
        const ids = rodar(ticks, p).flight.map((f) => f.message.id);
        expect(new Set(ids).size).toBe(ids.length);
      }),
    );
  });

  it("o livro-caixa só cresce — travessia de porta não desconta", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), params, (ticks, p) => {
        const antes = rodar(ticks, p);
        const depois = stepWorld(spec, tree, antes, p);
        for (const [porta, valor] of Object.entries(antes.ledger)) {
          expect(depois.ledger[porta] ?? 0).toBeGreaterThanOrEqual(valor);
        }
      }),
    );
  });

  it("toda chave do livro-caixa declara o eixo dela", () => {
    // Os dois eixos moram em espaços de nome separados: sem prefixo, um nó que
    // emitisse na porta "in" somaria por cima das chegadas dele.
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30 }), params, (ticks, p) => {
        for (const chave of Object.keys(rodar(ticks, p).ledger)) {
          expect(chave.startsWith("in:") || chave.startsWith("out:")).toBe(true);
        }
      }),
    );
  });

  it("o eixo das chegadas nunca supera o que foi de fato emitido", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), params, (ticks, p) => {
        const estado = rodar(ticks, p);
        const chegadas = Object.entries(estado.ledger)
          .filter(([k]) => k.startsWith("in:") && !k.endsWith(".weight"))
          .reduce((soma, [, v]) => soma + v, 0);
        const saidas = Object.entries(estado.ledger)
          .filter(([k]) => k.startsWith("out:") && !k.endsWith(".weight") && !k.endsWith(".unwired"))
          .reduce((soma, [, v]) => soma + v, 0);
        // o que chegou já saiu de alguém; o resto está em trânsito ou foi descartado
        expect(chegadas).toBeLessThanOrEqual(saidas);
      }),
    );
  });

  it("a vista agregada nunca inventa: toda travessia está de fato em trânsito", () => {
    // usa a fixture de meters.test.ts, que tem um pipeline aninhado ("box"),
    // e percorre TODO foco possível — não só a raiz — para que um bug que só
    // aparece um nível abaixo não fique escondido.
    const focos = [...fronteira.byId.keys()];

    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30 }), (ticks) => {
        const estado = rodarFronteira(ticks);
        const emTransito = new Set(estado.flight.map((f) => f.id));

        for (const foco of focos) {
          for (const crossing of boundaryCrossings(fronteira, estado, foco)) {
            expect(emTransito.has(crossing.item.id)).toBe(true);
          }
        }
      }),
    );
  });

  it("a vista agregada também não omite: é exatamente o trânsito que muda de rótulo", () => {
    // Não inventar é metade da tese; a outra metade é não esconder. Sem esta
    // igualdade, um medidor que jogasse fora toda travessia com um lado "fora
    // daqui" — o que entra e o que sai de um bloco aninhado, ou seja, o L0
    // inteiro — passaria na suíte sem ninguém notar.
    //
    // O rótulo é RECALCULADO aqui, e não importado de meters.ts: um teste que
    // chama a mesma função do código erra junto com ela e não prova nada.
    const focos = [...fronteira.byId.keys()];

    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30 }), (ticks) => {
        const estado = rodarFronteira(ticks);

        for (const foco of focos) {
          const esperado = estado.flight
            .map((f) => ({
              id: f.id,
              fromVisible: rotulo(fronteira, foco, f.from),
              toVisible: rotulo(fronteira, foco, f.to),
            }))
            .filter((c) => c.fromVisible !== c.toVisible);

          const obtido = boundaryCrossings(fronteira, estado, foco).map((c) => ({
            id: c.item.id,
            fromVisible: c.fromVisible,
            toVisible: c.toVisible,
          }));

          expect(obtido).toEqual(esperado);
        }
      }),
    );
  });

  it("a igualdade acima não é vazia: há travessia em algum foco", () => {
    // Uma igualdade entre dois conjuntos vazios passa sempre. Este teste é o
    // que garante que a propriedade de cima está de fato olhando alguma coisa.
    const focos = [...fronteira.byId.keys()];
    const total = focos.reduce(
      (soma, foco) => soma + boundaryCrossings(fronteira, rodarFronteira(12), foco).length,
      0,
    );
    expect(total).toBeGreaterThan(0);
  });
});
