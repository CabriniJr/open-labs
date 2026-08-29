// packages/depth-core/src/scheduler.property.test.ts
//
// A propriedade que ainda não dá para escrever aqui é a central — a vista
// agregada é exatamente o tráfego que cruzou as portas. Ela precisa de
// `boundaryCrossings`, que chega na Task 5. A ausência é sequenciamento, não
// esquecimento.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { indexTree } from "./tree.js";
import { initialWorld, stepWorld } from "./scheduler.js";
import { spec } from "./scheduler.test-fixture.js";

const tree = indexTree(spec.root);
const params = fc.record({
  rate: fc.integer({ min: 0, max: 1 }),
  keepAll: fc.integer({ min: 0, max: 1 }),
});

function rodar(ticks: number, p: Record<string, number>) {
  let estado = initialWorld(spec, tree);
  for (let i = 0; i < ticks; i += 1) estado = stepWorld(spec, tree, estado, p);
  return estado;
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
});
