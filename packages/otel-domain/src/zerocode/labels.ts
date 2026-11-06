import type { MalEntendido } from "../providers/labels.js";

export const MAL_ENTENDIDOS_ZERO_CODE: readonly MalEntendido[] = [
  {
    crenca: "Auto-instrumentation traces the whole application.",
    spec:
      "It instruments the libraries it knows — frameworks, drivers, clients — by hooking them at load time. " +
      "Code you wrote between two library calls produces no span.",
    fonte: "https://opentelemetry.io/docs/concepts/instrumentation/zero-code/",
    onde: "agent",
  },
  {
    crenca: "If the trace has no span for it, it did not take time.",
    spec:
      "Time inside a span that no child covers is that span's own time. In an auto-instrumented service, it is " +
      "usually your business logic — present in the duration, absent from the breakdown.",
    fonte: "https://opentelemetry.io/docs/concepts/signals/traces/#spans",
    onde: "trace",
  },
  {
    crenca: "Manual and automatic instrumentation are alternatives.",
    spec:
      "They compose: manual spans created inside an auto-instrumented request become children of the active " +
      "span, so you add them only where the edges are not enough.",
    fonte: "https://opentelemetry.io/docs/concepts/instrumentation/code-based/",
    onde: "trace",
  },
];
