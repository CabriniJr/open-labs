import { describe, expect, it } from "vitest";
import { DURACAO_DA_REQUISICAO, PASSOS_PROPRIOS, traceDaRequisicao } from "./modelo.js";

describe("zero-code instrumentation", () => {
  it("the agent sees the edges: the server, the database driver and the HTTP client", () => {
    const t = traceDaRequisicao();
    expect(t.spans.map((s) => s.nome)).toEqual(["POST /checkout", "SELECT shop.stock", "POST"]);
    expect(t.spans.every((s) => s.origem === "auto")).toBe(true);
  });

  it("the business code is dark: most of the request is unexplained self time", () => {
    const t = traceDaRequisicao();
    expect(t.msEscuros).toBe(DURACAO_DA_REQUISICAO - 40 - 50);
    expect(t.cobertura).toBeCloseTo(90 / 240);
  });

  it("one manual span lights exactly its own step", () => {
    const antes = traceDaRequisicao();
    const depois = traceDaRequisicao(new Set(["regras"]));
    expect(antes.msEscuros - depois.msEscuros).toBe(70);
    expect(depois.spans.find((s) => s.origem === "manual")!.nome).toBe("apply discount rules");
  });

  it("wrapping every own step leaves only the framework's own work dark", () => {
    const t = traceDaRequisicao(new Set(PASSOS_PROPRIOS));
    expect(t.escuro).toEqual([
      { inicio: 0, fim: 5 },
      { inicio: 230, fim: 240 },
    ]);
  });
});
