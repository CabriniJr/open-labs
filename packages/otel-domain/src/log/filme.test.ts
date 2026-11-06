import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeDoLog } from "./filme.js";

const fim = (f: ReturnType<typeof filmeDoLog>, cap: string) => frameAt(f, f.chapters.find((c) => c.id === cap)!.end);
const estado = (q: ReturnType<typeof fim>, id: string) => q.entities.find((e) => e.spec.id === id)!.state;

describe("the log film is read from the model", () => {
  it("the thread shows the active span while it is open, and none after it ends", () => {
    const f = filmeDoLog();
    expect(estado(fim(f, "active"), "th:main").sublabel).toMatch(/^active: span /);
    expect(estado(fim(f, "after"), "th:main").sublabel).toBe("active context: none");
  });

  it("a worker created without the context is drawn as having none", () => {
    const f = filmeDoLog({ ponte: true, propagar: false });
    const s = estado(fim(f, "thread"), "th:worker");
    expect(s.sublabel).toBe("active context: none");
    expect(s.tone).toBe("live");
  });

  it("only joined logs get a link to their span; the rest get the reason", () => {
    const com = filmeDoLog({ ponte: true, propagar: true });
    expect(com.entities.filter((e) => e.id.startsWith("join:"))).toHaveLength(3);
    expect(estado(fim(com, "join"), "why:4").opacity).toBeGreaterThan(0.9);
    const sem = filmeDoLog({ ponte: false, propagar: true });
    expect(sem.entities.filter((e) => e.id.startsWith("join:"))).toHaveLength(0);
    expect(sem.entities.find((e) => e.id === "why:1")!.label).toContain("only in the text");
  });

  it("a closed span turns muted in the process", () => {
    const f = filmeDoLog();
    const q = fim(f, "after");
    expect(q.entities.filter((e) => e.spec.id.startsWith("sp:")).every((e) => e.state.tone === "muted")).toBe(true);
  });
});
