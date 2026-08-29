import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { World } from "./world.js";
import type { AnyObject, Behavior, Message, WorldSpec } from "./model.js";
import { shortcutDisagreement } from "./shortcut.js";

/**
 * Entradas nomeadas: um contêiner com bornes.
 *
 * O que elas destravam é isto — **a mesma fiação serve aberto e fechado**. Sem
 * bornes, um objeto com duas entradas distintas precisa de fios diferentes
 * conforme esteja atalhado ou composto, e nenhum teste de equivalência consegue
 * comparar as duas coisas: elas deixam de ser o mesmo modelo.
 */

const conta = (m: readonly Message[]): number =>
  m.reduce((soma, msg) => soma + ((msg.data.n as number | undefined) ?? 0), 0);

/** Guarda o que chega, por entrada. Serve de olho do lado de fora. */
const destino: AnyObject = {
  id: "dst",
  kind: "sink",
  label: "dst",
  leaf: true,
  init: () => ({ visto: 0 }),
  // Guarda o último, e não a soma: o que interessa é o valor que atravessou o
  // bloco, e somar tick a tick só mediria quantos ticks rodaram.
  behavior: (state, inbox, ctx) =>
    ctx.phase === "commit" && inbox.length > 0
      ? { state: { visto: conta(inbox) }, out: [] }
      : { state, out: [] },
};

const fonte = (porta: string, valor: number): AnyObject => ({
  id: `f${porta}`,
  kind: "source",
  label: `f${porta}`,
  leaf: true,
  behavior: (state, _inbox, ctx) =>
    ctx.phase === "commit"
      ? { state, out: [{ port: "out", message: ctx.emit("v", 1, { n: valor }) }] }
      : { state, out: [] },
});

/** Dobra o que chega por `a` e soma o que chega por `b`. */
const dentro = (id: string, fator: number): AnyObject => ({
  id,
  kind: "router",
  label: id,
  leaf: true,
  behavior: (state, inbox, ctx) =>
    ctx.phase === "settle" && inbox.length > 0
      ? { state, out: [{ port: "out", message: ctx.emit("v", 1, { n: conta(inbox) * fator }) }] }
      : { state, out: [] },
});

const somaDentro: AnyObject = {
  id: "junta",
  kind: "router",
  label: "junta",
  leaf: true,
  // Emite no confronto porque a saída dele atravessa a borda de relógio: os
  // dois ramos já chegaram na acomodação, e ele os soma antes de entregar.
  behavior: (state, inbox, ctx) =>
    ctx.phase === "commit" && inbox.length > 0
      ? { state, out: [{ port: "out", message: ctx.emit("v", 1, { n: conta(inbox) }) }] }
      : { state, out: [] },
};

const atalho: Behavior<unknown> = (state, _inbox, ctx) => {
  const a = conta(ctx.inlets.a ?? []);
  const b = conta(ctx.inlets.b ?? []);
  if (a === 0 && b === 0) return { state, out: [] };
  return { state, out: [{ port: "out", message: ctx.emit("v", 1, { n: a * 2 + b * 3 }) }] };
};

function mundo(comAtalho: boolean, a: number, b: number): WorldSpec {
  const bloco: AnyObject = {
    id: "bloco",
    kind: "composite",
    label: "bloco",
    inlets: { a: ["ramoA"], b: ["ramoB"] },
    exit: "junta",
    children: [dentro("ramoA", 2), dentro("ramoB", 3), somaDentro],
    ...(comAtalho ? { shortcut: atalho } : {}),
  };
  return {
    id: "i",
    seed: 1,
    edgeTicks: 1,
    root: {
      id: "raiz",
      kind: "composite",
      label: "raiz",
      children: [fonte("a", a), fonte("b", b), bloco, destino],
    },
    params: {},
    wires: [
      { from: "fa", port: "out", to: "bloco", toPort: "a" },
      { from: "fb", port: "out", to: "bloco", toPort: "b" },
      { from: "ramoA", port: "out", to: "junta", timing: "settle" },
      { from: "ramoB", port: "out", to: "junta", timing: "settle" },
      // A saída é do BLOCO, não de quem está lá dentro: aberto, a emissão de
      // "junta" sobe até o fio do pai (é para isso que `exit` existe);
      // fechado, quem emite é o próprio bloco. Mesmo fio nos dois casos.
      { from: "bloco", port: "out", to: "dst" },
    ],
  };
}

