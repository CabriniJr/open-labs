import { describe, expect, it } from "vitest";
import { DROP } from "./model.js";
import type { ObjectSpec, Wire } from "./model.js";
import { indexTree } from "./tree.js";
import { resolveTarget } from "./wiring.js";

const leaf = (id: string, kind: ObjectSpec["kind"]): ObjectSpec => ({
  id,
  kind,
  label: id,
  leaf: true,
  behavior: (state) => ({ state, out: [] }),
});

const root: ObjectSpec = {
  id: "root",
  kind: "composite",
  label: "root",
  children: [
    leaf("src", "source"),
    {
      id: "box",
      kind: "composite",
      label: "box",
      children: [
        leaf("gate", "router"),
        {
          id: "chain",
          kind: "pipeline",
          label: "chain",
          children: [leaf("a", "sink"), leaf("note", "static"), leaf("b", "sink")],
        },
      ],
    },
    leaf("sink", "sink"),
  ],
};

const wires: readonly Wire[] = [
  { from: "src", port: "out", to: "box" },
  { from: "gate", port: "keep", to: "chain" },
  { from: "gate", port: "drop", to: DROP },
  { from: "box", port: "out", to: "sink" },
];

const tree = indexTree(root);

describe("resolveTarget", () => {
  it("resolve um contêiner para a folha de entrada dele", () => {
    expect(resolveTarget(tree, wires, "src", "out")).toBe("gate");
  });

  it("entrega o descarte na lixeira", () => {
    expect(resolveTarget(tree, wires, "gate", "drop")).toBe(DROP);
  });

  it("encadeia os filhos de um pipeline sem fio declarado", () => {
    expect(resolveTarget(tree, wires, "a", "out")).toBe("b");
  });

  it("pula estáticos no encadeamento", () => {
    // "note" é estático e fica entre "a" e "b": não pode receber nada
    expect(resolveTarget(tree, wires, "a", "out")).not.toBe("note");
  });

  it("sobe para o fio do pai quando o pipeline acaba", () => {
    expect(resolveTarget(tree, wires, "b", "out")).toBe("sink");
  });

  it("devolve null quando não há destino", () => {
    expect(resolveTarget(tree, wires, "sink", "out")).toBeNull();
  });

  it("não segue linha de controle — ela carrega sinal, não carga", () => {
    const comControle: readonly Wire[] = [
      ...wires,
      { from: "sink", port: "out", to: "src", line: "control" },
    ];
    expect(resolveTarget(tree, comControle, "sink", "out")).toBeNull();
  });
});
