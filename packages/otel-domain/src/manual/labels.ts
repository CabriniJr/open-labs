import type { MalEntendido } from "../providers/labels.js";

export const MAL_ENTENDIDOS_MANUAIS: readonly MalEntendido[] = [
  {
    crenca: "A span is sent when it starts, and updated as it goes.",
    spec:
      "The span processor receives a span on end(). Until then it is an open record in process memory; a span " +
      "that never ends is never exported.",
    fonte: "https://opentelemetry.io/docs/specs/otel/trace/sdk/#span-processor",
    onde: "end",
  },
  {
    crenca: "You can add attributes to a span any time, even after it ended.",
    spec:
      "After end(), the span is no longer recording: calls that change it, setAttribute included, are ignored.",
    fonte: "https://opentelemetry.io/docs/specs/otel/trace/api/#end",
    onde: "after",
  },
  {
    crenca: "Put the order id in the span name so you can find the trace.",
    spec:
      "Span names should be low-cardinality: they name a class of operation. Per-request identifiers belong in " +
      "attributes, where they can be searched without making each request its own operation.",
    fonte: "https://opentelemetry.io/docs/specs/otel/trace/api/#span",
    onde: "start",
  },
];
