import { describe, expect, it } from "vitest";
import { ativasNoSegundo, investigar, MINUTOS_PARA_DETECTAR, MINUTOS_POR_CANDIDATO, trafego } from "./modelo.js";

describe("the cost of disconnected signals", () => {
  it("the traffic is deterministic and has exactly one failure", () => {
    expect(trafego(20)).toEqual(trafego(20));
    expect(trafego(20).filter((r) => r.erro)).toHaveLength(1);
  });

  it("by time, every request active in the error's second is a candidate — the failure among them", () => {
    const inc = investigar({ rps: 20, contexto: false });
    expect(inc.busca.candidatos.length).toBeGreaterThan(10);
    expect(inc.busca.candidatos).toContain(inc.falha);
    expect(inc.busca.candidatos).toEqual(ativasNoSegundo(inc.requisicoes, inc.log.segundo));
  });

  it("by trace_id, there is one candidate, and it is the failure", () => {
    const inc = investigar({ rps: 20, contexto: true });
    expect(inc.busca.candidatos).toEqual([inc.falha]);
    expect(inc.log.traceId).toBe(inc.falha.traceId);
    expect(inc.busca.minutos).toBe(MINUTOS_PARA_DETECTAR + MINUTOS_POR_CANDIDATO);
  });

  it("the cost of a timestamp search grows with traffic, not with the error", () => {
    const n = (rps: number) => investigar({ rps, contexto: false }).busca.candidatos.length;
    expect(n(5)).toBeLessThan(n(20));
    expect(n(20)).toBeLessThan(n(80));
    expect(investigar({ rps: 80, contexto: true }).busca.candidatos).toHaveLength(1);
  });
});
