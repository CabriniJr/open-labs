import type { MalEntendido } from "../providers/labels.js";

/**
 * Todo texto que o leitor vê neste lab, em inglês, num arquivo só — a mesma
 * fronteira entre as duas línguas que o lab dos provedores tem.
 */
export const ROTULOS_PILARES = {
  process: "The checkout service",
  requests: "Incoming requests",
  service: "The handler",
  trace: "Tracer · one row per request",
  metric: "Meter · counts per bucket",
  log: "Logger · what the code said",
} as const;

/**
 * O que as pessoas acreditam quando chegam aqui, e o que a spec responde.
 *
 * O primeiro é o mal-entendido que este lab existe para desfazer, e ele é caro:
 * quem acredita que a métrica é um trace resumido espera que **alguém, em algum
 * lugar, ainda tenha os itens**. Ninguém tem.
 */
export const MAL_ENTENDIDOS_DOS_PILARES: readonly MalEntendido[] = [
  {
    crenca: "A metric is a trace, summarised.",
    spec:
      "It never knew the individuals. A histogram bucket holds a count, and the values that " +
      "produced it were dropped at write time — not compressed. No backend can undo that, " +
      "because there is nothing to undo.",
    fonte: "https://opentelemetry.io/docs/specs/otel/metrics/data-model/#histogram",
    onde: "metric-store",
  },
  {
    crenca: "If it happened, the logs will have it.",
    spec:
      "Logs hold what the code chose to say. A request nobody logged leaves no line, and the " +
      "decision was taken when the code was written — not in configuration, and not by the " +
      "backend.",
    fonte: "https://opentelemetry.io/docs/specs/otel/logs/data-model/",
    onde: "log-store",
  },
  {
    crenca: "One more attribute is one more column.",
    spec:
      "It is one more series per distinct value, and series are what you pay for. Past the " +
      "cardinality limit the SDK folds the excess into a single overflow series: nothing is " +
      "lost and nothing is double-counted — and the breakdown you wanted is gone.",
    fonte: "https://opentelemetry.io/docs/specs/otel/metrics/sdk/#cardinality-limits",
    onde: "metric-store",
  },
  {
    crenca: "Three signals means three copies of the same thing.",
    spec:
      "They are three decisions about what to discard, taken on the same event. That is why " +
      "the answer to a question can exist in one of them and be unrecoverable in the others.",
    fonte: "https://opentelemetry.io/docs/concepts/signals/",
    onde: "service",
  },
];
