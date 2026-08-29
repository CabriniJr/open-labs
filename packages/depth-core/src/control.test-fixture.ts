// packages/depth-core/src/control.test-fixture.ts
//
// Um seletor que só deixa a carga passar quando recebe sinal, e um controlador
// que decide se manda o sinal. É a forma mínima de "controle manda em quem está
// no caminho, sem estar nele".
import type { ObjectSpec, WorldSpec } from "./model.js";

/** Manda sinal quando o parâmetro `abrir` é 1. Nunca toca em carga. */
export const controle: ObjectSpec = {
  id: "ctrl",
  kind: "router",
  label: "ctrl",
  leaf: true,
  behavior: (state, _inbox, ctx) => {
    if (ctx.phase !== "commit" || ctx.params.abrir !== 1) return { state, out: [] };
    return { state, out: [{ port: "sel", message: ctx.emit("sinal") }] };
  },
};

export const fonte: ObjectSpec = {
  id: "fonte",
  kind: "source",
  label: "fonte",
  leaf: true,
  behavior: (state, _inbox, ctx) =>
    ctx.phase === "commit"
      ? { state, out: [{ port: "out", message: ctx.emit("carga") }] }
      : { state, out: [] },
};

/** Deixa passar só o que chega quando há sinal na porta "sel". */
export const seletor: ObjectSpec = {
  id: "sel",
  kind: "router",
  label: "sel",
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const aberto = (ctx.signals.sel ?? []).length > 0;
    return { state, out: aberto ? inbox.map((m) => ({ port: "out", message: m })) : [] };
  },
};

export const destino: ObjectSpec = {
  id: "dst",
  kind: "sink",
  label: "dst",
  leaf: true,
  init: () => ({ got: 0 }),
  behavior: (state, inbox, ctx) =>
    ctx.phase === "commit"
      ? { state: { got: (state as { got: number }).got + inbox.length }, out: [] }
      : { state, out: [] },
};

export const spec: WorldSpec = {
  id: "c",
  seed: 1,
  edgeTicks: 1,
  root: {
    id: "root",
    kind: "composite",
    label: "root",
    children: [controle, fonte, seletor, destino],
  },
  wires: [
    { from: "fonte", port: "out", to: "sel" },
    { from: "sel", port: "out", to: "dst" },
    { from: "ctrl", port: "sel", to: "sel", line: "control", toPort: "sel" },
  ],
  params: { abrir: 1 },
};
