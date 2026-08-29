// packages/depth-core/src/settle.test.ts
import { describe, expect, it } from "vitest";
import { initialWorld, stepWorld } from "./scheduler.js";
import { spec } from "./settle.test-fixture.js";
import { indexTree } from "./tree.js";

const tree = indexTree(spec.root);

function rodar(ticks: number) {
  let estado = initialWorld(tree);
  for (let i = 0; i < ticks; i += 1) estado = stepWorld(spec, tree, estado, spec.params);
  return estado;
}

describe("fase de acomodação", () => {
  it("atravessa dois estágios combinacionais dentro do mesmo tick", () => {
    // A fonte emite no tick 1 e a mensagem chega em "a" no tick 2 (edgeTicks 1).
    // Aí ela atravessa a -> b -> acc SEM custar tick nenhum: no fim do tick 2 o
    // acumulador já viu 0 + 1 + 1 = 2.
    expect((rodar(2).nodes.acc as { ultimo: number }).ultimo).toBe(2);
  });

  it("o que acomoda não guarda: o estado devolvido na acomodação é descartado", () => {
    // "a" e "b" não declaram init, então o estado deles é o objeto vazio da
    // construção. Se a acomodação escrevesse estado, isto mudaria.
    const estado = rodar(4);
    expect(estado.nodes.a).toEqual({});
    expect(estado.nodes.b).toEqual({});
  });

  it("mensagem que acomoda não fica em trânsito: ela chegou dentro do tick", () => {
    const emVoo = rodar(3).flight.map((f) => `${f.from}->${f.to}`);
    expect(emVoo).not.toContain("a->b");
    expect(emVoo).not.toContain("b->acc");
  });

  it("o livro-caixa conta a acomodação como tráfego normal de porta", () => {
    // Acomodar não é ficar invisível: quem emitiu, emitiu.
    const estado = rodar(3);
    expect(estado.ledger["out:a.out"]).toBeGreaterThan(0);
    expect(estado.ledger["in:acc"]).toBeGreaterThan(0);
  });

  it("substeps conta a profundidade do caminho combinacional deste tick", () => {
    // a (0) -> b (1) -> acc (2): três níveis, então três subpassos.
    expect(rodar(2).substeps).toBe(3);
  });

  it("mundo sem aresta acomodada tem zero subpassos e não muda de comportamento", () => {
    const semAcomodar = {
      ...spec,
      wires: spec.wires.map((w) => ({ ...w, timing: "clocked" as const })),
    };
    let estado = initialWorld(tree);
    for (let i = 0; i < 3; i += 1) estado = stepWorld(semAcomodar, tree, estado, spec.params);
    expect(estado.substeps).toBe(0);
  });
});
