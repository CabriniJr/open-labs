import { describe, expect, it } from "vitest";
import { familyOf } from "./model.js";
import type { ObjectSpec } from "./model.js";
import {
  entryLeaf,
  exitLeaf,
  flowChildren,
  indexTree,
  isOpenable,
  visibleChild,
} from "./tree.js";

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
        plate("note"),
        leaf("gate", "router"),
        {
          id: "chain",
          kind: "pipeline",
          label: "chain",
          children: [leaf("a", "sink"), leaf("b", "sink")],
        },
      ],
    },
    leaf("out", "sink"),
  ],
};

describe("familyOf", () => {
  it("agrupa os arquétipos em famílias de forma", () => {
    expect(familyOf("channel")).toBe("conduit");
    expect(familyOf("static")).toBe("plate");
    for (const kind of ["composite", "pipeline"] as const) {
      expect(familyOf(kind)).toBe("container");
    }
    for (const kind of ["source", "router", "buffer", "sink"] as const) {
      expect(familyOf(kind)).toBe("processor");
    }
  });
});

describe("indexTree", () => {
  it("mapeia cada objeto ao pai dele", () => {
    const t = indexTree(root);
    expect(t.parent.get("gate")).toBe("box");
    expect(t.parent.get("a")).toBe("chain");
    expect(t.parent.get("root")).toBeUndefined();
    expect(t.byId.get("chain")?.kind).toBe("pipeline");
  });
});

describe("isOpenable", () => {
  it("abre quem tem filhos", () => {
    const t = indexTree(root);
    expect(isOpenable(t, "box")).toBe(true);
    expect(isOpenable(t, "gate")).toBe(false);
  });

  it("respeita a válvula leaf mesmo com filhos", () => {
    const t = indexTree({
      ...root,
      children: [{ id: "shut", kind: "pipeline", label: "shut", leaf: true, children: [leaf("x", "sink")] }],
    });
    expect(isOpenable(t, "shut")).toBe(false);
  });

  it("abre objeto dinâmico sem filhos declarados", () => {
    const t = indexTree({
      ...root,
      children: [{ id: "q", kind: "buffer", label: "q", dynamic: true, behavior: (s) => ({ state: s, out: [] }) }],
    });
    expect(isOpenable(t, "q")).toBe(true);
  });
});

describe("flowChildren", () => {
  it("preserva a ordem onde ela é contrato", () => {
    const t = indexTree(root);
    expect(flowChildren(t, "chain")).toEqual(["a", "b"]);
  });

  it("ignora os estáticos, que não são atravessados", () => {
    const t = indexTree(root);
    expect(flowChildren(t, "box")).not.toContain("note");
  });
});

describe("entryLeaf e exitLeaf", () => {
  it("descem até a folha, pulando estáticos", () => {
    const t = indexTree(root);
    expect(entryLeaf(t, "box")).toBe("gate");
    expect(exitLeaf(t, "box")).toBe("b");
    expect(entryLeaf(t, "gate")).toBe("gate");
  });
});

describe("visibleChild", () => {
  it("devolve o filho do foco que contém a folha", () => {
    const t = indexTree(root);
    expect(visibleChild(t, "root", "a")).toEqual({ at: "child", id: "box" });
    expect(visibleChild(t, "box", "a")).toEqual({ at: "child", id: "chain" });
  });

  it("devolve 'self' quando a folha é o próprio foco", () => {
    const t = indexTree(root);
    expect(visibleChild(t, "gate", "gate")).toEqual({ at: "self" });
  });

  it("devolve 'outside' quando a folha está fora do foco", () => {
    const t = indexTree(root);
    expect(visibleChild(t, "box", "src")).toEqual({ at: "outside" });
  });
});

