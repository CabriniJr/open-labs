import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { hashDoTrace } from "../amostragem/world.js";
import { filmeDaVitrineDosProviders, rodarProviders } from "./vitrine.js";

describe("the providers showcase — the model", () => {
  it("with the SDK: spans pushed, one metric point pulled, logs pushed", () => {
    const p = rodarProviders({ sdk: true, taxa: 1 });
    expect(p.exportacoes).toEqual([
      { sinal: "traces", itens: 4, modo: "push" },
      { sinal: "metrics", itens: 1, modo: "pull" },
      { sinal: "logs", itens: 4, modo: "push" },
    ]);
  });

  it("the sampler only touches traces", () => {
    const p = rodarProviders({ sdk: true, taxa: 0.5 });
    const esperadas = [1, 2, 3, 4].filter((r) => hashDoTrace(r) % 100 < 50);
    expect(p.amostradas).toEqual(esperadas);
    expect(p.exportacoes.find((e) => e.sinal === "logs")!.itens).toBe(4);
    expect(p.contagem).toBe(4);
  });

  it("without the SDK the API is a no-op: nothing leaves", () => {
    expect(rodarProviders({ sdk: false, taxa: 1 }).exportacoes).toEqual([]);
  });
});

describe("the providers showcase — the film", () => {
  it("in 3D each provider is its own floor of the process", () => {
    const f = filmeDaVitrineDosProviders();
    expect(["r:logs", "r:metrics", "r:traces"].map((id) => f.entities.find((e) => e.id === id)!.elevation)).toEqual([0, 28, 56]);
  });

  it("the aggregator ends counting every add, and the reader pulls once", () => {
    const f = filmeDaVitrineDosProviders();
    const q = frameAt(f, f.chapters.find((c) => c.id === "metrics")!.end);
    expect(q.entities.find((e) => e.spec.id === "agg")!.state.sublabel).toBe("count 4");
    expect(f.packets.filter((p) => p.tag === "PULLED")).toHaveLength(1);
  });

  it("without the SDK there are no pipeline chapters and no packets", () => {
    const f = filmeDaVitrineDosProviders({ sdk: false, taxa: 1 });
    expect(f.chapters.map((c) => c.id)).toEqual(["api", "summary"]);
    expect(f.packets).toHaveLength(0);
  });
});
