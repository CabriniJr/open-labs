export interface TraceContext {
  /** 32 dígitos hexadecimais, nunca só zeros. */
  readonly traceId: string;
  /** 16 dígitos hexadecimais, nunca só zeros. */
  readonly spanId: string;
  readonly sampled: boolean;
}

const HEX = /^[0-9a-f]+$/;

function isHexOfLength(value: string, length: number): boolean {
  return value.length === length && HEX.test(value) && !/^0+$/.test(value);
}

/**
 * Lê um header `traceparent` do W3C Trace Context.
 * Devolve `null` para qualquer header inválido — é exatamente esse `null` que
 * o lab "Anatomy of a Trace" mostra virando um span órfão.
 * Spec: https://www.w3.org/TR/trace-context/#traceparent-header
 */
export function parseTraceparent(header: string): TraceContext | null {
  const parts = header.trim().split("-");
  if (parts.length !== 4) return null;

  const [version, traceId, spanId, flags] = parts as [string, string, string, string];
  if (version !== "00") return null;
  if (!isHexOfLength(traceId, 32)) return null;
  if (!isHexOfLength(spanId, 16)) return null;
  if (flags.length !== 2 || !HEX.test(flags)) return null;

  return { traceId, spanId, sampled: (Number.parseInt(flags, 16) & 0x01) === 0x01 };
}

export function formatTraceparent(context: TraceContext): string {
  const flags = context.sampled ? "01" : "00";
  return `00-${context.traceId}-${context.spanId}-${flags}`;
}
