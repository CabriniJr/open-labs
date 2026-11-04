import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { ATRIBUTOS_DA_CARDINALIDADE } from "./labels.js";
import { bytesDasChaves, etapasDoCubo, filmeDaVitrineDaCardinalidade } from "./vitrine.js";

describe("the cardinality showcase", () => {
  it("each step multiplies, and the steps are the lab's own arithmetic", () => {
    expect(etapasDoCubo().map((e) => e.series)).toEqual([1, 12, 72, 288, 2_304_000]);
    expect(etapasDoCubo({ comCliente: false }).map((e) => e.series)).toEqual([1, 12, 72, 288]);
  });

  it("the key bytes are the UTF-8 length of each attribute name", () => {
    const route = ATRIBUTOS_DA_CARDINALIDADE.find((a) => a.id === "route")!;
    expect(bytesDasChaves([route])).toBe("http.route".length);
  });

  it("the counter ends on the series the model computed", () => {
    const f = filmeDaVitrineDaCardinalidade();
    const q = frameAt(f, f.chapters.find((c) => c.id === "customer")!.end);
    expect(q.entities.find((e) => e.spec.id === "contador")!.state.label).toBe("2 304 000");
  });

  it("in 3D the method turns a flat cell into a tower as tall as its values", () => {
    const f = filmeDaVitrineDaCardinalidade();
    expect(f.entities.find((e) => e.id === "c:0:0")!.height).toBe(6);
    expect(f.entities.find((e) => e.id === "m:0:0")!.height).toBe(24);
  });

  it("without the customer attribute there is no customer chapter and no ghost cubes", () => {
    const f = filmeDaVitrineDaCardinalidade({ comCliente: false });
    expect(f.chapters.some((c) => c.id === "customer")).toBe(false);
    expect(f.entities.some((e) => e.id.startsWith("g:"))).toBe(false);
  });
});
