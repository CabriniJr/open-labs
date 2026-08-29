import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { AnyObject, Behavior, ObjectSpec, WorldSpec } from "./model.js";
import { initialWorld, stepWorld } from "./scheduler.js";
import { shortcutDisagreement } from "./shortcut.js";
import { indexTree } from "./tree.js";
import { validateWorld } from "./validate.js";

/**
 * Dois estágios que somam 1 cada, e um atalho que soma 2. O atalho está certo,
 * e é justamente por isso que o teste do atalho ERRADO importa: sem ele, a
 * propriedade provaria só que coisas iguais são iguais.
 */
const soma = (id: string, quanto: number, fase: "settle" | "commit"): ObjectSpec => ({
  id,
  kind: "router",
  label: id,
  leaf: true,
  behavior: (state, inbox, ctx) =>
    ctx.phase === fase
      ? {
          state,
          out: inbox.map((m) => ({
            port: "out",
            message: ctx.emit("valor", 1, { n: (m.data.n as number) + quanto }),
          })),
        }
      : { state, out: [] },
});

const fonte: ObjectSpec = {
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

const destino: ObjectSpec = {
  id: "dst",
  kind: "sink",
  label: "dst",
  leaf: true,
  init: () => ({ soma: 0, vistos: 0 }),
  behavior: (state, inbox, ctx) => {
    const s = state as { soma: number; vistos: number };
    if (ctx.phase !== "commit") return { state: s, out: [] };
    return {
      state: {
        soma: inbox.reduce((acc, m) => acc + (m.data.n as number), s.soma),
        vistos: s.vistos + inbox.length,
      },
      out: [],
    };
  },
};

/**
 * O contêiner: dois estágios encadeados por uma aresta **acomodada**, com um
 * atalho declarado.
 *
 * A aresta interna precisa acomodar para a equivalência sequer ser possível: se
 * ela custasse tick, a composição responderia um tick depois do atalho, e o
 * atalho estaria mentindo sobre latência mesmo acertando o valor. É o caso real
 * de um atalho — ele substitui uma cadeia que fecha dentro do ciclo.
 */
const bloco = (atalho: Behavior<unknown> | undefined): AnyObject => {
  const base: AnyObject = {
    id: "bloco",
    kind: "pipeline",
    label: "bloco",
    children: [soma("s1", 1, "settle"), soma("s2", 1, "commit")],
  };
  return atalho === undefined ? base : { ...base, shortcut: atalho };
};

const atalhoCerto: Behavior<unknown> = (state, inbox, ctx) =>
  ctx.phase === "commit"
    ? {
        state,
        out: inbox.map((m) => ({
          port: "out",
          message: ctx.emit("valor", 1, { n: (m.data.n as number) + 2 }),
        })),
      }
    : { state, out: [] };

const atalhoErrado: Behavior<unknown> = (state, inbox, ctx) =>
  ctx.phase === "commit"
    ? {
        state,
        out: inbox.map((m) => ({
          port: "out",
          message: ctx.emit("valor", 1, { n: (m.data.n as number) + 3 }),
        })),
      }
    : { state, out: [] };

const mundo = (atalho: Behavior<unknown> | undefined, edgeTicks = 1): WorldSpec => ({
  id: "a",
  seed: 1,
  edgeTicks,
  root: {
    id: "root",
    kind: "composite",
    label: "root",
    children: [fonte, bloco(atalho), destino],
  },
  wires: [
    { from: "fonte", port: "out", to: "bloco" },
    { from: "s1", port: "out", to: "s2", timing: "settle" },
    { from: "bloco", port: "out", to: "dst" },
  ],
  params: {},
});

describe("atalho com equivalência provada", () => {
  it("o atalho certo concorda com a composição", () => {
    expect(shortcutDisagreement(mundo(atalhoCerto), "bloco", 10)).toBeNull();
  });

  it("o atalho errado é reprovado, dizendo onde", () => {
    // Sem esta metade, a comparação provaria só que coisas iguais são iguais.
    const achado = shortcutDisagreement(mundo(atalhoErrado), "bloco", 10);
    expect(achado).not.toBeNull();
    expect(achado).toMatch(/dst/);
  });

  it("continua concordando com qualquer atraso de aresta", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 2, max: 14 }), (edge, ticks) => {
        expect(shortcutDisagreement(mundo(atalhoCerto, edge), "bloco", ticks)).toBeNull();
      }),
    );
  });

  it("dentro do atalho ninguém roda: contar os dois somaria duas vezes", () => {
    const spec = mundo(atalhoCerto);
    const tree = indexTree(spec.root);
    let estado = initialWorld(tree);
    for (let i = 0; i < 6; i += 1) estado = stepWorld(spec, tree, estado, spec.params);
    expect(estado.ledger["out:s1.out"]).toBeUndefined();
    expect(estado.ledger["out:s2.out"]).toBeUndefined();
    expect(estado.ledger["out:bloco.out"]).toBeGreaterThan(0);
  });

  it("a entrega para o contêiner com atalho para NELE, e não no primeiro filho", () => {
    const spec = mundo(atalhoCerto);
    const tree = indexTree(spec.root);
    let estado = initialWorld(tree);
    estado = stepWorld(spec, tree, estado, spec.params);
    expect(estado.flight.map((f) => f.to)).toContain("bloco");
  });

  it("recusa atalho sem composição e atalho junto de behavior", () => {
    const validar = (root: AnyObject): void => {
      validateWorld({ ...mundo(undefined), root, wires: [] }, indexTree(root));
    };
    expect(() =>
      validar({
        id: "root",
        kind: "composite",
        label: "root",
        children: [
          { id: "so", kind: "sink", label: "so", leaf: true, shortcut: atalhoCerto },
        ],
      }),
    ).toThrow(/não tem composição para atalhar/);

    expect(() =>
      validar({
        id: "root",
        kind: "composite",
        label: "root",
        children: [
          {
            // `leaf: true` é a válvula que faz `indexTree` deixar passar um
            // objeto com filhos e comportamento; quem acusa daqui para a frente
            // é a validação.
            id: "dois",
            kind: "pipeline",
            label: "dois",
            leaf: true,
            behavior: (state) => ({ state, out: [] }),
            shortcut: atalhoCerto,
            children: [soma("x", 1, "commit")],
          },
        ],
      }),
    ).toThrow(/dois comportamentos/);
  });
});
