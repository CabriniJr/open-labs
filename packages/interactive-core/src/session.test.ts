import { describe, expect, it } from "vitest";
import { InteractiveSession } from "./index.js";

describe("histórico de uma interação sem grafo", () => {
  const model = {
    id: "balance", initial: () => ({ balance: 10 }),
    transition: (state: Readonly<{ balance: number }>, delta: number) => {
      if (state.balance + delta < 0) throw new Error("Insufficient balance");
      return { balance: state.balance + delta };
    },
  };
  it("revisita exatamente um estado e edita a partir dele, abandonando o futuro", () => {
    const s = new InteractiveSession(model);
    s.dispatch(3); s.dispatch(7);
    expect(s.seek(1)).toEqual({ balance: 13 });
    s.dispatch(-2);
    expect(s.state).toEqual({ balance: 11 });
    expect(s.length).toBe(2);
    expect(s.seek(0)).toEqual({ balance: 10 });
  });
  it("uma transição recusada não apaga o futuro", () => {
    const s = new InteractiveSession(model);
    s.dispatch(3); s.dispatch(7); s.seek(1);
    expect(() => s.dispatch(-50)).toThrow();
    expect(s.seek(2)).toEqual({ balance: 20 });
  });
  it("isola snapshots mesmo se um adaptador mutar o argumento recebido", () => {
    const s = new InteractiveSession({ id: "nested", initial: () => ({ values: [1] }), transition: (state, value: number) => { state.values.push(value); return state; } });
    s.dispatch(2); s.dispatch(3);
    expect(s.seek(0).values).toEqual([1]);
    expect(s.seek(1).values).toEqual([1, 2]);
  });
  it("limita o histórico de sessões contínuas", () => {
    const s = new InteractiveSession(model, 2);
    s.dispatch(1); s.dispatch(1);
    expect(() => s.dispatch(1)).toThrow(/history is full/);
    expect(s.reset()).toEqual({ balance: 10 });
    expect(s.length).toBe(0);
  });
});
