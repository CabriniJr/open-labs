// packages/depth-core/src/settle.test-fixture.ts
//
// Um mundo minúsculo com caminho combinacional de verdade: uma fonte
// cronometrada alimenta dois estágios que acomodam em cadeia, e o último
// escreve num acumulador na fase de confronto.
import type { ObjectSpec, WorldSpec } from "./model.js";

/** Emite um valor por tick, no confronto. */
export const fonte: ObjectSpec = {
  id: "fonte",
  kind: "source",
  label: "fonte",
  leaf: true,
  init: () => ({ n: 0 }),
  behavior: (state, _inbox, ctx) => {
    const s = state as { n: number };
    if (ctx.phase !== "commit") return { state: s, out: [] };
    return {
      state: { n: s.n + 1 },
      out: [{ port: "out", message: ctx.emit("valor", 1, { n: s.n }) }],
    };
  },
};

/** Soma 1 ao que chega. Acomoda: não guarda nada. */
const soma = (id: string): ObjectSpec => ({
  id,
  kind: "router",
  label: id,
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "settle") return { state, out: [] };
    return {
      state,
      out: inbox.map((m) => ({
        port: "out",
        message: ctx.emit("valor", 1, { n: (m.data.n as number) + 1 }),
      })),
    };
  },
});

export const a = soma("a");
export const b = soma("b");

/** Guarda o último valor visto. Só age no confronto. */
export const acumulador: ObjectSpec = {
  id: "acc",
  kind: "sink",
  label: "acc",
  leaf: true,
  init: () => ({ ultimo: -1, vistos: 0 }),
  behavior: (state, inbox, ctx) => {
    const s = state as { ultimo: number; vistos: number };
    if (ctx.phase !== "commit" || inbox.length === 0) return { state: s, out: [] };
    const ultimo = inbox[inbox.length - 1]!;
    return {
      state: { ultimo: ultimo.data.n as number, vistos: s.vistos + inbox.length },
      out: [],
    };
  },
};

export const spec: WorldSpec = {
  id: "s",
  seed: 1,
  edgeTicks: 1,
  root: { id: "root", kind: "composite", label: "root", children: [fonte, a, b, acumulador] },
  wires: [
    { from: "fonte", port: "out", to: "a", timing: "clocked" },
    { from: "a", port: "out", to: "b", timing: "settle" },
    { from: "b", port: "out", to: "acc", timing: "settle" },
  ],
  params: {},
};
