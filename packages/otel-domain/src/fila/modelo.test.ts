import { describe, expect, it } from "vitest";
import { parseTraceparent } from "../traceparent.js";
import { consumirLote, consumirUm, esperar, novaFila, publicar, rodarFila, tracesDaFila } from "./modelo.js";

const final = (injetar: boolean, modo: "um" | "lote") => rodarFila({ injetar, modo }).at(-1)!.estado;

describe("propagating through a queue", () => {
  it("the producer writes its publish span into the message headers", () => {
    const e = publicar(novaFila(true));
    const pub = e.spans.find((s) => s.tipo === "PRODUCER")!;
    expect(parseTraceparent(e.fila[0]!.headers.traceparent!)!.spanId).toBe(pub.spanId);
    expect(publicar(novaFila(false)).fila[0]!.headers).toEqual({});
  });

  it("one message at a time: process is a child of publish, and the trace continues", () => {
    const e = final(true, "um");
    const traces = tracesDaFila(e);
    expect(traces).toHaveLength(3);
    for (const t of traces) expect(t.spans.map((s) => s.tipo)).toEqual(["SERVER", "PRODUCER", "CONSUMER"]);
    const proc = e.spans.filter((s) => s.tipo === "CONSUMER");
    const pubs = e.spans.filter((s) => s.tipo === "PRODUCER");
    proc.forEach((p, i) => expect(p.parentId).toBe(pubs[i]!.spanId));
  });

  it("a batch cannot have three parents: it starts its own trace and links to each publish", () => {
    const e = final(true, "lote");
    const traces = tracesDaFila(e);
    expect(traces).toHaveLength(4);
    const lote = e.spans.find((s) => s.tipo === "CONSUMER")!;
    expect(lote.parentId).toBeUndefined();
    expect(lote.links.map((l) => l.spanId)).toEqual(e.spans.filter((s) => s.tipo === "PRODUCER").map((s) => s.spanId));
    expect(traces.filter((t) => t.apontadoPor.length === 1)).toHaveLength(3);
  });

  it("without injection the trace ends at publish and the consumer is an orphan root", () => {
    for (const modo of ["um", "lote"] as const) {
      const traces = tracesDaFila(final(false, modo));
      expect(traces.filter((t) => t.orfao)).toHaveLength(modo === "um" ? 3 : 1);
      expect(traces.every((t) => t.apontadoPor.length === 0)).toBe(true);
    }
  });

  it("waiting time is the gap between publish and consume, per message", () => {
    let e = publicar(novaFila(true));
    e = esperar(e, 500);
    e = publicar(e);
    e = esperar(e, 1000);
    expect(consumirLote(e).consumos[0]!.mensagens.map((m) => m.esperou)).toEqual([1500, 1000]);
    expect(consumirUm(e).consumos[0]!.mensagens[0]!.esperou).toBe(1500);
  });
});
