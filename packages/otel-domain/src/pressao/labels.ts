import type { MalEntendido } from "../providers/labels.js";

export const MAL_ENTENDIDOS_DA_PRESSAO: readonly MalEntendido[] = [
  {
    crenca: "A bigger sending_queue means nothing is lost.",
    spec:
      "The queue lives in process memory. Without a memory_limiter, a queue bigger than the memory you have " +
      "turns an outage into an out-of-memory crash, and the in-memory queue goes with the process.",
    fonte: "https://github.com/open-telemetry/opentelemetry-collector/tree/main/processor/memorylimiterprocessor",
    onde: "limit",
  },
  {
    crenca: "Retry means the Collector keeps trying until the backend is back.",
    spec:
      "retry_on_failure backs off exponentially and gives up after max_elapsed_time. A batch older than that " +
      "is dropped even if the backend returns a second later.",
    fonte: "https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/exporterhelper/README.md",
    onde: "down",
  },
  {
    crenca: "If the Collector drops data, the application will see an error.",
    spec:
      "Only a refusal at the receiver (the memory_limiter saying no) goes back to the sender. Queue-full and " +
      "retry drops happen inside the exporter, and only the Collector's own metrics count them.",
    fonte: "https://opentelemetry.io/docs/collector/internal-telemetry/",
    onde: "where",
  },
];
