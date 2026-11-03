import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeDaImplantacao } from "./filme.js";
import { entregar, SPANS } from "./modelo.js";

describe("deployment patterns", () => {
  it("direct export opens one backend connection per app Pod, and nobody can tail-sample", () => {
    const e = entregar({ modo: "direct", rotearPorTrace: false });
    expect(e.conexoesComBackend).toBe(6);
    expect(e.decisores).toEqual([]);
    expect(e.traceInteiro).toEqual({ T1: false, T2: false });
  });

  it("an agent per node keeps traffic local, but each agent sees only its node's spans", () => {
    const e = entregar({ modo: "agent", rotearPorTrace: false });
    for (const s of SPANS) expect(e.caminhos.get(s.id)![0]!.para).toMatch(/^agent-/);
    expect(e.traceInteiro).toEqual({ T1: false, T2: false });
  });

  it("a gateway behind a Service pins each connection: traces are split across replicas", () => {
    const e = entregar({ modo: "gateway", rotearPorTrace: false });
    expect(e.conexoesComBackend).toBe(2);
    expect(e.traceInteiro).toEqual({ T1: false, T2: false });
  });

  it("agent + gateway with trace-ID routing delivers each trace whole to one replica", () => {
    const sem = entregar({ modo: "agent-gateway", rotearPorTrace: false });
    const com = entregar({ modo: "agent-gateway", rotearPorTrace: true });
    expect(sem.traceInteiro).toEqual({ T1: false, T2: false });
    expect(com.traceInteiro).toEqual({ T1: true, T2: true });
    expect([...com.visto.get("gateway-a")!.keys()]).toEqual(["T1"]);
    expect(com.caminhos.get("T1-cart")!.map((s) => s.para)).toEqual(["agent-2", "gateway-a", "backend"]);
  });
});

describe("the deployment film is derived from the model", () => {
  it("paints a replica green only when it really holds a whole trace", () => {
    const tom = (rotearPorTrace: boolean) => {
      const { filme } = filmeDaImplantacao({ modo: "agent-gateway", rotearPorTrace });
      const fim = frameAt(filme, filme.chapters.find((c) => c.id === "whole")!.end);
      return fim.entities.find((x) => x.spec.id === "col:gateway-a")!.state.tone;
    };
    expect(tom(true)).toBe("conduit");
    expect(tom(false)).toBe("live");
  });

  it("has one hop chapter per hop in the path", () => {
    const n = (modo: Parameters<typeof filmeDaImplantacao>[0]["modo"]) =>
      filmeDaImplantacao({ modo, rotearPorTrace: false }).filme.chapters.filter((c) => c.id.startsWith("hop-")).length;
    expect([n("direct"), n("agent"), n("gateway"), n("agent-gateway")]).toEqual([1, 2, 2, 3]);
  });
});
