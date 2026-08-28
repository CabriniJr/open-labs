export interface AnyValue {
  readonly stringValue?: string;
  readonly intValue?: string;
  readonly boolValue?: boolean;
}

export interface KeyValue {
  readonly key: string;
  readonly value: AnyValue;
}

/** SpanKind do OTLP: 1 INTERNAL, 2 SERVER, 3 CLIENT, 4 PRODUCER, 5 CONSUMER. */
export type SpanKind = 1 | 2 | 3 | 4 | 5;

export interface OtelSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTimeUnixNano: string;
  readonly endTimeUnixNano: string;
  readonly attributes: readonly KeyValue[];
}

export interface OtelResource {
  readonly attributes: readonly KeyValue[];
}

export interface ScopeSpans {
  readonly scope: { readonly name: string };
  readonly spans: readonly OtelSpan[];
}

export interface ResourceSpans {
  readonly resource: OtelResource;
  readonly scopeSpans: readonly ScopeSpans[];
}

export interface ExportTraceServiceRequest {
  readonly resourceSpans: readonly ResourceSpans[];
}

/** Codifica um atributo no formato AnyValue do OTLP/JSON. */
export function attribute(key: string, value: string | number | boolean): KeyValue {
  if (typeof value === "string") return { key, value: { stringValue: value } };
  if (typeof value === "boolean") return { key, value: { boolValue: value } };
  return { key, value: { intValue: String(Math.trunc(value)) } };
}

export function toOtlpJson(
  resource: OtelResource,
  spans: readonly OtelSpan[],
  scopeName = "otel-visual-handbook",
): ExportTraceServiceRequest {
  return {
    resourceSpans: [{ resource, scopeSpans: [{ scope: { name: scopeName }, spans }] }],
  };
}
