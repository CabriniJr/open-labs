import type { MalEntendido } from "../providers/labels.js";

export const MAL_ENTENDIDOS_DA_FILA: readonly MalEntendido[] = [
  {
    crenca: "The HTTP instrumentation propagates context, so the queue does too.",
    spec:
      "Context crosses a boundary only if something injects it into the carrier. For a message, the carrier " +
      "is the message's own headers, and the producer side has to write them.",
    fonte: "https://opentelemetry.io/docs/specs/otel/context/api-propagators/",
    onde: "publish",
  },
  {
    crenca: "The consumer's span should always be a child of the producer's.",
    spec:
      "When one consumer span handles messages from several traces, it cannot have several parents. Messaging " +
      "conventions use links from the process span to each message's context.",
    fonte: "https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/",
    onde: "extract",
  },
  {
    crenca: "If propagation breaks, something errors.",
    spec:
      "The consumer finds no traceparent and starts a root span. You get complete-looking traces on both " +
      "sides of the queue, and nothing joins them.",
    fonte: "https://www.w3.org/TR/trace-context/",
    onde: "backend",
  },
];
