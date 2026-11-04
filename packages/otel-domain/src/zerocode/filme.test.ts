import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeZeroCode } from "./filme.js";
import { traceDaRequisicao } from "./modelo.js";

const fim = (f: ReturnType<typeof filmeZeroCode>, cap: string) => frameAt(f, f.chapters.find((c) => c.id === cap)!.end);
const estado = (q: ReturnType<typeof fim>, id: string) => q.entities.find((e) => e.spec.id === id)!.state;

describe("the zero-code film is read from the model", () => {
  it("in 3D the stack stands up: framework on top, your code in the middle, libraries below", () => {
    const f = filmeZeroCode();
    const elev = (id: string) => f.entities.find((e) => e.id === id)!.elevation;
    expect([elev("p:framework"), elev("p:regras"), elev("p:db")]).toEqual([40, 20, 0]);
  });

  it("the agent lights the libraries and leaves your code dark", () => {
    const q = fim(filmeZeroCode(), "request");
    expect(estado(q, "p:db").tone).toBe("kind-1");
    expect(estado(q, "p:regras").tone).toBe("muted");
  });

  it("the dark bars are the model's unexplained intervals", () => {
    for (const manual of [false, true]) {
      const f = filmeZeroCode({ manual });
      const t = traceDaRequisicao(new Set(manual ? ["regras"] : []));
      expect(f.entities.filter((e) => e.id.startsWith("esc:"))).toHaveLength(t.escuro.length);
    }
  });

  it("the manual span shows up as a bar of its own", () => {
    const f = filmeZeroCode({ manual: true });
    expect(f.entities.some((e) => e.type === "bar" && e.label?.includes("apply discount rules · 70 ms · manual"))).toBe(true);
  });
});
