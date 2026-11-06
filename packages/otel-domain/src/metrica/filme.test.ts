import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeDaMetrica } from "./filme.js";
import { roteiro, rodar } from "./modelo.js";

const fim = (f: ReturnType<typeof filmeDaMetrica>, cap: string) => frameAt(f, f.chapters.find((c) => c.id === cap)!.end);
const estado = (q: ReturnType<typeof fim>, id: string) => q.entities.find((e) => e.spec.id === id)!.state;

describe("the metric film is read from the model", () => {
  it("the aggregator box shows what the reducer holds after the first interval", () => {
    const f = filmeDaMetrica({ temporalidade: "cumulative", reinicio: false });
    expect(estado(fim(f, "measure"), "agg:count").label).toBe("count 6");
    // Delta zera na coleta; cumulative não.
    expect(estado(fim(f, "collect"), "agg:count").label).toBe("count 6");
    const d = filmeDaMetrica({ temporalidade: "delta", reinicio: false });
    expect(estado(fim(d, "collect"), "agg:count").label).toBe("count 0");
  });

  it("every exported point becomes a column, in the number the model exported", () => {
    const op = { temporalidade: "cumulative", reinicio: true } as const;
    const f = filmeDaMetrica(op);
    const c = rodar(roteiro(op), op.temporalidade);
    const q = fim(f, "backend");
    c.pontos.forEach((p, k) => expect(estado(q, `col:${k}`).label).toBe(String(p.contagem)));
    expect(estado(q, "col:2").tone).toBe("live");
  });

  it("a naive cumulative backend reads negative requests after the restart; delta never does", () => {
    const f = filmeDaMetrica({ temporalidade: "cumulative", reinicio: true });
    expect(estado(fim(f, "backend"), "ler:2").label.startsWith("-9")).toBe(true);
    const d = filmeDaMetrica({ temporalidade: "delta", reinicio: true });
    const q = fim(d, "backend");
    for (let k = 0; k < 4; k += 1) expect(estado(q, `ler:${k}`).label.startsWith("+")).toBe(true);
  });

  it("in 3D, a histogram cell's height is its count", () => {
    const f = filmeDaMetrica({ temporalidade: "delta", reinicio: false });
    const c = rodar(roteiro({ temporalidade: "delta", reinicio: false }), "delta");
    c.pontos.forEach((p, k) => p.baldes.forEach((n, b) => expect(f.entities.find((e) => e.id === `h:${k}:${b}`)!.height).toBe(2 + n * 6)));
  });
});
