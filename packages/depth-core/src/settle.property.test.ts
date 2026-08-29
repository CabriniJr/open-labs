// packages/depth-core/src/settle.property.test.ts
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Wire, WorldState } from "./model.js";
import { initialWorld, stepWorld } from "./scheduler.js";
import { settleOrder } from "./settle-graph.js";
import { spec } from "./settle.test-fixture.js";
import { indexTree } from "./tree.js";

const tree = indexTree(spec.root);

function rodar(wires: readonly Wire[]): WorldState {
  const mundo = { ...spec, wires };
  let estado = initialWorld(tree);
  for (let i = 0; i < 6; i += 1) estado = stepWorld(mundo, tree, estado, mundo.params);
  return estado;
}

describe("propriedades da acomodação", () => {
  it("a ordem em que os fios são declarados não muda o resultado", () => {
    // Se mudasse, dois mundos idênticos com os fios escritos em ordem diferente
    // produziriam runs diferentes — e o modelo passaria a depender de como o
    // autor digitou, que é a definição de resultado não confiável.
    const esperado = rodar(spec.wires);

    fc.assert(
      fc.property(
        fc.shuffledSubarray([...spec.wires], { minLength: spec.wires.length }),
        (wires) => {
          const obtido = rodar(wires);
          expect(obtido.nodes).toEqual(esperado.nodes);
          expect(obtido.ledger).toEqual(esperado.ledger);
          expect(obtido.substeps).toEqual(esperado.substeps);
        },
      ),
    );
  });

  it("a ordem topológica é sempre válida: ninguém aparece antes de quem o alimenta", () => {
    const arbFios = fc
      .array(fc.tuple(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 })), {
        maxLength: 12,
      })
      // Só arestas de menor para maior: garante DAG por construção, que é o
      // pré-requisito que `validateWorld` impõe ao mundo de verdade.
      .map((pares) =>
        pares
          .filter(([a, b]) => a < b)
          .map(([a, b]): Wire => ({ from: `n${a}`, port: "out", to: `n${b}`, timing: "settle" })),
      );

    fc.assert(
      fc.property(arbFios, (wires) => {
        const posicao = new Map(settleOrder(wires).map((n, i) => [n.id, i]));
        for (const wire of wires) {
          const de = posicao.get(wire.from);
          const para = posicao.get(wire.to as string);
          if (de === undefined || para === undefined) continue;
          expect(de).toBeLessThan(para);
        }
      }),
    );
  });

  it("a profundidade é o caminho mais longo, nunca o mais curto", () => {
    const wires: Wire[] = [
      { from: "a", port: "out", to: "b", timing: "settle" },
      { from: "b", port: "out", to: "c", timing: "settle" },
      { from: "c", port: "out", to: "d", timing: "settle" },
      { from: "a", port: "out2", to: "d", timing: "settle" },
    ];
    const profundidade = new Map(settleOrder(wires).map((n) => [n.id, n.depth]));
    // Há um atalho a -> d, mas "d" só está pronto quando o caminho longo chega.
    expect(profundidade.get("d")).toBe(3);
  });

  it("ids de mensagem não se repetem, com as duas fases emitindo no mesmo tick", () => {
    // Só o que NASCEU neste tick: o que continua em voo reaparece em `flight`
    // tick após tick, e contá-lo de novo acusaria repetição que não existe.
    let estado = initialWorld(tree);
    const vistos: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      estado = stepWorld(spec, tree, estado, spec.params);
      for (const item of estado.flight) {
        if (item.sent === estado.tick) vistos.push(item.message.id);
      }
    }
    expect(vistos.length).toBeGreaterThan(0);
    expect(new Set(vistos).size).toBe(vistos.length);
  });
});
