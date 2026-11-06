import { describe, expect, it } from "vitest";
import { MEMORIA_MAXIMA, novaPressao, rodarPressao, tick, totalDeLotes, VAZAO } from "./modelo.js";

const fim = (fila: number, limiter: boolean) => rodarPressao({ fila, limiter }).at(-1)!;

describe("backpressure and drops", () => {
  it("every batch ends somewhere: delivered, still queued, or in exactly one drop counter", () => {
    for (const fila of [4, 15]) {
      for (const limiter of [true, false]) {
        const e = fim(fila, limiter);
        expect(totalDeLotes(e.contadores) + e.fila.length).toBe(24);
      }
    }
  });

  it("with the backend up, everything is delivered and the queue stays empty", () => {
    let e = novaPressao();
    for (let i = 0; i < 6; i += 1) e = tick(e, { fila: 4, limiter: true }, true);
    expect(e.contadores.entregues).toBe(6);
    expect(e.fila).toHaveLength(0);
  });

  it("a failed batch waits longer each time: 1, 2, 4 ticks", () => {
    let e = tick(novaPressao(), { fila: 4, limiter: true }, false);
    expect(e.fila[0]!.proximaTentativa - (e.t - 1)).toBe(1);
    const esperas: number[] = [];
    let ultima = e.fila[0]!.proximaTentativa;
    for (let i = 0; i < 6; i += 1) {
      e = tick(e, { fila: 4, limiter: true }, false);
      const l = e.fila.find((x) => x.id === 1)!;
      if (l.proximaTentativa !== ultima) {
        esperas.push(l.proximaTentativa - (e.t - 1));
        ultima = l.proximaTentativa;
      }
    }
    expect(esperas.slice(0, 2)).toEqual([2, 4]);
  });

  it("a small queue drops new batches as 'queue full'", () => {
    const e = fim(4, true);
    expect(e.contadores.filaCheia).toBeGreaterThan(0);
    expect(e.contadores.recusados).toBe(0);
    expect(e.contadores.perdidosNoCrash).toBe(0);
  });

  it("a big queue with the limiter refuses at the edge before memory runs out", () => {
    const e = fim(15, true);
    expect(e.contadores.recusados).toBeGreaterThan(0);
    expect(e.contadores.perdidosNoCrash).toBe(0);
  });

  it("a big queue without the limiter crashes the process and loses the queue", () => {
    const corrida = rodarPressao({ fila: 15, limiter: false });
    const crash = corrida.find((x) => x.caiu)!;
    // A fila cheia até o teto, mais o lote que chegava: tudo morre com o processo.
    expect(crash.contadores.perdidosNoCrash).toBe(MEMORIA_MAXIMA + 1);
    expect(crash.fila).toHaveLength(0);
  });

  it("retries give up after max_elapsed_time, and the backend coming back drains at the exporter's pace", () => {
    const corrida = rodarPressao({ fila: 4, limiter: true });
    expect(corrida.at(-1)!.contadores.retryEsgotado).toBeGreaterThan(0);
    const volta = corrida.find((x) => x.t === 17)!;
    expect(volta.entreguesAgora).toBeLessThanOrEqual(VAZAO);
  });
});
