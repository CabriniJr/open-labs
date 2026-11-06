import type { MalEntendido } from "../providers/labels.js";

export const MAL_ENTENDIDOS_DO_LOG: readonly MalEntendido[] = [
  {
    crenca: "Just put the trace_id in the log message.",
    spec:
      "A LogRecord has TraceId and SpanId as fields, and backends join logs to traces on those fields. " +
      "An id inside the body is text: searchable by hand, invisible to the link from a log to its trace.",
    fonte: "https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-traceid",
    onde: "join",
  },
  {
    crenca: "Once a request has a trace, every log it causes has the trace.",
    spec:
      "The log bridge reads the context that is active on the calling thread at the moment of the call. " +
      "A log after the span ended, or on a thread nobody handed the context to, has none.",
    fonte: "https://opentelemetry.io/docs/specs/otel/context/",
    onde: "thread",
  },
  {
    crenca: "The log is attached to the request's root span.",
    spec:
      "It is attached to whichever span is active when the logger is called — the innermost open one. " +
      "That is what makes 'show logs for this span' precise.",
    fonte: "https://opentelemetry.io/docs/specs/otel/logs/api/",
    onde: "innermost",
  },
];
