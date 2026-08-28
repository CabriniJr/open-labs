import { describe, expect, it } from "vitest";
import { createRandom } from "./random.js";

describe("createRandom", () => {
  it("produz a mesma sequência para a mesma seed", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produz sequências diferentes para seeds diferentes", () => {
    const a = createRandom(1);
    const b = createRandom(2);
    expect(a()).not.toEqual(b());
  });

  it("produz valores no intervalo [0, 1)", () => {
    const r = createRandom(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
