// packages/depth-core/src/scheduler.test.ts
import { describe, expect, it } from "vitest";
import type { WorldSpec } from "./model.js";
import { indexTree } from "./tree.js";
import { initialWorld, stepWorld } from "./scheduler.js";
import { spec } from "./scheduler.test-fixture.js";

const tree = indexTree(spec.root);
const run = (ticks: number, params = spec.params) => {
  let state = initialWorld(spec, tree);
  for (let i = 0; i < ticks; i += 1) state = stepWorld(spec, tree, state, params);
  return state;
};

describe("stepWorld", () => {
  it("a origem emite e a mensagem entra em trânsito", () => {
    const state = run(1);
    expect(state.tick).toBe(1);
    expect(state.flight).toHaveLength(1);
    expect(state.flight[0]?.to).toBe("gate");
  });

  it("a mensagem só chega depois de edgeTicks", () => {
    // emitida no tick 1, com edgeTicks 2 ela só é entregue no tick 3
    expect(run(2).ledger["gate.keep"]).toBeUndefined();
    expect(run(3).ledger["gate.keep"]).toBe(1);
  });

  it("conta cada travessia de porta no livro-caixa", () => {
    const state = run(6);
    expect(state.ledger["src.out"]).toBe(6);
    expect(state.ledger["gate.keep"]).toBe(4);
  });

  it("o descarte some: não vira entrega em lugar nenhum", () => {
    const state = run(6, { rate: 1, keepAll: 0 });
    expect(state.ledger["gate.drop"]).toBe(4);
    expect(state.ledger["gate.keep"]).toBeUndefined();
    expect((state.nodes["sink"] as { got: number }).got).toBe(0);
  });

  it("ids de mensagem são determinísticos e únicos", () => {
    const a = run(5).flight.map((f) => f.message.id);
    const b = run(5).flight.map((f) => f.message.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it("nunca muta o estado que recebeu", () => {
    const before = initialWorld(spec, tree);
    const snapshot = JSON.stringify(before);
    stepWorld(spec, tree, before, spec.params);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("saída sem fio é contada à parte, não confundida com descarte", () => {
    const solto: WorldSpec = {
      ...spec,
      wires: [{ from: "src", port: "out", to: "gate" }],
    };
    const t = indexTree(solto.root);
    let estado = initialWorld(solto, t);
    for (let i = 0; i < 6; i += 1) estado = stepWorld(solto, t, estado, solto.params);

    expect(estado.ledger["gate.keep"]).toBeGreaterThan(0);
    expect(estado.ledger["gate.keep.unwired"]).toBe(estado.ledger["gate.keep"]);
    expect(estado.ledger["gate.drop.unwired"]).toBeUndefined();
  });
});
