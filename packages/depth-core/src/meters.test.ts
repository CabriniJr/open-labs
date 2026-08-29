// packages/depth-core/src/meters.test.ts
import { describe, expect, it } from "vitest";
import { boundaryCrossings, portCount, portWeight } from "./meters.js";
import { spec } from "./meters.test-fixture.js";
import { World } from "./world.js";

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
