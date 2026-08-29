import { describe, expect, it } from "vitest";
import { indexTree } from "@ovh/depth-core";
import type { AnyObject, Wire } from "@ovh/depth-core";
import { autoView, pathTo } from "./auto-view.js";
import { viewDisagreement } from "./view.js";

const folha = (id: string): AnyObject => ({
  id,
  kind: "router",
  label: id,
  leaf: true,
  behavior: (state) => ({ state, out: [] }),
});

const arvore = indexTree({
  id: "raiz",
  kind: "composite",
  label: "raiz",
  children: [
    folha("a"),
    folha("b"),
    {
      id: "caixa",
      kind: "composite",
      label: "caixa",
      children: [folha("dentro1"), folha("dentro2")],
    },
  ],
});

const wires: readonly Wire[] = [
  { from: "a", port: "out", to: "b" },
  { from: "b", port: "out", to: "dentro1" },
  { from: "dentro1", port: "out", to: "dentro2" },
];

describe("view montada sozinha", () => {
  it("concorda com a árvore, como qualquer outra view", () => {
    expect(viewDisagreement(arvore, autoView(arvore, "raiz", wires))).toBeNull();
    expect(viewDisagreement(arvore, autoView(arvore, "caixa", wires))).toBeNull();
  });

  it("quem tem interior sai marcado, e não some calado", () => {
    const view = autoView(arvore, "raiz", wires);
    expect(view.places.find((p) => p.id === "caixa")?.collapsed).toBe(true);
    expect(view.places.find((p) => p.id === "a")?.collapsed).toBeUndefined();
  });

  it("a ordem do fluxo vira a ordem das colunas", () => {
    const view = autoView(arvore, "raiz", wires);
    const x = (id: string): number => view.places.find((p) => p.id === id)?.x ?? -1;
    expect(x("a")).toBeLessThan(x("b"));
    expect(x("b")).toBeLessThan(x("caixa"));
  });

  it("realimentação não trava o cálculo das camadas", () => {
    // Um laço entre irmãos é legítimo (ele atravessa uma borda de relógio); o
    // que não pode é a montagem da view girar para sempre por causa dele.
    const comVolta: readonly Wire[] = [...wires, { from: "caixa", port: "out", to: "a" }];
    expect(viewDisagreement(arvore, autoView(arvore, "raiz", comVolta))).toBeNull();
  });

  it("a trilha vai da raiz até o objeto", () => {
    expect(pathTo(arvore, "dentro1")).toEqual(["raiz", "caixa", "dentro1"]);
    expect(pathTo(arvore, "raiz")).toEqual(["raiz"]);
  });
});
