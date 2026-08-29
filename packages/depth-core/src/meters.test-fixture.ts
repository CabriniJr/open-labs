// packages/depth-core/src/meters.test-fixture.ts
//
// Fixture compartilhada entre meters.test.ts e scheduler.property.test.ts: tem
// um pipeline aninhado ("box") além da raiz, então dá para percorrer mais de
// um foco e exercitar tráfego que fica escondido dentro de um bloco fechado.
import { DROP } from "./model.js";
import type { ObjectSpec, WorldSpec } from "./model.js";

export const relay = (id: string): ObjectSpec => ({
  id,
  kind: "sink",
  label: id,
  leaf: true,
  init: () => ({}),
  behavior: (state, inbox) => ({ state, out: inbox.map((m) => ({ port: "out", message: m })) }),
});

export const spec: WorldSpec = {
  id: "m",
  seed: 3,
  edgeTicks: 2,
  root: {
    id: "root",
    kind: "composite",
    label: "root",
    children: [
      {
        id: "src",
        kind: "source",
        label: "src",
        leaf: true,
        init: () => ({}),
        behavior: (state, _inbox, ctx) => ({ state, out: [{ port: "out", message: ctx.emit("blob", 2) }] }),
      },
      {
        id: "box",
        kind: "pipeline",
        label: "box",
        children: [relay("a"), relay("b")],
      },
      relay("end"),
    ],
  },
  wires: [
    { from: "src", port: "out", to: "box" },
    { from: "box", port: "out", to: "end" },
    { from: "end", port: "sunk", to: DROP },
  ],
  params: {},
};
