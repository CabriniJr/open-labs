import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { parseTraceparent } from "../traceparent.js";
import { filmeDaVitrineDaAnatomia, umaRequisicao } from "./vitrine.js";

describe("the anatomy showcase — the model", () => {
  it("each span names only its caller, and the innermost one reaches the backend first", () => {
    const r = umaRequisicao();
    const [g, c, p, l] = r.spans;
    expect(r.spans.map((s) => s.servico)).toEqual(["gateway", "checkout", "payments", "ledger"]);
    expect(g!.parentId).toBeUndefined();
    expect(c!.parentId).toBe(g!.spanId);
    expect(p!.parentId).toBe(c!.spanId);
    expect(l!.parentId).toBe(p!.spanId);
    expect(new Set(r.spans.map((s) => s.traceId)).size).toBe(1);
    expect(r.chegada.map((s) => s.servico)).toEqual(["ledger", "payments", "checkout", "gateway"]);
    expect(r.waterfall.map((x) => [x.span.servico, x.profundidade])).toEqual([["gateway", 0], ["checkout", 1], ["payments", 2], ["ledger", 3]]);
  });

  it("the header each call carries is the caller's own span", () => {
    const r = umaRequisicao();
    expect(r.chamadas[0]!.traceparent).toBeUndefined();
    r.chamadas.slice(1).forEach((ch, i) => expect(parseTraceparent(ch.traceparent!)!.spanId).toBe(r.spans[i]!.spanId));
  });

  it("a dropped header makes two whole trees, and neither names the other", () => {
    const r = umaRequisicao({ derrubarCabecalho: true, paymentsSemInstrumentacao: false });
    expect(r.arvores).toHaveLength(2);
    const p = r.spans.find((s) => s.servico === "payments")!;
    expect(p.parentId).toBeUndefined();
    expect(p.traceId).not.toBe(r.spans[0]!.traceId);
    expect(r.waterfall.filter((x) => x.traco === 1).map((x) => [x.span.servico, x.profundidade])).toEqual([["payments", 0], ["ledger", 1]]);
  });

  it("an uninstrumented hop leaves no hole: ledger hangs from checkout", () => {
    const r = umaRequisicao({ derrubarCabecalho: false, paymentsSemInstrumentacao: true });
    expect(r.semSpan).toEqual(["payments"]);
    expect(r.spans).toHaveLength(3);
    const c = r.spans.find((s) => s.servico === "checkout")!;
    expect(r.spans.find((s) => s.servico === "ledger")!.parentId).toBe(c.spanId);
    expect(r.arvores).toHaveLength(1);
    expect(r.arvores[0]!.raizes).toHaveLength(1);
  });
});

describe("the anatomy showcase — the film", () => {
  const fim = (f: ReturnType<typeof filmeDaVitrineDaAnatomia>, cap: string) => frameAt(f, f.chapters.find((c) => c.id === cap)!.end);
  const estado = (q: ReturnType<typeof fim>, id: string) => q.entities.find((e) => e.spec.id === id)!;

  it("height in the 3D view is depth in the tree", () => {
    const f = filmeDaVitrineDaAnatomia();
    const alturas = ["gateway", "checkout", "payments", "ledger"].map((s) => f.entities.find((e) => e.id === `bar:${s}`)!.elevation);
    expect(alturas).toEqual([0, 14, 28, 42]);
  });

  it("the waterfall only exists after the backend builds it", () => {
    const f = filmeDaVitrineDaAnatomia();
    expect(estado(fim(f, "export"), "bar:gateway").state.opacity).toBeLessThan(0.05);
    expect(estado(fim(f, "tree"), "bar:gateway").state.opacity).toBeGreaterThan(0.9);
    expect(estado(fim(f, "tree"), "bar:ledger").state.progress).toBeGreaterThan(0.99);
  });

  it("with the proxy, a second trace appears in another tone and says so", () => {
    const f = filmeDaVitrineDaAnatomia({ derrubarCabecalho: true, paymentsSemInstrumentacao: false });
    const q = fim(f, "tree");
    expect(estado(q, "bar:payments").state.tone).not.toBe(estado(q, "bar:gateway").state.tone);
    expect(estado(q, "nota:trace:1").state.opacity).toBeGreaterThan(0.9);
    expect(estado(fim(f, "request"), "proxy").state.opacity).toBeGreaterThan(0.9);
  });

  it("the uninstrumented hop has no bar, and the backend never hears from it", () => {
    const f = filmeDaVitrineDaAnatomia({ derrubarCabecalho: false, paymentsSemInstrumentacao: true });
    expect(f.entities.some((e) => e.id === "bar:payments")).toBe(false);
    expect(f.entities.some((e) => e.id === "exp:payments")).toBe(false);
    expect(f.packets.filter((p) => p.to === "backend")).toHaveLength(3);
  });
});
