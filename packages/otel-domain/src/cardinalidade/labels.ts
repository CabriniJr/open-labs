import type { MalEntendido } from "../providers/labels.js";
import type { Atributo } from "./modelo.js";

/**
 * Os atributos do lab, e cada contagem de valores é uma escolha a defender.
 *
 * Os números são de um serviço de e-commerce de porte médio — não são o máximo
 * possível nem o mínimo defensável, e estão aqui porque o leitor precisa de um
 * ponto de partida realista para mexer. O lab deixa todos editáveis justamente
 * porque o número que importa é o **do serviço de quem está lendo**.
 *
 * A ordem é deliberada: os três primeiros são os da convenção semântica da
 * métrica de duração de requisição HTTP, e os de baixo são os que alguém
 * acrescenta num plantão. Ler de cima para baixo é ver a conta sair de controle.
 */
export const ATRIBUTOS_DA_CARDINALIDADE: readonly Atributo[] = [
  {
    id: "route",
    nome: "http.route",
    valores: 12,
    porque: "Which endpoint. Without it the metric is one number for the whole service.",
    fonte: "https://opentelemetry.io/docs/specs/semconv/http/http-metrics/#metric-httpserverrequestduration",
    daConvencao: true,
  },
  {
    id: "status",
    nome: "http.response.status_code",
    valores: 6,
    porque: "Lets you compute an error rate from this metric instead of going to the logs.",
    fonte: "https://opentelemetry.io/docs/specs/semconv/http/http-metrics/#metric-httpserverrequestduration",
    daConvencao: true,
  },
  {
    id: "method",
    nome: "http.request.method",
    valores: 4,
    porque: "GET and POST on the same route are different workloads.",
    fonte: "https://opentelemetry.io/docs/specs/semconv/http/http-metrics/#metric-httpserverrequestduration",
    daConvencao: true,
  },
  {
    id: "pod",
    nome: "k8s.pod.name",
    valores: 40,
    porque:
      "To find the one replica that is slow. It is also the attribute that changes on every " +
      "deploy, so the old values keep their series until retention rolls them off.",
    fonte: "https://opentelemetry.io/docs/specs/semconv/resource/k8s/#pod",
  },
  {
    id: "customer",
    nome: "enduser.id",
    valores: 8000,
    porque:
      "To answer which customer is affected — the question an account manager actually asks.",
    fonte: "https://opentelemetry.io/docs/specs/semconv/registry/attributes/enduser/",
  },
  {
    id: "ua",
    nome: "user_agent.original",
    valores: 400,
    porque: "To separate bots from people. The raw header, which is what gets logged by default.",
    fonte: "https://opentelemetry.io/docs/specs/semconv/registry/attributes/user-agent/",
  },
];

export const ROTULOS_DA_CARDINALIDADE = {
  pergunta: "I want latency broken down by customer. What does that cost?",
} as const;

export const MAL_ENTENDIDOS_DA_CARDINALIDADE: readonly MalEntendido[] = [
  {
    crenca: "One more attribute is one more column.",
    spec:
      "A metric stream is identified by its attribute set, so the number of streams is the " +
      "PRODUCT of the distinct values, not the sum. Adding an attribute with 8 000 values to " +
      "a metric that had 288 streams does not give you 8 288 — it gives you 2 304 000.",
    fonte: "https://opentelemetry.io/docs/specs/otel/metrics/data-model/#timeseries-model",
    onde: "produto",
  },
  {
    crenca: "A histogram costs about the same as a counter.",
    spec:
      "A counter publishes one point per series. A histogram publishes one per bucket, plus " +
      "the sum and the count — so with the default bucket set it is over ten times the " +
      "volume before a single attribute is added.",
    fonte: "https://opentelemetry.io/docs/specs/otel/metrics/data-model/#histogram",
    onde: "pontos",
  },
  {
    crenca: "The cardinality limit protects me, so high-cardinality attributes are safe.",
    spec:
      "It caps the number of streams, and that is all it does. The excess folds into a single " +
      "overflow stream: nothing is lost and nothing is double-counted, and the breakdown you " +
      "added the attribute FOR is gone. You pay the instrumentation cost and get no answer.",
    fonte: "https://opentelemetry.io/docs/specs/otel/metrics/sdk/#cardinality-limits",
    onde: "limite",
  },
  {
    crenca: "I will add it temporarily, just to debug this incident.",
    spec:
      "The product is over values actually SEEN, so a series exists from the first measurement " +
      "that carries it until retention rolls it off. A pod name that lived for one deploy keeps " +
      "its streams for the whole window — which is why cardinality incidents outlive the change " +
      "that caused them.",
    fonte: "https://opentelemetry.io/docs/specs/otel/metrics/data-model/#temporality",
    onde: "produto",
  },
];