describe("bordas que a revisão expôs", () => {
  it("recusa id duplicado", () => {
    expect(() =>
      indexTree({
        id: "r",
        kind: "composite",
        label: "r",
        children: [leaf("dup", "sink"), leaf("dup", "sink")],
      }),
    ).toThrow(/id duplicado/);
  });

  it("recusa comportamento em objeto composto", () => {
    expect(() =>
      indexTree({
        id: "r",
        kind: "composite",
        label: "r",
        behavior: (state) => ({ state, out: [] }),
        children: [leaf("a", "sink")],
      }),
    ).toThrow(/é composto e tem behavior/);
  });

  it("visibleChild recusa id que não existe em vez de dizer 'outside'", () => {
    const t = indexTree(root);
    expect(() => visibleChild(t, "root", "fantasma")).toThrow(/objeto desconhecido/);
    expect(() => visibleChild(t, "fantasma", "src")).toThrow(/objeto desconhecido/);
  });

  it("um filho chamado 'outside' não é confundido com estar fora do foco", () => {
    const t = indexTree({
      id: "r",
      kind: "composite",
      label: "r",
      children: [leaf("outside", "sink"), leaf("other", "sink")],
    });
    expect(visibleChild(t, "r", "outside")).toEqual({ at: "child", id: "outside" });
    expect(visibleChild(t, "outside", "other")).toEqual({ at: "outside" });
  });

  it("contêiner só de estáticos não é abrível", () => {
    const t = indexTree({
      id: "r",
      kind: "composite",
      label: "r",
      children: [
        {
          id: "grp",
          kind: "composite",
          label: "grp",
          children: [plate("k1"), plate("k2")],
        },
      ],
    });
    expect(isOpenable(t, "grp")).toBe(false);
  });

  it("a fronteira declarada vence a ordem de declaração", () => {
    const t = indexTree({
      id: "r",
      kind: "composite",
      label: "r",
      entry: "b",
      exit: "a",
      children: [leaf("a", "sink"), leaf("b", "sink")],
    });
    expect(entryLeaf(t, "r")).toBe("b");
    expect(exitLeaf(t, "r")).toBe("a");
  });

  it("árvore de um nó só se resolve nela mesma", () => {
    const t = indexTree(leaf("solo", "source"));
    expect(entryLeaf(t, "solo")).toBe("solo");
    expect(visibleChild(t, "solo", "solo")).toEqual({ at: "self" });
  });

  it("recusa fronteira que aponta para fora do contêiner", () => {
    expect(() =>
      indexTree({
        id: "r",
        kind: "composite",
        label: "r",
        children: [
          { id: "box", kind: "composite", label: "box", entry: "fora", children: [leaf("dentro", "sink")] },
          leaf("fora", "sink"),
        ],
      }),
    ).toThrow(/não é filho de fluxo dele/);
  });

  it("recusa fronteira que aponta para um estático", () => {
    expect(() =>
      indexTree({
        id: "r",
        kind: "composite",
        label: "r",
        entry: "note",
        children: [plate("note"), leaf("a", "sink")],
      }),
    ).toThrow(/não é filho de fluxo dele/);
  });

  it("recusa fronteira que aponta para o próprio contêiner", () => {
    expect(() =>
      indexTree({
        id: "r",
        kind: "composite",
        label: "r",
        entry: "r",
        children: [leaf("a", "sink")],
      }),
    ).toThrow(/não é filho de fluxo dele/);
  });

  it("entryLeaf e exitLeaf param no contêiner só de estáticos, como isOpenable", () => {
    const t = indexTree({
      id: "r",
      kind: "composite",
      label: "r",
      children: [
        {
          id: "grp",
          kind: "composite",
          label: "grp",
          children: [plate("k1"), plate("k2")],
        },
      ],
    });
    expect(entryLeaf(t, "grp")).toBe("grp");
    expect(exitLeaf(t, "grp")).toBe("grp");
  });

  it("a válvula leaf permite comportamento próprio mesmo com filhos de fluxo", () => {
    expect(() =>
      indexTree({
        id: "r",
        kind: "composite",
        label: "r",
        children: [
          {
            id: "shut",
            kind: "pipeline",
            label: "shut",
            leaf: true,
            behavior: (s) => ({ state: s, out: [] }),
            children: [leaf("x", "sink")],
          },
        ],
      }),
    ).not.toThrow();
  });

  it("a válvula dynamic permite comportamento próprio mesmo com filhos de fluxo", () => {
    expect(() =>
      indexTree({
        id: "r",
        kind: "composite",
        label: "r",
        children: [
          {
            id: "q",
            kind: "buffer",
            label: "q",
            dynamic: true,
            behavior: (s) => ({ state: s, out: [] }),
            children: [leaf("item", "sink")],
          },
        ],
      }),
    ).not.toThrow();
  });

  it("a descida para em objeto dinâmico: os filhos dele são conteúdo, não destino", () => {
    const t = indexTree({
      id: "r",
      kind: "composite",
      label: "r",
      children: [
        {
          id: "q",
          kind: "buffer",
          label: "q",
          dynamic: true,
          behavior: (s) => ({ state: s, out: [] }),
          children: [leaf("item", "sink")],
        },
      ],
    });
    expect(entryLeaf(t, "q")).toBe("q");
    expect(exitLeaf(t, "q")).toBe("q");
  });

  it("recusa comportamento numa placa, que nunca é atravessada", () => {
    expect(() =>
      indexTree({
        id: "r",
        kind: "composite",
        label: "r",
        children: [leaf("note", "static"), leaf("a", "sink")],
      }),
    ).toThrow(/é placa e tem behavior/);
  });

  it("recusa id que contém os separadores do livro-caixa", () => {
    for (const mau of ["a.b", "a:b"]) {
      expect(() =>
        indexTree({ id: "r", kind: "composite", label: "r", children: [leaf(mau, "sink")] }),
      ).toThrow(/separam campos no livro-caixa/);
    }
  });

  it("flowChildren filtra por família, não pelo literal de um kind", () => {
    // Um filho de cada arquétipo do catálogo. Quando uma onda futura
    // acrescentar uma segunda placa, este teste passa a cobri-la sozinho — e
    // quebra se alguém voltar a comparar o kind na mão.
    const kinds = ["composite", "pipeline", "source", "router", "buffer", "sink", "channel", "static"] as const;
    const t = indexTree({
      id: "r",
      kind: "composite",
      label: "r",
      children: kinds.map((kind) =>
        familyOf(kind) === "plate"
          ? { id: kind, kind, label: kind, leaf: true }
          : leaf(kind, kind),
      ),
    });
    expect(flowChildren(t, "r")).toEqual(kinds.filter((kind) => familyOf(kind) !== "plate"));
  });

  it("indexa canais, que não são filhos de ninguém", () => {
    const t = indexTree(root, [
      { id: "pipe", kind: "channel", label: "pipe", children: [leaf("wire", "sink")] },
    ]);
    expect(t.byId.get("pipe")?.kind).toBe("channel");
    expect(t.parent.get("pipe")).toBeUndefined();
    expect(flowChildren(t, "root")).not.toContain("pipe");
  });
});
