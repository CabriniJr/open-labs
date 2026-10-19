// packages/depth-core/src/perdas.test.ts
//
// A guarda contra o buraco de autoria que o motor media e ninguém lia: uma
// emissão que sai por porta sem fio. O que estes testes cobram é a diferença
// entre as três coisas que se parecem no livro-caixa e não são a mesma — fio
// nenhum, descarte declarado e porta de controle.
import { describe, expect, it } from "vitest";
import { emissoesPerdidas, relatoDePerdas } from "./meters.js";
import { spec } from "./meters.test-fixture.js";
import { DROP } from "./model.js";
import type { ObjectSpec, WorldSpec } from "./model.js";
import { World } from "./world.js";

/** Emite por `porta` todo tick, e é o autor quem decide se há fio ali. */
const emissor = (id: string, porta: string): ObjectSpec => ({
  id,
  kind: "source",
  label: id,
  leaf: true,
  init: () => ({}),
  behavior: (state, _inbox, ctx) => ({ state, out: [{ port: porta, message: ctx.emit("blob", 1) }] }),
});

const consumidor = (id: string): ObjectSpec => ({
  id,
  kind: "sink",
  label: id,
  leaf: true,
  init: () => ({ got: 0 }),
  behavior: (state, inbox) => ({
    state: { got: (state as { got: number }).got + inbox.length },
    out: [],
  }),
});

const mundo = (children: readonly ObjectSpec[], wires: WorldSpec["wires"]): WorldSpec => ({
  id: "p",
  seed: 1,
  root: { id: "root", kind: "composite", label: "root", children: [...children] },
  wires,
  params: {},
});

describe("emissoesPerdidas", () => {
  it("não acusa nada num mundo cujas portas todas têm fio", () => {
    const w = new World(spec);
    w.advance(6);
    expect(emissoesPerdidas(w.state)).toEqual([]);
  });

  it("acusa o nó, a porta e quantas emissões caíram no vácuo", () => {
    // O fio sai de "saida"; o comportamento emite por "out". É o erro de uma
    // letra num `.mmd`, reproduzido no formato do motor.
    const w = new World(
      mundo([emissor("gen", "out"), consumidor("fim")], [{ from: "gen", port: "saida", to: "fim" }]),
    );
    w.advance(5);
    expect(emissoesPerdidas(w.state)).toEqual([{ node: "gen", port: "out", count: 5 }]);
  });

  it("descarte declarado não é perda: o autor pediu que caísse", () => {
    const w = new World(mundo([emissor("gen", "out")], [{ from: "gen", port: "out", to: DROP }]));
    w.advance(5);
    expect(emissoesPerdidas(w.state)).toEqual([]);
  });

  it("porta de controle que entrega sinal não é perda", () => {
    // O escalonador só marca `unwired` quando não houve destino de sinal
    // tampouco. Um relógio que aciona alguém emite por porta sem fio de DADO,
    // e isso é o funcionamento normal de uma linha de controle.
    const obedece: ObjectSpec = {
      id: "obedece",
      kind: "buffer",
      label: "obedece",
      leaf: true,
      init: () => ({ pulsos: 0 }),
      behavior: (state, _inbox, ctx) => ({
        state: {
          pulsos: (state as { pulsos: number }).pulsos + (ctx.signals["tick"]?.length ?? 0),
        },
        out: [],
      }),
    };
    const w = new World(
      mundo(
        [emissor("relogio", "tick"), obedece],
        [{ from: "relogio", port: "tick", to: "obedece", line: "control", toPort: "tick" }],
      ),
    );
    w.advance(4);
    expect(emissoesPerdidas(w.state)).toEqual([]);
  });

  it("id de objeto com ponto não chega até aqui: o motor recusa na construção", () => {
    // É o que torna a partida no primeiro ponto correta. Se um dia `indexTree`
    // afrouxar isso, este teste cai e a partida da chave tem de ser repensada
    // junto — por isso ele mora aqui, e não só em tree.test.ts.
    expect(() => new World(mundo([emissor("bit0.soma", "out")], []))).toThrow(/"\." ou ":"/u);
  });

  it("porta com ponto fica inteira: ela é a única do livro-caixa sem validação", () => {
    // `validateWorld` só olha porta que aparece num fio. Esta não aparece em
    // nenhum — é justamente o que a faz perdida. Partir no último ponto daria
    // node "gen.a" e porta "b", e as duas estariam erradas.
    const w = new World(
      mundo([emissor("gen", "a.b"), consumidor("fim")], [{ from: "gen", port: "out", to: "fim" }]),
    );
    w.advance(3);
    expect(emissoesPerdidas(w.state)).toEqual([{ node: "gen", port: "a.b", count: 3 }]);
  });

  it("acusa mais de uma perda quando há mais de uma", () => {
    const w = new World(
      mundo(
        [emissor("a", "out"), emissor("b", "out"), consumidor("fim")],
        [
          { from: "a", port: "errada", to: "fim" },
          { from: "b", port: "errada", to: "fim" },
        ],
      ),
    );
    w.advance(2);
    const perdas = emissoesPerdidas(w.state);
    expect(perdas).toHaveLength(2);
    expect(perdas.map((p) => p.node).sort()).toEqual(["a", "b"]);
  });
});

describe("relatoDePerdas", () => {
  it("diz o nó, a porta e a contagem numa linha por perda", () => {
    const texto = relatoDePerdas([
      { node: "gateway", port: "call", count: 11 },
      { node: "ledger", port: "export", count: 2 },
    ]);
    expect(texto).toContain("gateway.call: 11");
    expect(texto).toContain("ledger.export: 2");
    expect(texto.split("\n")).toHaveLength(2);
  });

  it("sem perda, não tem texto", () => {
    expect(relatoDePerdas([])).toBe("");
  });
});
