// packages/depth-core/src/scheduler.test.ts
import { describe, expect, it } from "vitest";
import { DROP } from "./model.js";
import type { ObjectSpec, WorldSpec } from "./model.js";
import { indexTree } from "./tree.js";
import { initialWorld, stepWorld } from "./scheduler.js";

/** Emite uma mensagem por tick enquanto `rate` for 1. */
const source: ObjectSpec = {
  id: "src",
  kind: "source",
  label: "src",
  leaf: true,
  init: () => ({ made: 0 }),
  behavior: (state, _inbox, ctx) => {
    const s = state as { made: number };
    if (ctx.params.rate !== 1) return { state: s, out: [] };
    return { state: { made: s.made + 1 }, out: [{ port: "out", message: ctx.emit("blob") }] };
  },
};

/** Manda para "keep" quando `keepAll` é 1, senão para "drop". */
const gate: ObjectSpec = {
  id: "gate",
  kind: "router",
  label: "gate",
  leaf: true,
  init: () => ({}),
  behavior: (state, inbox, ctx) => ({
    state,
    out: inbox.map((m) => ({ port: ctx.params.keepAll === 1 ? "keep" : "drop", message: m })),
  }),
};

const sink: ObjectSpec = {
  id: "sink",
  kind: "sink",
  label: "sink",
  leaf: true,
  init: () => ({ got: 0 }),
  behavior: (state, inbox) => ({ state: { got: (state as { got: number }).got + inbox.length }, out: [] }),
};

const spec: WorldSpec = {
  id: "t",
  seed: 1,
  edgeTicks: 2,
  root: { id: "root", kind: "composite", label: "root", children: [source, gate, sink] },
  wires: [
    { from: "src", port: "out", to: "gate" },
    { from: "gate", port: "keep", to: "sink" },
    { from: "gate", port: "drop", to: DROP },
  ],
  params: { rate: 1, keepAll: 1 },
};

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
});
