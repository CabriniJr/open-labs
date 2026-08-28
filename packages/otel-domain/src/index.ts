export { formatTraceparent, parseTraceparent } from "./traceparent.js";
export type { TraceContext } from "./traceparent.js";
export { attribute, toOtlpJson } from "./otlp.js";
export type {
  AnyValue,
  ExportTraceServiceRequest,
  KeyValue,
  OtelResource,
  OtelSpan,
  ResourceSpans,
  ScopeSpans,
  SpanKind,
} from "./otlp.js";
