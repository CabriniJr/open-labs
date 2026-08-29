// packages/depth-core/src/scheduler.test-fixture.ts
//
// Fixture compartilhada entre scheduler.test.ts e scheduler.property.test.ts.
// Duplicá-la nos dois arquivos deixaria as cópias divergirem com o tempo, e aí
// os dois testes passariam a falar de mundos diferentes.
import { DROP } from "./model.js";
import type { ObjectSpec, WorldSpec } from "./model.js";

/** Emite uma mensagem por tick enquanto `rate` for 1. */
export const source: ObjectSpec = {
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
export const gate: ObjectSpec = {
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

export const sink: ObjectSpec = {
  id: "sink",
  kind: "sink",
  label: "sink",
  leaf: true,
  init: () => ({ got: 0 }),
  behavior: (state, inbox) => ({ state: { got: (state as { got: number }).got + inbox.length }, out: [] }),
};

export const spec: WorldSpec = {
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
