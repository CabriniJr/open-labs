import { World } from "@ovh/depth-core";
import { describe, expect, it } from "vitest";
import { LEITOR_DO_SPAN } from "./estado.js";
import { heroiWorld } from "./world.js";

describe("LEITOR_DO_SPAN", () => {
  it("dá a MESMA chave ao span antes e depois do collector", () => {
    /*
      O motor dá id novo a cada emissão — e está certo, cada salto é uma
      mensagem nova. Quem diz que duas mensagens são a mesma coisa é o domínio,
      e é esta chave. Se ela mudasse no meio do caminho, o trajeto do herói
      acabaria na primeira parada.
    */
    const mundo = new World(heroiWorld());
    const chavesPorTrace = new Map<string, Set<string>>();
    for (let i = 0; i < 20; i += 1) {
      mundo.advance(1);
      for (const item of mundo.state.flight) {
        const spans = item.message.data["spans"];
        if (!Array.isArray(spans) || spans.length === 0) continue;
        const traceId = String((spans[0] as { traceId: string }).traceId);
        const chave = LEITOR_DO_SPAN.chave(item.message);
        if (chave === undefined) continue;
        const vistas = chavesPorTrace.get(traceId) ?? new Set<string>();
        vistas.add(chave);
        chavesPorTrace.set(traceId, vistas);
      }
    }
    expect(chavesPorTrace.size).toBeGreaterThan(0);
    expect([...chavesPorTrace.values()].every((c) => c.size === 1)).toBe(true);
  });

  it("o corpo mostra o recurso, que é onde o enriquecimento acontece", () => {
    const mundo = new World(heroiWorld());
    mundo.advance(6);
    const emVoo = mundo.state.flight.find((item) =>
      Array.isArray(item.message.data["spans"]),
    );
    expect(emVoo).toBeDefined();
    const corpo = LEITOR_DO_SPAN.corpo(emVoo!.message) as Record<string, unknown>;
    expect(corpo["resource"]).toBeDefined();
    expect(corpo["name"]).toBeDefined();
  });
});
