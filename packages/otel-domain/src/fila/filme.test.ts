import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeDaFila } from "./filme.js";
import { rodarFila } from "./modelo.js";

const fim = (f: ReturnType<typeof filmeDaFila>, cap: string) => frameAt(f, f.chapters.find((c) => c.id === cap)!.end);
const op = (q: ReturnType<typeof fim>, id: string) => q.entities.find((e) => e.spec.id === id)!.state.opacity;

describe("the queue film is read from the model", () => {
  it("messages sit in the queue after publish and leave it on consume", () => {
    const f = filmeDaFila();
    expect(op(fim(f, "publish"), "slot:msg-1")).toBeGreaterThan(0.9);
    expect(op(fim(f, "extract"), "slot:msg-1")).toBeLessThan(0.05);
  });

  it("in 3D, a message is as tall as the time it waited", () => {
    const f = filmeDaFila();
    const e = rodarFila().at(-1)!.estado;
    for (const m of e.consumos.flatMap((c) => c.mensagens)) expect(f.entities.find((x) => x.id === `slot:${m.id}`)!.height).toBe(4 + m.esperou / 60);
  });

  it("links are drawn only for the batch, and only when the context was injected", () => {
    const n = (injetar: boolean, modo: "um" | "lote") => filmeDaFila({ injetar, modo }).entities.filter((e) => e.id.startsWith("lk:")).length;
    expect([n(true, "lote"), n(true, "um"), n(false, "lote")]).toEqual([3, 0, 0]);
  });

  it("without injection the backend shows orphans; with it, none", () => {
    const sem = filmeDaFila({ injetar: false, modo: "um" });
    expect(sem.entities.filter((e) => e.id.startsWith("orf:"))).toHaveLength(3);
    expect(op(fim(sem, "backend"), "orf:3")).toBeGreaterThan(0.9);
    expect(filmeDaFila({ injetar: true, modo: "um" }).entities.some((e) => e.id.startsWith("orf:"))).toBe(false);
  });
});
