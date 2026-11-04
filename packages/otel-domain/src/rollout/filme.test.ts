import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeDoRollout } from "./filme.js";
import { ORDEM_CODIGO_PRIMEIRO, planejar } from "./modelo.js";

describe("the rollout film is read from the plan", () => {
  it("in 3D the steps are a staircase", () => {
    const f = filmeDoRollout();
    expect(["e:collector", "e:auto", "e:contexto"].map((id) => f.entities.find((e) => e.id === id)!.elevation)).toEqual([0, 12, 24]);
  });

  it("the recommended order has no risk notes; code-first has one per step done too early", () => {
    expect(filmeDoRollout({ ordem: "recomendada" }).entities.some((e) => e.id.startsWith("risco:"))).toBe(false);
    const cedo = planejar(ORDEM_CODIGO_PRIMEIRO).filter((p) => p.faltando.length > 0).length;
    expect(filmeDoRollout({ ordem: "codigo-primeiro" }).entities.filter((e) => e.id.startsWith("risco:"))).toHaveLength(cedo);
  });

  it("a step done early turns red", () => {
    const f = filmeDoRollout({ ordem: "codigo-primeiro" });
    const q = frameAt(f, f.chapters.find((c) => c.id === "manual")!.end);
    expect(q.entities.find((e) => e.spec.id === "e:manual")!.state.tone).toBe("live");
  });
});
