import type { MalEntendido } from "../providers/labels.js";

export const ROTULOS_AMOSTRAGEM = {
  amostragem: "Head decides early, tail decides late",
  app: "app · two services, one trace",
  head: "head sampler · in the SDK",
  balanceador: "load balancer · in front of the gateways",
  gatewayA: "tail sampler · gateway A",
  gatewayB: "tail sampler · gateway B",
  backend: "backend · what can be queried",
  descartes: "dropped · counted, and by whom",
} as const;

/**
 * Os dois serviços que produzem o trace, e o erro mora no segundo.
 *
 * Isto não é enfeite: o span que falha é o ÚLTIMO, e o head sampler decide no
 * primeiro. A ordem é a tese do lab inteira — a decisão acontece antes de o
 * fato existir, e nenhuma configuração de head sampling conserta isso.
 */
export const SERVICOS_DO_TRACE = ["checkout", "payments"] as const;

export const MAL_ENTENDIDOS_DA_AMOSTRAGEM: readonly MalEntendido[] = [
  {
    crenca: "Sampling at 10% keeps 10% of my errors — enough to see them.",
    spec:
      "Head sampling decides at the root span, before the request has done anything. The " +
      "decision cannot depend on an error that has not happened yet, so what you keep is a " +
      "slice of traffic and not a slice of each category: a failure in 1 in 500 requests, " +
      "sampled at 10%, is a failure you see 1 time in 5 000.",
    fonte: "https://opentelemetry.io/docs/concepts/sampling/",
    onde: "head",
  },
  {
    crenca: "The sampling decision is taken by each service, so I can set it per service.",
    spec:
      "The default sampler is parent-based: a service that receives a sampled parent keeps " +
      "its spans, and one that receives an unsampled parent drops them. The decision is " +
      "made once, at the root, and travels in the `sampled` flag of the W3C `traceparent` " +
      "header — which is why turning sampling up in a downstream service changes nothing.",
    fonte: "https://www.w3.org/TR/trace-context/",
    onde: "head",
  },
  {
    crenca: "Tail sampling is head sampling with better rules.",
    spec:
      "It is a different place and a different cost. Deciding on the finished trace means " +
      "holding every span of every trace in memory until the decision window closes — so " +
      "the Collector pays memory and latency for the traces it is going to throw away, and " +
      "the window is a bet on how long a trace takes.",
    fonte: "https://opentelemetry.io/docs/concepts/sampling/",
    onde: "gatewayA",
  },
  {
    crenca: "To scale tail sampling, add gateway replicas behind the load balancer.",
    spec:
      "The tail sampling processor can only decide correctly if **all** spans of a trace " +
      "reach the same Collector instance. A standard Kubernetes Service balances " +
      "connections and not requests, so spans of one trace land on different replicas — " +
      "each replica then decides on a fraction of the trace, and the output still looks " +
      "like sampling.",
    fonte: "https://opentelemetry.io/docs/collector/deploy/other/agent-to-gateway/",
    onde: "balanceador",
  },
  {
    crenca: "A trace that arrives incomplete shows up as incomplete.",
    spec:
      "Nothing downstream knows how many spans the trace had. The backend renders what it " +
      "received, and a trace missing the span that failed looks exactly like a trace that " +
      "succeeded — which is the one defect in this lab that no counter in production would " +
      "report to you.",
    fonte: "https://opentelemetry.io/docs/concepts/sampling/",
    onde: "backend",
  },
];
