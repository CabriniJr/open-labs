import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { execucaoDaVitrine, filmeDaVitrine } from "./filme.js";

describe("the CPU showcase is the real execution", () => {
  it("adds 5 and 7 through the reference RV32I, and the ripple carry agrees", () => {
    const e = execucaoDaVitrine();
    expect([e.a, e.b, e.soma]).toEqual([5, 7, 12]);
    const reconstruida = e.estagios.reduce((n, s, i) => n | (s.s << i), 0);
    expect(reconstruida).toBe(e.soma);
    expect(e.estagios.slice(0, 4).map((s) => s.cout)).toEqual([1, 1, 1, 0]);
  });

  it("shows one level at a time: diving swaps the chip for the datapath, the datapath for the gates", () => {
    const f = filmeDaVitrine();
    const op = (t: number, id: string) => frameAt(f, t).entities.find((x) => x.spec.id === id)!.state.opacity;
    const fim = (id: string) => f.chapters.find((c) => c.id === id)!.end;
    expect(op(fim("board"), "chip")).toBeGreaterThan(0.9);
    expect(op(fim("core"), "chip")).toBeLessThan(0.05);
    expect(op(fim("core"), "regs")).toBeGreaterThan(0.9);
    expect(op(fim("gates"), "regs")).toBeLessThan(0.05);
    expect(op(fim("gates"), "g:or")).toBeGreaterThan(0.9);
    expect(op(fim("board"), "g:or")).toBeLessThan(0.05);
  });

  it("the camera keeps the dive target on screen the whole way down", () => {
    const f = filmeDaVitrine();
    const c = f.chapters.find((x) => x.id === "gates")!;
    for (let k = 0; k <= 10; k += 1) {
      const t = c.start + ((c.end - c.start) * k) / 10;
      const q = frameAt(f, t);
      const alvo = q.entities.find((x) => x.spec.id === "g:x2")!.spec;
      if (alvo.type !== "node") throw new Error();
      const cx = alvo.box.x + alvo.box.w / 2;
      const meiaLargura = f.width / q.camera.zoom / 2;
      expect(Math.abs(cx - q.camera.cx)).toBeLessThan(meiaLargura * 1.05);
    }
  });
});
