import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { parseTraceparent } from "../traceparent.js";
import { formatBaggage, parseBaggage } from "./baggage.js";
import { filmeDoContexto } from "./filme.js";
import { OPCOES_PADRAO, propagar } from "./propagacao.js";

describe("baggage", () => {
  it("round-trips encoded values and ignores properties and broken members", () => {
    expect(parseBaggage(formatBaggage({ "user.tier": "gold plus", a: "1" }))).toEqual({ "user.tier": "gold plus", a: "1" });
    expect(parseBaggage("k=v;prop=1, =x, bad, z=%E0%A4%A")).toEqual({ k: "v" });
    expect(parseBaggage(undefined)).toEqual({});
  });
});

describe("propagation", () => {
  it("keeps one trace when every hop forwards the context", () => {
    const p = propagar(OPCOES_PADRAO);
    expect(p.traces).toHaveLength(1);
    expect(p.spans.map((s) => s.servico)).toEqual(["browser", "gateway", "checkout", "inventory", "payments"]);
    // Cada filho aponta para o span de quem chamou.
    const by = Object.fromEntries(p.spans.map((s) => [s.servico, s]));
    expect(by.gateway!.parentId).toBe(by.browser!.spanId);
    expect(by.inventory!.parentId).toBe(by.checkout!.spanId);
    // O proxy não cria span, então pagamentos é filho do checkout, não do proxy.
    expect(by.payments!.parentId).toBe(by.checkout!.spanId);
    expect(by.payments!.baggage).toEqual({ "user.tier": "gold" });
  });

  it("puts a valid traceparent on every hop, and the parent-id changes on each", () => {
    const p = propagar(OPCOES_PADRAO);
    const ctxs = p.chamadas.map((c) => parseTraceparent(c.headers.traceparent ?? ""));
    expect(ctxs.every((c) => c !== null)).toBe(true);
    expect(new Set(ctxs.map((c) => c!.traceId)).size).toBe(1);
  });

  it("starts an orphan trace and loses the baggage when the proxy drops headers", () => {
    const p = propagar({ ...OPCOES_PADRAO, proxyRepassa: false });
    expect(p.traces).toHaveLength(2);
    const payments = p.spans.find((s) => s.servico === "payments")!;
    expect(payments.parentId).toBeNull();
    expect(payments.traceId).not.toBe(p.raiz.traceId);
    expect(payments.baggage).toEqual({});
    expect(p.chamadas[4]!.extraido).toBeNull();
  });

  it("propagates the sampling decision instead of re-deciding it", () => {
    const p = propagar({ ...OPCOES_PADRAO, amostrado: false });
    expect(p.spans.every((s) => !s.amostrado)).toBe(true);
    expect(p.chamadas[0]!.headers.traceparent?.endsWith("-00")).toBe(true);
  });

  it("is deterministic: the same options give the same ids", () => {
    expect(propagar(OPCOES_PADRAO)).toEqual(propagar(OPCOES_PADRAO));
  });
});

describe("the film is derived from the model", () => {
  it("paints the payments span in another trace's tone when the proxy drops context", () => {
    const tone = (proxyRepassa: boolean) => {
      const { filme } = filmeDoContexto({ ...OPCOES_PADRAO, proxyRepassa });
      const end = frameAt(filme, filme.duration);
      const tom = (id: string) => end.entities.find((e) => e.spec.id === id)!.state.tone;
      return [tom("span:checkout"), tom("span:payments")];
    };
    const [a, b] = tone(true);
    expect(a).toBe(b);
    const [c, d] = tone(false);
    expect(c).not.toBe(d);
  });

  it("exports nothing when the root was not sampled", () => {
    const { filme } = filmeDoContexto({ ...OPCOES_PADRAO, amostrado: false });
    expect(filme.entities.some((e) => e.id.startsWith("export:"))).toBe(false);
    const ultimo = frameAt(filme, filme.duration).detail;
    expect(ultimo?.exportados).toBe(true);
  });

  it("walks the traceparent fields in order during the inject chapter", () => {
    const { filme } = filmeDoContexto(OPCOES_PADRAO);
    const inject = filme.chapters.find((c) => c.id === "inject")!;
    expect(inject.steps.map((s) => s.detail?.foco).filter(Boolean)).toEqual(["version", "trace-id", "parent-id", "flags"]);
  });
});

describe("the two layouts tell the same story", () => {
  it("keep every chapter and every beat on the same clock", () => {
    for (const proxyRepassa of [true, false]) {
      const a = filmeDoContexto({ ...OPCOES_PADRAO, proxyRepassa }, "sequence").filme;
      const b = filmeDoContexto({ ...OPCOES_PADRAO, proxyRepassa }, "topology").filme;
      expect(b.chapters.map((c) => [c.id, c.start, c.end, c.steps.map((s) => s.t)])).toEqual(
        a.chapters.map((c) => [c.id, c.start, c.end, c.steps.map((s) => s.t)]),
      );
      expect(b.entities.map((e) => e.id).sort()).toEqual(a.entities.map((e) => e.id).sort());
    }
  });
});
