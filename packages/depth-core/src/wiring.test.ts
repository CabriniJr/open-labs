import { describe, expect, it } from "vitest";
import { DROP } from "./model.js";
import type { ObjectSpec, Wire } from "./model.js";
import { indexTree } from "./tree.js";
import { resolveSignalTargets, resolveTarget } from "./wiring.js";

const leaf = (id: string, kind: ObjectSpec["kind"]): ObjectSpec => ({
  id,
  kind,
  label: id,
  leaf: true,
  behavior: (state) => ({ state, out: [] }),
});

/** Placa é consultada, nunca atravessada: por isso nunca tem behavior. */
const plate = (id: string): ObjectSpec => ({ id, kind: "static", label: id, leaf: true });

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
          children: [leaf("a", "sink"), plate("note"), leaf("b", "sink")],
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

describe("resolveSignalTargets", () => {
  const wires: Wire[] = [
    { from: "ctrl", port: "sel", to: "m1", line: "control", toPort: "sel" },
    { from: "ctrl", port: "sel", to: "m2", line: "control", toPort: "sel" },
    { from: "ctrl", port: "en", to: "m1", line: "control", toPort: "enable" },
    { from: "ctrl", port: "sel", to: "d", line: "data" },
  ];

  it("devolve todos os destinos de um sinal: leque é a regra, não a exceção", () => {
    expect(resolveSignalTargets(wires, "ctrl", "sel")).toEqual([
      { to: "m1", toPort: "sel" },
      { to: "m2", toPort: "sel" },
    ]);
  });

  it("não confunde portas diferentes do mesmo controlador", () => {
    expect(resolveSignalTargets(wires, "ctrl", "en")).toEqual([{ to: "m1", toPort: "enable" }]);
  });

  it("ignora linha de dado, mesmo saindo da mesma porta", () => {
    const so = resolveSignalTargets(wires, "ctrl", "sel");
    expect(so.map((s) => s.to)).not.toContain("d");
  });

  it("porta sem linha de controle nenhuma devolve lista vazia", () => {
    expect(resolveSignalTargets(wires, "ctrl", "nada")).toEqual([]);
  });
});
