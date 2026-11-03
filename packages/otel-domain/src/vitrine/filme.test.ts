import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { envelopeDaVitrine, filmeDaVitrineOtel } from "./filme.js";

describe("the Collector showcase", () => {
  it("sends one real OTLP request, grouped by resource, and counts its real size", () => {
    const e = envelopeDaVitrine();
    expect(e.requisicao.resourceSpans).toHaveLength(2);
    expect(e.requisicao.resourceSpans.map((r) => r.scopeSpans[0]!.spans.length)).toEqual([4, 4]);
    expect(e.bytes).toBe(new TextEncoder().encode(JSON.stringify(e.requisicao)).length);
  });

  it("shows one level at a time on the way down", () => {
    const f = filmeDaVitrineOtel();
    const op = (cap: string, id: string) => frameAt(f, f.chapters.find((c) => c.id === cap)!.end).entities.find((x) => x.spec.id === id)!.state.opacity;
    expect(op("services", "collector")).toBeGreaterThan(0.9);
    expect(op("pipeline", "collector")).toBeLessThan(0.05);
    expect(op("pipeline", "bat")).toBeGreaterThan(0.9);
    expect(op("batch", "bat")).toBeLessThan(0.05);
    expect(op("batch", "cel:0")).toBeGreaterThan(0.9);
    expect(op("envelope", "cel:0")).toBeLessThan(0.05);
    expect(op("envelope", "sp:0:0")).toBeGreaterThan(0.9);
    expect(op("export", "collector")).toBeGreaterThan(0.9);
  });
});
