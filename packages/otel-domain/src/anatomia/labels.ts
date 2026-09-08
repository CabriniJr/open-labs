import type { MalEntendido } from "../providers/labels.js";

export const ROTULOS_ANATOMIA = {
  sistema: "One request, four processes",
  entrada: "Incoming request",
  gateway: "gateway",
  checkout: "checkout",
  payments: "payments",
  ledger: "ledger",
  backend: "Backend · what actually arrived",
} as const;

/**
 * Os quatro processos, na ordem em que a requisição os atravessa. Uma lista só,
 * porque duas divergem — é a régua que este repo já pagou duas vezes.
 */
export const SERVICOS = ["gateway", "checkout", "payments", "ledger"] as const;

export type Servico = (typeof SERVICOS)[number];

export const MAL_ENTENDIDOS_DA_ANATOMIA: readonly MalEntendido[] = [
  {
    crenca: "The backend reassembles whatever went missing.",
    spec:
      "Nobody allocates the identifiers, so nobody holds the list of spans a trace should " +
      "have had. The backend builds a tree out of what arrived, and a tree built from less " +
      "still looks like a tree.",
    fonte: "https://opentelemetry.io/docs/specs/otel/trace/api/",
    onde: "backend",
  },
  {
    crenca: "A trace is an object that lives somewhere while the request runs.",
    spec:
      "Each span carries one edge — its parent — and each process exports on its own. The " +
      "tree is the transitive closure of those edges, computed after the fact by whoever " +
      "collected them.",
    fonte: "https://www.w3.org/TR/trace-context/",
    onde: "backend",
  },
  {
    crenca: "If the header is dropped, the trace breaks and something errors.",
    spec:
      "Nothing errors. The next service starts a new trace, and you get two complete, " +
      "plausible traces for one request — neither of which contains the other.",
    fonte: "https://www.w3.org/TR/trace-context/#traceparent-header",
    onde: "payments",
  },
  {
    crenca: "Each service decides for itself whether to sample.",
    spec:
      "The decision is taken once, at the root, and travels in the sampled flag of the same " +
      "header as the identifiers. A service that decides on its own does not over-collect: " +
      "it manufactures fragments — half a tree, which is worse than none because it looks " +
      "like evidence.",
    fonte: "https://opentelemetry.io/docs/specs/otel/trace/sdk/#parentbased",
    onde: "checkout",
  },
];
