import { describe, expect, it } from "vitest";
import type { ObjectSpec, WorldSpec } from "./model.js";
import { stepWorld } from "./scheduler.js";
import { World } from "./world.js";

/** Acumula `step` por tick. Simples de prever de cabeça. */
const counter: ObjectSpec = {
  id: "c",
  kind: "source",
  label: "c",
  leaf: true,
  init: () => ({ total: 0, noise: 0 }),
  behavior: (state, _inbox, ctx) => {
    const s = state as { total: number; noise: number };
    // `noUncheckedIndexedAccess` marca leitura de Record como possivelmente
    // ausente; o fallback nunca dispara aqui porque o spec sempre define `step`.
    return { state: { total: s.total + (ctx.params.step ?? 0), noise: ctx.random() }, out: [] };
  },
};

const spec: WorldSpec = {
  id: "w",
  seed: 7,
  root: { id: "root", kind: "composite", label: "root", children: [counter] },
  wires: [],
  params: { step: 1 },
};

const total = (w: World): number => (w.state.nodes["c"] as { total: number }).total;

describe("World", () => {
  it("começa no tick 0 com o estado inicial", () => {
    const w = new World(spec);
    expect(w.tick).toBe(0);
    expect(total(w)).toBe(0);
  });

  it("rebobinar é reler o histórico, não recalcular por aproximação", () => {
    const w = new World(spec);
    w.advance(10);
    const at10 = total(w);
    w.seek(3);
    expect(total(w)).toBe(3);
    w.seek(10);
    expect(total(w)).toBe(at10);
  });

  it("mudar parâmetro NÃO volta o tick para 0 e preserva o acumulado", () => {
    const w = new World(spec);
    w.advance(5);
    expect(total(w)).toBe(5);
    w.setParam("step", 10);
    expect(w.tick).toBe(5);
    expect(total(w)).toBe(5);
    w.advance(1);
    expect(total(w)).toBe(15);
  });

  it("seek continua exato depois de mudanças de parâmetro", () => {
    const w = new World(spec);
    w.advance(3);
    w.setParam("step", 4);
    w.advance(3);
    const at6 = total(w);
    w.seek(0);
    w.seek(6);
    expect(total(w)).toBe(at6);
    expect(at6).toBe(3 + 12);
  });

  it("replay do zero com a mesma linha do tempo dá o mesmo resultado", () => {
    const a = new World(spec);
    a.advance(3);
    a.setParam("step", 4);
    a.advance(3);

    const b = new World(spec);
    b.advance(3);
    b.setParam("step", 4);
    b.advance(3);

    expect(JSON.stringify(b.state)).toBe(JSON.stringify(a.state));
  });

  it("rebobinar e mudar parâmetro abandona o futuro que existia", () => {
    const w = new World(spec);
    w.advance(3);
    w.setParam("step", 100);   // evento no tick 3
    w.advance(3);              // tick 6, total 3 + 300
    expect(total(w)).toBe(303);

    w.seek(1);
    w.setParam("step", 2);     // outra linha do tempo a partir do tick 1
    w.advance(5);              // tick 6
    // o evento do tick 3 pertencia à linha abandonada: não pode ressuscitar
    expect(total(w)).toBe(1 + 2 * 5);
  });

  it("paramsAt(T) é o conjunto com que history[T] foi de fato calculado", () => {
    // A armadilha que este teste tranca: gravar o evento no tick atual faz
    // paramsAt afirmar um valor que o estado daquele tick nunca viu. Hoje nada
    // recomputa o passado, então ninguém percebe — mas qualquer poda do
    // histórico com checkpoint mais recomputação devolveria um passado
    // diferente do que o leitor viu na tela.
    const w = new World(spec);
    w.advance(4);
    w.setParam("step", 10);
    w.advance(4);

    const tree = w.tree;
    for (let t = 1; t <= 8; t += 1) {
      w.seek(t - 1);
      const anterior = w.state;
      const recomputado = stepWorld(spec, tree, anterior, w.paramsAt(t));
      w.seek(t);
      expect(recomputado).toEqual(w.state);
    }
  });

  it("um mundo novo, com o mesmo log de eventos, produz histórico idêntico", () => {
    // O mesmo log aplicado com outra granularidade de avanço: se o tick de
    // vigência de um evento fosse ambíguo, as duas linhas do tempo divergiriam.
    const a = new World(spec);
    a.advance(4);
    a.setParam("step", 10);
    a.advance(4);

    const b = new World(spec);
    for (let t = 1; t <= 4; t += 1) b.advance(1);
    b.setParam("step", 10);
    for (let t = 5; t <= 8; t += 1) b.advance(1);

    for (let t = 0; t <= 8; t += 1) {
      a.seek(t);
      b.seek(t);
      expect(b.state).toEqual(a.state);
      expect(b.paramsAt(t)).toEqual(a.paramsAt(t));
    }
  });

  it("o aleatório é função de (seed, tick), não do caminho percorrido", () => {
    const a = new World(spec);
    a.advance(5);
    const noiseAt5 = (a.state.nodes["c"] as { noise: number }).noise;

    const b = new World(spec);
    b.seek(5);
    expect((b.state.nodes["c"] as { noise: number }).noise).toBe(noiseAt5);
  });
});
