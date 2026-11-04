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

  it("lifts the lid, then shows one level at a time on the way down", () => {
    const f = filmeDaVitrine();
    const op = (cap: string, id: string) => frameAt(f, f.chapters.find((c) => c.id === cap)!.end).entities.find((x) => x.spec.id === id)!.state.opacity;
    expect(op("board", "tampa")).toBeGreaterThan(0.9);
    expect(op("board", "die")).toBeLessThan(0.05);
    expect(op("lid", "tampa")).toBeLessThan(0.05);
    expect(op("lid", "die")).toBeGreaterThan(0.9);
    // Enquanto a tampa sobe, a planta do die ainda não existe: um nível por vez.
    expect(op("lid", "core")).toBeLessThan(0.05);
    expect(op("die", "core")).toBeGreaterThan(0.9);
    expect(op("die", "placa")).toBeLessThan(0.05);
    expect(op("core", "regs")).toBeGreaterThan(0.9);
    expect(op("core", "core")).toBeLessThan(0.05);
    expect(op("alu", "somador")).toBeGreaterThan(0.9);
    expect(op("alu", "regs")).toBeLessThan(0.05);
    expect(op("adder", "fa:2")).toBeGreaterThan(0.9);
    expect(op("gates", "g:or")).toBeGreaterThan(0.9);
    expect(op("gates", "fa:2")).toBeLessThan(0.05);
    // E o filme fecha o ciclo: a tampa volta no fim, para a vitrine poder repetir.
    expect(op("up", "tampa")).toBeGreaterThan(0.9);
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
