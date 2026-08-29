// packages/depth-core/src/rng.test.ts
import { describe, expect, it } from "vitest";
import { randomAt } from "./rng.js";

describe("randomAt", () => {
  it("é função pura: mesma entrada, mesma saída, sempre", () => {
    expect(randomAt(7, 42, "gate")).toBe(randomAt(7, 42, "gate"));
  });

  it("não depende de ordem de chamada — é isso que torna o seek exato", () => {
    // sorteando fora de ordem, o valor do tick 42 não muda
    const direto = randomAt(7, 42, "gate");
    for (let t = 0; t < 100; t += 1) randomAt(7, t, "outro");
    expect(randomAt(7, 42, "gate")).toBe(direto);
  });

  it("separa por semente, por tick e por sal", () => {
    expect(randomAt(7, 42, "gate")).not.toBe(randomAt(8, 42, "gate"));
    expect(randomAt(7, 42, "gate")).not.toBe(randomAt(7, 43, "gate"));
    expect(randomAt(7, 42, "gate")).not.toBe(randomAt(7, 42, "porta"));
  });

  it("fica em [0, 1)", () => {
    for (let t = 0; t < 500; t += 1) {
      const v = randomAt(3, t, "x");
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("distribui: 500 sorteios não caem todos na mesma metade", () => {
    let baixos = 0;
    for (let t = 0; t < 500; t += 1) if (randomAt(3, t, "x") < 0.5) baixos += 1;
    expect(baixos).toBeGreaterThan(150);
    expect(baixos).toBeLessThan(350);
  });
});
