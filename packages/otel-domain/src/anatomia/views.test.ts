import { describe, expect, it } from "vitest";
import { indexTree } from "@ovh/depth-core";
import { viewDisagreement } from "@ovh/depth-ui";
import { anatomiaWorld } from "./world.js";
import { VIEWS_DA_ANATOMIA } from "./views.js";

const spec = anatomiaWorld();
const arvore = indexTree(spec.root, spec.channels);

describe("a view da anatomia diz a verdade sobre a árvore", () => {
  it.each(VIEWS_DA_ANATOMIA.map((v) => [v.id, v] as const))(
    "%s não inventa nem esconde",
    (_id, view) => {
      expect(viewDisagreement(arvore, view)).toBeNull();
    },
  );

  it("os quatro serviços estão na MESMA fileira", () => {
    // A fileira é a afirmação de que a requisição anda para frente. Um deles
    // fora dela viraria hierarquia — e hierarquia é o que este lab nega.
    const naFileira = VIEWS_DA_ANATOMIA[0]!.places.filter((p) =>
      ["gateway", "checkout", "payments", "ledger"].includes(p.id),
    );
    expect(naFileira).toHaveLength(4);
    expect(new Set(naFileira.map((p) => p.y)).size).toBe(1);
    expect(new Set(naFileira.map((p) => `${p.w}×${p.h}`)).size).toBe(1);
  });

  it("o backend fica embaixo dos quatro, e é largo o bastante para todos", () => {
    const places = VIEWS_DA_ANATOMIA[0]!.places;
    const backend = places.find((p) => p.id === "backend")!;
    const servicos = places.filter((p) => ["gateway", "checkout", "payments", "ledger"].includes(p.id));
    for (const servico of servicos) {
      expect(backend.y).toBeGreaterThan(servico.y + servico.h);
      expect(backend.x).toBeLessThanOrEqual(servico.x);
      expect(backend.x + backend.w).toBeGreaterThanOrEqual(servico.x + servico.w);
    }
  });
});
