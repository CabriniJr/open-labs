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
        leaf("note", "static"),
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
    for (const kind of ["composite", "source", "router", "pipeline", "buffer", "sink"] as const) {
      expect(familyOf(kind)).toBe("block");
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
  it("ignora os estáticos, que não são atravessados", () => {
    const t = indexTree(root);
    expect(flowChildren(t, "box")).toEqual(["gate", "chain"]);
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
    expect(visibleChild(t, "root", "a")).toBe("box");
    expect(visibleChild(t, "box", "a")).toBe("chain");
  });

  it("devolve null quando a folha é o próprio foco", () => {
    const t = indexTree(root);
    expect(visibleChild(t, "gate", "gate")).toBeNull();
  });

  it("devolve 'outside' quando a folha está fora do foco", () => {
    const t = indexTree(root);
    expect(visibleChild(t, "box", "src")).toBe("outside");
  });
});
