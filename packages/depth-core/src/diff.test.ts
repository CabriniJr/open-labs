import { describe, expect, it } from "vitest";
import { diffStates } from "./diff.js";

describe("diffStates", () => {
  it("devolve vazio para estados iguais", () => {
    expect(diffStates({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it("aponta o caminho de um campo escalar alterado", () => {
    expect(diffStates({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual(["b"]);
  });

  it("desce em objetos aninhados", () => {
    const before = { node: { attributes: { code: 200 } } };
    const after = { node: { attributes: { code: 500 } } };
    expect(diffStates(before, after)).toEqual(["node.attributes.code"]);
  });

  it("indexa elementos de array", () => {
    expect(diffStates({ xs: [1, 2, 3] }, { xs: [1, 9, 3] })).toEqual(["xs.1"]);
  });

  it("reporta campos adicionados e removidos", () => {
    expect(diffStates({ a: 1 }, { a: 1, b: 2 })).toEqual(["b"]);
    expect(diffStates({ a: 1, b: 2 }, { a: 1 })).toEqual(["b"]);
  });

  it("reporta o array inteiro quando o tamanho muda no fim", () => {
    expect(diffStates({ xs: [1] }, { xs: [1, 2] })).toEqual(["xs.1"]);
  });

  it("trata troca de tipo como alteração", () => {
    expect(diffStates({ a: 1 }, { a: "1" })).toEqual(["a"]);
  });
});
