// packages/depth-core/src/meters.test.ts
import { describe, expect, it } from "vitest";
import { DROP } from "./model.js";
import type { ObjectSpec, WorldSpec } from "./model.js";
import { boundaryCrossings, portCount, portWeight } from "./meters.js";
import { World } from "./world.js";

const relay = (id: string): ObjectSpec => ({
  id,
  kind: "sink",
  label: id,
  leaf: true,
  init: () => ({}),
  behavior: (state, inbox) => ({ state, out: inbox.map((m) => ({ port: "out", message: m })) }),
});

const spec: WorldSpec = {
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

describe("portCount e portWeight", () => {
  it("leem só o livro-caixa de portas", () => {
    const w = new World(spec);
    w.advance(6);
    expect(portCount(w.state, "src", "out")).toBe(6);
    expect(portWeight(w.state, "src", "out")).toBe(12);
  });

  it("devolvem zero para porta que nunca teve tráfego", () => {
    const w = new World(spec);
    w.advance(6);
    expect(portCount(w.state, "src", "inexistente")).toBe(0);
  });
});

describe("boundaryCrossings", () => {
  it("no foco raiz, mostra o que cruza a fronteira de cada filho", () => {
    const w = new World(spec);
    w.advance(8);
    for (const crossing of boundaryCrossings(w.tree, w.state, "root")) {
      expect(crossing.fromVisible).not.toBe(crossing.toVisible);
    }
  });

  it("esconde o tráfego interno de um bloco fechado", () => {
    const w = new World(spec);
    w.advance(8);
    // a → b acontece dentro de "box": não pode aparecer no foco raiz
    const atRoot = boundaryCrossings(w.tree, w.state, "root");
    expect(atRoot.some((c) => c.item.from === "a" && c.item.to === "b")).toBe(false);
    // mas aparece quando o foco é "box"
    const inBox = boundaryCrossings(w.tree, w.state, "box");
    const internal = w.state.flight.some((f) => f.from === "a" && f.to === "b");
    expect(inBox.some((c) => c.item.from === "a" && c.item.to === "b")).toBe(internal);
  });

  it("é um subconjunto do que está realmente em trânsito: a vista não inventa", () => {
    const w = new World(spec);
    for (let tick = 1; tick <= 20; tick += 1) {
      w.seek(tick);
      const flying = new Set(w.state.flight.map((f) => f.id));
      for (const focus of ["root", "box"]) {
        for (const crossing of boundaryCrossings(w.tree, w.state, focus)) {
          expect(flying.has(crossing.item.id)).toBe(true);
        }
      }
    }
  });
});
