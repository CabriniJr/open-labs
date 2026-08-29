import { describe, expect, it } from "vitest";
import type { ObjectSpec, WorldSpec, WorldState } from "./model.js";
import { initialWorld, stepWorld } from "./scheduler.js";
import { indexTree } from "./tree.js";

/**
 * Leque de carga: uma porta, dois fios, duas cópias.
 *
 * A contabilidade é a parte que importa: `out:` conta UMA emissão e cada
 * destino conta o seu `in:`. As duas divergirem é o esperado — a diferença é
 * quanto a saída se espalhou, e achatá-la esconderia justamente isso.
 */
const fonte: ObjectSpec = {
  id: "fonte",
  kind: "source",
  label: "fonte",
  leaf: true,
  behavior: (state, _inbox, ctx) =>
    ctx.phase === "commit"
      ? { state, out: [{ port: "out", message: ctx.emit("carga") }] }
      : { state, out: [] },
};

const conta = (id: string): ObjectSpec => ({
  id,
  kind: "sink",
  label: id,
  leaf: true,
  init: () => ({ n: 0 }),
  behavior: (state, inbox, ctx) =>
    ctx.phase === "commit"
      ? { state: { n: (state as { n: number }).n + inbox.length }, out: [] }
      : { state, out: [] },
});

const spec: WorldSpec = {
  id: "f",
  seed: 1,
  edgeTicks: 1,
  root: {
    id: "root",
    kind: "composite",
    label: "root",
    children: [fonte, conta("b"), conta("c")],
  },
  wires: [
    { from: "fonte", port: "out", to: "b" },
    { from: "fonte", port: "out", to: "c" },
  ],
  params: {},
};

const tree = indexTree(spec.root);

function rodar(ticks: number, mundo: WorldSpec = spec): WorldState {
  let estado = initialWorld(tree);
  for (let i = 0; i < ticks; i += 1) estado = stepWorld(mundo, tree, estado, mundo.params);
  return estado;
}

describe("leque de carga", () => {
  it("entrega uma cópia por fio, e as duas chegam", () => {
    const estado = rodar(4);
    expect((estado.nodes.b as { n: number }).n).toBe(3);
    expect((estado.nodes.c as { n: number }).n).toBe(3);
  });

  it("as cópias são itens em trânsito distintos", () => {
    const emVoo = rodar(1).flight;
    expect(emVoo).toHaveLength(2);
    expect(new Set(emVoo.map((f) => f.id)).size).toBe(2);
    expect(new Set(emVoo.map((f) => f.to))).toEqual(new Set(["b", "c"]));
  });

  it("out: conta uma emissão; cada destino conta o seu in:", () => {
    // Se `out:` contasse por destino, a pergunta "quantas vezes esta porta
    // emitiu?" deixaria de ter resposta, e o espalhamento sumiria dentro dela.
    const estado = rodar(4);
    expect(estado.ledger["out:fonte.out"]).toBe(4);
    expect(estado.ledger["in:b"]).toBe(3);
    expect(estado.ledger["in:c"]).toBe(3);
  });

  it("o leque é o mesmo nas duas fases do tick", () => {
    // A acomodação sempre percorreu todos os fios; se o confronto percorresse
    // só o primeiro, o mesmo desenho entregaria diferente conforme o regime da
    // porta — e ninguém veria a diferença até desenhar um caminho longo.
    const meio: ObjectSpec = {
      id: "meio",
      kind: "router",
      label: "meio",
      leaf: true,
      behavior: (state, inbox, ctx) =>
        ctx.phase === "settle"
          ? { state, out: inbox.map((m) => ({ port: "out", message: m })) }
          : { state, out: [] },
    };
    const comAcomodacao: WorldSpec = {
      ...spec,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [fonte, meio, conta("b"), conta("c")],
      },
      wires: [
        { from: "fonte", port: "out", to: "meio", timing: "clocked" },
        { from: "meio", port: "out", to: "b", timing: "settle" },
        { from: "meio", port: "out", to: "c", timing: "settle" },
      ],
    };
    const arvore = indexTree(comAcomodacao.root);
    let estado = initialWorld(arvore);
    for (let i = 0; i < 4; i += 1) {
      estado = stepWorld(comAcomodacao, arvore, estado, comAcomodacao.params);
    }
    const b = (estado.nodes.b as { n: number }).n;
    const c = (estado.nodes.c as { n: number }).n;
    expect(b).toBeGreaterThan(0);
    expect(c).toBe(b);
    // E uma emissão continua sendo uma emissão, tenha ela ido para onde for.
    expect(estado.ledger["out:meio.out"]).toBe(b);
  });
});
