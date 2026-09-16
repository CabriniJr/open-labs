import { describe, expect, it } from "vitest";
import { indexTree } from "@ovh/depth-core";
import { DESCRICOES, MAL_ENTENDIDOS } from "./labels.js";
import { otelWorld } from "./world.js";

const arvore = () => {
  const spec = otelWorld();
  return indexTree(spec.root, spec.channels);
};

describe("os rótulos, as descrições e os mal-entendidos", () => {
  it("todo objeto que o leitor pode selecionar tem descrição", () => {
    for (const id of arvore().byId.keys()) {
      expect(DESCRICOES[id], id).toBeDefined();
    }
  });

  it("o mundo sem SDK também: o silêncio precisa de ficha, senão ele é só uma caixa parada", () => {
    const spec = otelWorld({ semSdk: true });
    for (const id of indexTree(spec.root, spec.channels).byId.keys()) {
      expect(DESCRICOES[id], id).toBeDefined();
    }
  });

  it("nenhuma descrição sobra: uma chave que não é objeto é texto que ninguém lê", () => {
    const ids = new Set(arvore().byId.keys());
    for (const chave of Object.keys(DESCRICOES)) {
      expect(ids.has(chave), chave).toBe(true);
    }
  });

  it("todo mal-entendido aponta para um objeto que existe e tem fonte", () => {
    const ids = arvore().byId;
    expect(MAL_ENTENDIDOS.length).toBeGreaterThan(0);
    for (const m of MAL_ENTENDIDOS) {
      expect(ids.has(m.onde), m.onde).toBe(true);
      expect(m.fonte).toMatch(/^https:\/\/(opentelemetry\.io|www\.w3\.org)\//u);
    }
  });

  it("o bloco opaco se declara opaco, e diz para onde ir", () => {
    expect(DESCRICOES["collector"]).toMatch(/not modelled/iu);
    expect(DESCRICOES["collector"]).toMatch(/Collector pipeline lab/iu);
    expect(DESCRICOES["otlp-out"]).toMatch(/opaque/iu);
  });

  it("a placa diz que nada a fia — é o que a torna honesta", () => {
    expect(DESCRICOES["resource-traces"]).toMatch(/never traversed|consulted/iu);
  });
});
