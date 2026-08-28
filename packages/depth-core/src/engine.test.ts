import { describe, expect, it } from "vitest";
import { Engine } from "./engine.js";
import type { Scenario } from "./types.js";

interface Counter {
  value: number;
  noise: number;
}

const counter: Scenario<Counter> = {
  id: "counter",
  seed: 99,
  levels: ["flow"],
  initialState: (inputs) => ({ value: Number(inputs.start ?? 0), noise: 0 }),
  step: (state, ctx) => ({
    value: state.value + 1,
    noise: ctx.random(),
  }),
};

describe("Engine", () => {
  it("começa no tick 0 com o estado inicial", () => {
    const e = new Engine(counter, { start: 10 });
    expect(e.tick).toBe(0);
    expect(e.state.value).toBe(10);
  });

  it("avança um tick por vez", () => {
    const e = new Engine(counter, {});
    e.advance();
    e.advance();
    expect(e.tick).toBe(2);
    expect(e.state.value).toBe(2);
  });

  it("é determinístico: mesma seed, mesmo estado no tick N", () => {
    const a = new Engine(counter, {});
    const b = new Engine(counter, {});
    a.advance(10);
    b.advance(10);
    expect(a.state).toEqual(b.state);
  });

  it("rebobinar devolve exatamente o estado que havia naquele tick", () => {
    const e = new Engine(counter, {});
    e.advance(5);
    const at5 = structuredClone(e.state);
    e.advance(5);
    e.seek(5);
    expect(e.tick).toBe(5);
    expect(e.state).toEqual(at5);
  });

  it("não muta o estado anterior ao avançar", () => {
    const e = new Engine(counter, {});
    const before = e.state;
    e.advance();
    expect(before.value).toBe(0);
  });

  it("trocar inputs reinicia no tick 0 com o novo estado inicial", () => {
    const e = new Engine(counter, { start: 0 });
    e.advance(3);
    e.setInputs({ start: 100 });
    expect(e.tick).toBe(0);
    expect(e.state.value).toBe(100);
  });

  it("expõe os níveis declarados pelo cenário", () => {
    const e = new Engine(counter, {});
    expect(e.levels).toEqual(["flow"]);
  });
});
