import { describe, expect, it } from "vitest";
import { atribuir, iniciar, noBackend, nomeDeAltaCardinalidade, novoTracer, rodarManual, terminar } from "./modelo.js";

const final = (esquecerEnd: boolean, nomeComId = false) => rodarManual({ esquecerEnd, nomeComId }).at(-1)!.estado;

describe("manual spans", () => {
  it("a span leaves the process only when it ends, child first", () => {
    const e = final(false);
    expect(e.exportados.map((id) => e.spans.find((s) => s.id === id)!.nome)).toEqual(["charge card", "checkout"]);
    expect(noBackend(e).nuncaChegaram).toEqual([]);
  });

  it("the child names the span that was active when it started", () => {
    const e = final(false);
    const [raiz, filho] = e.spans;
    expect(filho!.parentId).toBe(raiz!.id);
  });

  it("an attribute set after end() is dropped, and the span says which", () => {
    const e = final(false);
    const raiz = e.spans[0]!;
    expect(raiz.atributos).toEqual({ "order.id": 8812 });
    expect(raiz.ignorados).toEqual(["order.total"]);
  });

  it("forgetting end(): the parent never arrives, and the child arrives an orphan", () => {
    const b = noBackend(final(true));
    expect(b.recebidos.map((r) => [r.span.nome, r.orfao])).toEqual([["charge card", true]]);
    expect(b.nuncaChegaram.map((s) => s.nome)).toEqual(["checkout"]);
  });

  it("without end(), a later setAttribute still sticks — to a span nobody will ever see", () => {
    const raiz = final(true).spans[0]!;
    expect(raiz.fim).toBeUndefined();
    expect(raiz.atributos).toEqual({ "order.id": 8812, "order.total": 129.9 });
  });

  it("an id in the span name is flagged as high cardinality; the attribute is the right place", () => {
    expect(nomeDeAltaCardinalidade(final(false, true).spans[0]!.nome)).toBe(true);
    expect(nomeDeAltaCardinalidade("checkout")).toBe(false);
    expect(nomeDeAltaCardinalidade("charge card")).toBe(false);
  });

  it("ending a span pops it from the context, so the next start is a sibling, not a child", () => {
    let e = iniciar(novoTracer(), "a");
    e = iniciar(e, "b");
    e = terminar(e, "b");
    e = iniciar(e, "c");
    const [a, , c] = e.spans;
    expect(c!.parentId).toBe(a!.id);
    expect(atribuir(e, "b", "k", 1).spans[1]!.ignorados).toEqual(["k"]);
  });
});
