import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeDaPressao } from "./filme.js";
import { rodarPressao, SPANS_POR_LOTE } from "./modelo.js";

const fim = (f: ReturnType<typeof filmeDaPressao>, cap: string) => frameAt(f, f.chapters.find((c) => c.id === cap)!.end);
const estado = (q: ReturnType<typeof fim>, id: string) => q.entities.find((e) => e.spec.id === id)!.state;

describe("the backpressure film is read from the model", () => {
  it("in 3D the queue is a column: each cell is one floor higher", () => {
    const f = filmeDaPressao();
    expect([0, 1, 2].map((k) => f.entities.find((e) => e.id === `cel:${k}`)!.elevation)).toEqual([0, 10, 20]);
  });

  it("the counters end on what the model counted", () => {
    for (const op of [{ fila: 4, limiter: true }, { fila: 15, limiter: true }, { fila: 15, limiter: false }]) {
      const f = filmeDaPressao(op);
      const c = rodarPressao(op).at(-1)!.contadores;
      const q = fim(f, "where");
      expect(estado(q, "n:entregues").label).toBe(`${c.entregues * SPANS_POR_LOTE} spans`);
      if (c.perdidosNoCrash > 0) expect(estado(q, "n:perdidosNoCrash").label).toBe(`${c.perdidosNoCrash * SPANS_POR_LOTE} spans`);
    }
  });

  it("the third chapter is named after what actually happened", () => {
    const titulo = (fila: number, limiter: boolean) => filmeDaPressao({ fila, limiter }).chapters.find((c) => c.id === "limit")!.title;
    expect(titulo(4, true)).toBe("The queue is full");
    expect(titulo(15, true)).toBe("The limiter refuses at the edge");
    expect(titulo(15, false)).toBe("No limiter: the process dies");
  });

  it("the backend turns red while it is down", () => {
    const f = filmeDaPressao();
    expect(estado(fim(f, "down"), "backend").tone).toBe("live");
    expect(estado(fim(f, "back"), "backend").tone).toBe("container");
  });
});
