import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeManual } from "./filme.js";

const fim = (f: ReturnType<typeof filmeManual>, cap: string) => frameAt(f, f.chapters.find((c) => c.id === cap)!.end);
const estado = (q: ReturnType<typeof fim>, id: string) => q.entities.find((e) => e.spec.id === id)!.state;

describe("the manual spans film is read from the model", () => {
  it("the child is exported before the parent ends", () => {
    const f = filmeManual();
    const exp = f.packets.map((p) => p.payload.split(" · ")[0]);
    expect(exp).toEqual(["charge card", "checkout"]);
  });

  it("the commented end() is drawn as a comment, and the parent never reaches the backend", () => {
    const f = filmeManual({ esquecerEnd: true, nomeComId: false });
    expect(f.entities.find((e) => e.id === "ln:5")!.label?.startsWith("// ")).toBe(true);
    expect(f.packets).toHaveLength(1);
    const q = fim(f, "backend");
    const orfao = q.entities.find((e) => e.spec.id.startsWith("rec:"))!;
    expect(orfao.state.tone).toBe("live");
    expect(orfao.state.sublabel).toMatch(/^orphan/);
  });

  it("the dropped attribute shows up only when the span had ended", () => {
    const com = filmeManual();
    expect(com.entities.some((e) => e.id.startsWith("ign:"))).toBe(true);
    const sem = filmeManual({ esquecerEnd: true, nomeComId: false });
    expect(sem.entities.some((e) => e.id.startsWith("ign:"))).toBe(false);
  });

  it("an id in the span name raises the cardinality note", () => {
    const f = filmeManual({ esquecerEnd: false, nomeComId: true });
    const nota = f.entities.find((e) => e.id.startsWith("card:"))!;
    expect(estado(fim(f, "start"), nota.id).opacity).toBeGreaterThan(0.9);
  });
});
