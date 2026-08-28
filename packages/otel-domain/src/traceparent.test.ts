import { describe, expect, it } from "vitest";
import { formatTraceparent, parseTraceparent } from "./traceparent.js";

const VALID = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

describe("parseTraceparent", () => {
  it("extrai traceId, spanId e o bit de amostragem", () => {
    expect(parseTraceparent(VALID)).toEqual({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      sampled: true,
    });
  });

  it("lê sampled=false quando o bit está desligado", () => {
    const header = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00";
    expect(parseTraceparent(header)?.sampled).toBe(false);
  });

  it("rejeita header com número errado de partes", () => {
    expect(parseTraceparent("00-abc-def")).toBeNull();
  });

  it("rejeita traceId com tamanho errado", () => {
    expect(parseTraceparent("00-4bf92f-00f067aa0ba902b7-01")).toBeNull();
  });

  it("rejeita traceId só de zeros", () => {
    const header = "00-00000000000000000000000000000000-00f067aa0ba902b7-01";
    expect(parseTraceparent(header)).toBeNull();
  });

  it("rejeita spanId só de zeros", () => {
    const header = "00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01";
    expect(parseTraceparent(header)).toBeNull();
  });

  it("rejeita caracteres fora de hexadecimal", () => {
    const header = "00-4bf92f3577b34da6a3ce929d0e0e473g-00f067aa0ba902b7-01";
    expect(parseTraceparent(header)).toBeNull();
  });

  it("rejeita versão desconhecida", () => {
    const header = "99-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    expect(parseTraceparent(header)).toBeNull();
  });
});

describe("formatTraceparent", () => {
  it("reconstrói o header a partir do contexto", () => {
    expect(
      formatTraceparent({
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        spanId: "00f067aa0ba902b7",
        sampled: true,
      }),
    ).toBe(VALID);
  });

  it("faz round-trip com parse", () => {
    const parsed = parseTraceparent(VALID);
    expect(parsed).not.toBeNull();
    expect(formatTraceparent(parsed!)).toBe(VALID);
  });
});