describe("entradas nomeadas", () => {
  it("cada borne entrega a quem ele nomeia", () => {
    const mundoAberto = new World(mundo(false, 5, 7));
    mundoAberto.advance(6);
    // 5*2 + 7*3 = 31
    expect((mundoAberto.state.nodes.dst as { visto: number }).visto).toBe(31);
  });

  it("o atalho vê a mesma coisa, separada por borne", () => {
    const fechado = new World(mundo(true, 5, 7));
    fechado.advance(6);
    expect((fechado.state.nodes.dst as { visto: number }).visto).toBe(31);
  });

  it("a MESMA fiação serve aberto e fechado, e as duas concordam", () => {
    // É isto que os bornes existem para permitir. Sem eles, o atalho precisaria
    // de outros fios, e aí não haveria com o que comparar.
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), fc.integer({ min: 0, max: 40 }), (a, b) => {
        expect(shortcutDisagreement(mundo(true, a, b), "bloco", 8)).toBeNull();
      }),
      { numRuns: 30 },
    );
  });

  it("recusa entrar por um borne que não existe", () => {
    const quebrado = mundo(false, 1, 1);
    expect(
      () =>
        new World({
          ...quebrado,
          wires: quebrado.wires.map((w) => (w.toPort === "a" ? { ...w, toPort: "z" } : w)),
        }),
    ).toThrow(/não declara essa entrada/);
  });

  it("recusa entrar sem nome num objeto que tem bornes", () => {
    const quebrado = mundo(false, 1, 1);
    expect(
      () =>
        new World({
          ...quebrado,
          wires: quebrado.wires.map((w) => {
            if (w.toPort !== "a") return w;
            const { toPort: _fora, ...resto } = w;
            return resto;
          }),
        }),
    ).toThrow(/sem dizer por qual porta/);
  });

  it("recusa borne que aponta para fora, e borne em folha", () => {
    const quebrado = mundo(false, 1, 1);
    const comBorneParaFora = {
      ...quebrado,
      root: {
        ...quebrado.root,
        children: (quebrado.root.children ?? []).map((c) =>
          c.id === "bloco" ? { ...c, inlets: { a: ["dst"], b: ["ramoB"] } } : c,
        ),
      },
    };
    expect(() => new World(comBorneParaFora)).toThrow(/está fora dele/);
  });
});

describe("bornes compõem: um contêiner com bornes dentro de outro", () => {
  /** Guarda em qual terminal ela foi tocada. É o olho do fundo do poço. */
  const terminal = (id: string): AnyObject => ({
    id,
    kind: "sink",
    label: id,
    leaf: true,
    init: () => ({ visto: 0 }),
    behavior: (state, inbox, ctx) =>
      ctx.phase === "commit" && inbox.length > 0
        ? { state: { visto: conta(inbox) }, out: [] }
        : { state, out: [] },
  });

  /** Um bloco com dois terminais distintos, que é o caso que exige nome. */
  const interno: AnyObject = {
    id: "interno",
    kind: "composite",
    label: "interno",
    inlets: { esq: ["t-esq"], dir: ["t-dir"] },
    children: [terminal("t-esq"), terminal("t-dir")],
  };

  /** E o mesmo bloco embrulhado, cujos bornes apontam para os bornes dele. */
  const externo: AnyObject = {
    id: "externo",
    kind: "composite",
    label: "externo",
    inlets: {
      a: [{ node: "interno", port: "esq" }],
      b: [{ node: "interno", port: "dir" }],
    },
    children: [interno],
  };

  const fonte: AnyObject = {
    id: "fonte",
    kind: "source",
    label: "fonte",
    leaf: true,
    behavior: (state, _inbox, ctx) =>
      ctx.phase === "commit"
        ? {
            state,
            out: [
              { port: "a", message: ctx.emit("v", 1, { n: 7 }) },
              { port: "b", message: ctx.emit("v", 1, { n: 30 }) },
            ],
          }
        : { state, out: [] },
  };

  const spec: WorldSpec = {
    id: "aninhado",
    seed: 1,
    edgeTicks: 1,
    params: {},
    root: { id: "raiz", kind: "composite", label: "raiz", children: [fonte, externo] },
    wires: [
      { from: "fonte", port: "a", to: "externo", toPort: "a", timing: "clocked" },
      { from: "fonte", port: "b", to: "externo", toPort: "b", timing: "clocked" },
    ],
  };

  it("a carga desce dois níveis e chega no terminal certo", () => {
    // Com a expansão de uma volta só, os dois fios acabavam na folha de entrada
    // de "interno" — o mesmo terminal para os dois, e nada avisaria.
    const mundo = new World(spec);
    mundo.advance(2);
    expect((mundo.state.nodes["t-esq"] as { visto: number }).visto).toBe(7);
    expect((mundo.state.nodes["t-dir"] as { visto: number }).visto).toBe(30);
  });

  it("nome pelado num filho que tem bornes é recusado na construção", () => {
    const cego: AnyObject = {
      ...externo,
      inlets: { a: ["interno"], b: [{ node: "interno", port: "dir" }] },
    };
    expect(
      () => new World({ ...spec, root: { ...spec.root, children: [fonte, cego] } }),
    ).toThrow(/sem dizer por qual porta.*esq, dir/s);
  });

  it("apontar para uma porta que o filho não tem é recusado", () => {
    const torto: AnyObject = {
      ...externo,
      inlets: { a: [{ node: "interno", port: "meio" }], b: [{ node: "interno", port: "dir" }] },
    };
    expect(
      () => new World({ ...spec, root: { ...spec.root, children: [fonte, torto] } }),
    ).toThrow(/porta "meio" de "interno", que não a declara/);
  });
});
