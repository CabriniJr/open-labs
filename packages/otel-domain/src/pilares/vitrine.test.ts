import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeDosPilares, incidente } from "./vitrine.js";

describe("the pillars showcase — the incident", () => {
  it("the metric keeps counts, not requests: the failing one shares its bucket", () => {
    const inc = incidente();
    expect(inc.baldes.reduce((n, b) => n + b.contagem, 0)).toBe(inc.requisicoes.length);
    expect(inc.baldes.at(-1)!.contagem).toBe(2);
  });

  it("without correlation, the timestamp is the only join, and it has four candidates", () => {
    const inc = incidente({ correlacao: false });
    expect(inc.logs.every((l) => l.traceId === undefined)).toBe(true);
    expect(inc.baldes.every((b) => b.exemplar === undefined)).toBe(true);
    expect(inc.candidatosPorHorario).toBe(4);
  });

  it("with correlation, the error log and the slow bucket's exemplar name the failing trace", () => {
    const inc = incidente({ correlacao: true });
    const trace = inc.traces.find((t) => t.n === inc.falha.n)!.traceId;
    expect(inc.logs.find((l) => l.nivel === "ERROR")!.traceId).toBe(trace);
    expect(inc.baldes.at(-1)!.exemplar!.traceId).toBe(trace);
  });
});

describe("the pillars showcase — the film", () => {
  const fim = (f: ReturnType<typeof filmeDosPilares>, cap: string) => frameAt(f, f.chapters.find((c) => c.id === cap)!.end);
  it("in 3D each signal sits on its own plane", () => {
    const f = filmeDosPilares();
    expect(["r:log", "r:met", "r:trc"].map((id) => f.entities.find((e) => e.id === id)!.elevation)).toEqual([0, 28, 56]);
  });

  it("the buckets end with the counts the incident produced", () => {
    const f = filmeDosPilares();
    const inc = incidente();
    const q = fim(f, "incident");
    inc.baldes.forEach((b, i) => expect(q.entities.find((e) => e.spec.id === `bal:${i}`)!.state.label).toBe(String(b.contagem)));
  });

  it("the column is solid with trace_id, and dashed by time without it", () => {
    const com = filmeDosPilares({ correlacao: true }).entities.find((e) => e.id === "coluna")!;
    const sem = filmeDosPilares({ correlacao: false }).entities.find((e) => e.id === "coluna")!;
    expect(com.type === "link" && com.dashed).toBe(false);
    expect(sem.type === "link" && sem.dashed).toBe(true);
    expect(sem.label).toContain("4 candidates");
  });
});
