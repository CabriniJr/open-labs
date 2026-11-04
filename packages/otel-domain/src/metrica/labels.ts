import type { MalEntendido } from "../providers/labels.js";

export const MAL_ENTENDIDOS_DA_METRICA: readonly MalEntendido[] = [
  {
    crenca: "A counter is a number that goes up, and the backend stores that number.",
    spec:
      "What leaves the SDK is a data point with a temporality and a start time. A cumulative point means " +
      "'this many since start time'; a delta point means 'this many since the last collect'. The same " +
      "requests produce different numbers on the wire.",
    fonte: "https://opentelemetry.io/docs/specs/otel/metrics/data-model/#temporality",
    onde: "export",
  },
  {
    crenca: "A cumulative series only ever goes up.",
    spec:
      "It resets whenever the process restarts, and the reset is announced by a new start time. A backend " +
      "that subtracts across a changed start time computes a negative rate.",
    fonte: "https://opentelemetry.io/docs/specs/otel/metrics/data-model/#resets-and-gaps",
    onde: "backend",
  },
  {
    crenca: "Delta is safer, so nothing is lost when a process dies.",
    spec:
      "Either way, the aggregator lives in process memory. Whatever was measured after the last collect " +
      "and before the crash was never exported, in cumulative or in delta.",
    fonte: "https://opentelemetry.io/docs/specs/otel/metrics/sdk/#metricreader",
    onde: "process",
  },
  {
    crenca: "A histogram stores every latency it saw.",
    spec:
      "It stores a count per bucket, a sum and a count — the latencies themselves are gone. Bucket upper " +
      "bounds are inclusive, so 50 ms lands in the bucket that ends at 50.",
    fonte: "https://opentelemetry.io/docs/specs/otel/metrics/sdk/#explicit-bucket-histogram-aggregation",
    onde: "histogram",
  },
];
