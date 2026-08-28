import { describe, expect, it } from "vitest";
import { attribute, toOtlpJson } from "./otlp.js";
import type { OtelSpan } from "./otlp.js";

const span: OtelSpan = {
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
  name: "GET /checkout",
  kind: 2,
  startTimeUnixNano: "1700000000000000000",
  endTimeUnixNano: "1700000000120000000",
  attributes: [attribute("http.response.status_code", 200)],
};

describe("attribute", () => {
  it("codifica string como stringValue", () => {
    expect(attribute("http.request.method", "GET")).toEqual({
      key: "http.request.method",
      value: { stringValue: "GET" },
    });
  });

  it("codifica inteiro como intValue em string", () => {
    expect(attribute("http.response.status_code", 200)).toEqual({
      key: "http.response.status_code",
      value: { intValue: "200" },
    });
  });

  it("codifica booleano como boolValue", () => {
    expect(attribute("error", true)).toEqual({
      key: "error",
      value: { boolValue: true },
    });
  });
});

describe("toOtlpJson", () => {
  it("envolve os spans em resourceSpans/scopeSpans", () => {
    const payload = toOtlpJson(
      { attributes: [attribute("service.name", "checkout")] },
      [span],
    );

    expect(payload.resourceSpans).toHaveLength(1);
    const resourceSpan = payload.resourceSpans[0]!;
    expect(resourceSpan.resource.attributes[0]!.key).toBe("service.name");
    expect(resourceSpan.scopeSpans[0]!.spans).toEqual([span]);
  });

  it("mantém o parentSpanId ausente quando o span é raiz", () => {
    const payload = toOtlpJson({ attributes: [] }, [span]);
    expect(payload.resourceSpans[0]!.scopeSpans[0]!.spans[0]).not.toHaveProperty(
      "parentSpanId",
    );
  });

  it("preserva o parentSpanId de um span filho", () => {
    const child: OtelSpan = { ...span, spanId: "aaf067aa0ba902b7", parentSpanId: span.spanId };
    const payload = toOtlpJson({ attributes: [] }, [child]);
    expect(payload.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.parentSpanId).toBe(
      "00f067aa0ba902b7",
    );
  });
});
