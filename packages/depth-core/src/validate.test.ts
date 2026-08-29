// packages/depth-core/src/validate.test.ts
import { describe, expect, it } from "vitest";
import { DROP } from "./model.js";
import type { ObjectSpec, WorldSpec } from "./model.js";
import { indexTree } from "./tree.js";
import { validateWorld } from "./validate.js";
import { World } from "./world.js";

const leaf = (id: string): ObjectSpec => ({
  id,
  kind: "sink",
  label: id,
  leaf: true,
  behavior: (state) => ({ state, out: [] }),
});

const base: WorldSpec = {
  id: "v",
  seed: 1,
  root: { id: "root", kind: "composite", label: "root", children: [leaf("a"), leaf("b")] },
  wires: [{ from: "a", port: "out", to: "b" }],
  params: {},
};

const validar = (spec: WorldSpec): void => {
  validateWorld(spec, indexTree(spec.root, spec.channels));
};

describe("validateWorld", () => {
  it("aceita um mundo bem formado", () => {
    expect(() => validar(base)).not.toThrow();
  });

  it("recusa folha de fluxo sem behavior, citando o id que sumiria mensagens", () => {
    const spec: WorldSpec = {
      ...base,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [leaf("a"), { id: "buraco", kind: "sink", label: "buraco", leaf: true }],
      },
    };
    expect(() => validar(spec)).toThrow(/"buraco" é folha de fluxo e não tem behavior/);
  });

  it("recusa fio que parte de id inexistente", () => {
    expect(() => validar({ ...base, wires: [{ from: "fantasma", port: "out", to: "b" }] })).toThrow(
      /fio parte de "fantasma"/,
    );
  });

  it("recusa fio que chega em id inexistente, sem confundir com o descarte", () => {
    expect(() => validar({ ...base, wires: [{ from: "a", port: "out", to: "fantasma" }] })).toThrow(
      /fio chega em "fantasma"/,
    );
    expect(() => validar({ ...base, wires: [{ from: "a", port: "out", to: DROP }] })).not.toThrow();
  });

  it("recusa canal declarado num fio mas não indexado", () => {
    expect(() =>
      validar({ ...base, wires: [{ from: "a", port: "out", to: "b", channel: "pipe" }] }),
    ).toThrow(/canal "pipe"/);
  });

  it("aceita o canal quando ele está em WorldSpec.channels", () => {
    expect(() =>
      validar({
        ...base,
        channels: [{ id: "pipe", kind: "channel", label: "pipe", children: [leaf("dentro")] }],
        wires: [{ from: "a", port: "out", to: "b", channel: "pipe" }],
      }),
    ).not.toThrow();
  });

  it("recusa edgeTicks que faria a travessia sumir da tela", () => {
    expect(() => validar({ ...base, edgeTicks: 0 })).toThrow(/edgeTicks/);
    expect(() => validar({ ...base, edgeTicks: -1 })).toThrow(/edgeTicks/);
    expect(() => validar({ ...base, edgeTicks: 1.5 })).toThrow(/edgeTicks/);
    expect(() => validar({ ...base, edgeTicks: 1 })).not.toThrow();
  });

  it("recusa porta com os separadores do livro-caixa", () => {
    expect(() => validar({ ...base, wires: [{ from: "a", port: "in.weight", to: "b" }] })).toThrow(
      /separam campos no livro-caixa/,
    );
    expect(() => validar({ ...base, wires: [{ from: "a", port: "out:x", to: "b" }] })).toThrow(
      /separam campos no livro-caixa/,
    );
  });

  it("acumula todos os erros de uma vez: o autor não conserta em N rodadas", () => {
    const spec: WorldSpec = {
      ...base,
      edgeTicks: 0,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [leaf("a"), { id: "buraco", kind: "sink", label: "buraco", leaf: true }],
      },
      wires: [{ from: "fantasma", port: "out", to: "outro-fantasma" }],
    };
    let mensagem = "";
    try {
      validar(spec);
    } catch (erro) {
      mensagem = (erro as Error).message;
    }
    expect(mensagem).toMatch(/edgeTicks/);
    expect(mensagem).toMatch(/fio parte de "fantasma"/);
    expect(mensagem).toMatch(/fio chega em "outro-fantasma"/);
    expect(mensagem).toMatch(/"buraco" é folha de fluxo/);
  });
});

describe("World valida na construção", () => {
  it("recusa o mundo antes do primeiro tick, não em silêncio durante o run", () => {
    const spec: WorldSpec = {
      ...base,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [leaf("a"), { id: "buraco", kind: "sink", label: "buraco", leaf: true }],
      },
    };
    expect(() => new World(spec)).toThrow(/mundo inválido/);
  });

  it("indexa os canais declarados: eles são arestas, mas existem na árvore", () => {
    const w = new World({
      ...base,
      channels: [{ id: "pipe", kind: "channel", label: "pipe", children: [leaf("dentro")] }],
      wires: [{ from: "a", port: "out", to: "b", channel: "pipe" }],
    });
    expect(w.tree.byId.has("pipe")).toBe(true);
    expect(w.tree.byId.has("dentro")).toBe(true);
  });
});
