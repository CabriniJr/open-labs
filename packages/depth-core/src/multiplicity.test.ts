import { describe, expect, it } from "vitest";
import type { AnyObject, ObjectSpec, WorldSpec } from "./model.js";
import { initialWorld, stepWorld } from "./scheduler.js";
import { indexTree } from "./tree.js";
import { validateWorld } from "./validate.js";

const folha = (id: string, kind: ObjectSpec["kind"] = "sink"): ObjectSpec => ({
  id,
  kind,
  label: id,
  leaf: true,
  behavior: (state) => ({ state, out: [] }),
});

const mundo = (root: AnyObject, wires: WorldSpec["wires"] = []): WorldSpec => ({
  id: "m",
  seed: 1,
  root,
  wires,
  params: {},
});

const validar = (spec: WorldSpec): void => {
  validateWorld(spec, indexTree(spec.root, spec.channels));
};

const banco = (replicas: number, kinds: ObjectSpec["kind"][]): AnyObject => ({
  id: "banco",
  kind: "composite",
  label: "banco",
  replicas,
  children: kinds.map((kind, i) => folha(`r${i}`, kind)),
});

describe("×N — réplica", () => {
  it("aceita N réplicas quando os N existem e são idênticos", () => {
    expect(() =>
      validar(
        mundo({
          id: "root",
          kind: "composite",
          label: "root",
          children: [banco(3, ["sink", "sink", "sink"])],
        }),
      ),
    ).not.toThrow();
  });

  it("recusa a marca sem os objetos: senão o leitor lê a conta de um como a de N", () => {
    expect(() =>
      validar(
        mundo({
          id: "root",
          kind: "composite",
          label: "root",
          children: [banco(32, ["sink", "sink"])],
        }),
      ),
    ).toThrow(/declara replicas 32 e tem 2 filhos/);
  });

  it("recusa réplicas que não são idênticas", () => {
    expect(() =>
      validar(
        mundo({
          id: "root",
          kind: "composite",
          label: "root",
          children: [banco(2, ["sink", "buffer"])],
        }),
      ),
    ).toThrow(/não são idênticos/);
  });

  it("recusa N < 2 e N fracionário", () => {
    for (const n of [1, 0, 2.5]) {
      expect(() =>
        validar(
          mundo({
            id: "root",
            kind: "composite",
            label: "root",
            children: [banco(n, ["sink", "sink"])],
          }),
        ),
      ).toThrow(/replicas/);
    }
  });
});

describe("/N — largura da linha", () => {
  const raiz: AnyObject = {
    id: "root",
    kind: "composite",
    label: "root",
    children: [
      {
        id: "fonte",
        kind: "source",
        label: "fonte",
        leaf: true,
        behavior: (state, _inbox, ctx) =>
          ctx.phase === "commit"
            ? { state, out: [{ port: "out", message: ctx.emit("carga", 1) }] }
            : { state, out: [] },
      },
      folha("dst"),
    ],
  };

  it("aceita feixe de 2 ou mais vias", () => {
    expect(() =>
      validar(mundo(raiz, [{ from: "fonte", port: "out", to: "dst", width: 32 }])),
    ).not.toThrow();
  });

  it("recusa largura 1 e largura fracionária", () => {
    for (const w of [1, 0, 8.5]) {
      expect(() =>
        validar(mundo(raiz, [{ from: "fonte", port: "out", to: "dst", width: w }])),
      ).toThrow(/width/);
    }
  });

  it("a largura não conta nada: o livro-caixa é idêntico com e sem ela", () => {
    // A marca informa o desenho. No dia em que alguém fizer a largura
    // multiplicar peso ou contagem, este teste cai — que é a diferença entre
    // "o desenho informa" e "o número mente".
    const semLargura = mundo(raiz, [{ from: "fonte", port: "out", to: "dst" }]);
    const comLargura = mundo(raiz, [{ from: "fonte", port: "out", to: "dst", width: 32 }]);
    const arvore = indexTree(raiz);

    const rodar = (spec: WorldSpec) => {
      let estado = initialWorld(arvore);
      for (let i = 0; i < 5; i += 1) estado = stepWorld(spec, arvore, estado, spec.params);
      return estado;
    };

    expect(rodar(comLargura).ledger).toEqual(rodar(semLargura).ledger);
  });
});
