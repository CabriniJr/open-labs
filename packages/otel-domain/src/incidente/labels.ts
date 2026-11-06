import type { MalEntendido } from "../providers/labels.js";

export const MAL_ENTENDIDOS_DO_INCIDENTE: readonly MalEntendido[] = [
  {
    crenca: "Correlation is a luxury; you can always join by timestamp.",
    spec:
      "A timestamp joins a log line to every request active in that instant. At production traffic that is dozens " +
      "or hundreds of candidates, and the count grows with load, not with the problem.",
    fonte: "https://opentelemetry.io/docs/specs/otel/logs/#log-correlation",
    onde: "search",
  },
  {
    crenca: "Better log timestamps would solve it.",
    spec:
      "Finer time narrows the window but never to one request when requests overlap. Only an identifier carried by " +
      "both signals — the trace context — names the request.",
    fonte: "https://www.w3.org/TR/trace-context/",
    onde: "search",
  },
];
