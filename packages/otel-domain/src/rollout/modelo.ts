/**
 * O rollout: em que ordem levar OpenTelemetry para uma empresa sem parar nada.
 *
 * Cada etapa é um lab do handbook. Ela destrava perguntas que dá para responder
 * e depende de etapas anteriores. O modelo avalia uma ORDEM: para cada etapa,
 * quais pré-requisitos já estavam lá, e o que dá errado quando não estavam —
 * escrito, com o lab que explica. Custo e risco são qualitativos de propósito:
 * nenhum número inventado sobre o seu time.
 */

export type IdDaEtapa = "collector" | "auto" | "contexto" | "logs" | "manual" | "amostragem";

export interface Etapa {
  readonly id: IdDaEtapa;
  readonly titulo: string;
  /** O que se faz, numa frase. */
  readonly acao: string;
  /** O lab que explica a etapa. */
  readonly lab: string;
  readonly labTitulo: string;
  readonly custo: "low" | "medium" | "high";
  /** Perguntas que ficam respondíveis depois desta etapa. */
  readonly destrava: readonly string[];
  /** Etapas que precisam vir antes, e o que acontece sem cada uma. */
  readonly depende: readonly { readonly de: IdDaEtapa; readonly sem: string }[];
}

export const ETAPAS: readonly Etapa[] = [
  {
    id: "collector",
    titulo: "Put a Collector in the path",
    acao: "Deploy agents or gateways and point today's exporters at them, before touching application code.",
    lab: "labs/agent-or-gateway",
    labTitulo: "Agent or gateway",
    custo: "low",
    destrava: ["Can we change backend without redeploying services?"],
    depende: [],
  },
  {
    id: "auto",
    titulo: "Turn on zero-code instrumentation",
    acao: "Add the agent to each service: framework, database and HTTP client spans, with semantic conventions.",
    lab: "labs/zero-code-instrumentation",
    labTitulo: "Zero-code instrumentation",
    custo: "low",
    destrava: ["Which service is slow?", "Which dependency failed?"],
    depende: [{ de: "collector", sem: "every service exports straight to a vendor endpoint; changing it later means touching every deployment" }],
  },
  {
    id: "contexto",
    titulo: "Make context cross every hop",
    acao: "Check propagation through proxies, gateways and queues so one request is one trace.",
    lab: "labs/hard-context-and-baggage",
    labTitulo: "Hard context and baggage",
    custo: "medium",
    destrava: ["Where did this request spend its time, end to end?"],
    depende: [{ de: "auto", sem: "there are no spans yet to carry the context between" }],
  },
  {
    id: "logs",
    titulo: "Put trace_id on the logs",
    acao: "Install the log bridge so existing log lines carry the active span as fields.",
    lab: "labs/a-log-that-knows-its-trace",
    labTitulo: "A log that knows its trace",
    custo: "low",
    destrava: ["Which request does this error line belong to?"],
    depende: [{ de: "contexto", sem: "the trace_id on a log line points at a trace that is cut in half at the first proxy" }],
  },
  {
    id: "manual",
    titulo: "Add manual spans where the time is",
    acao: "Wrap the business steps the agent cannot see, in the services where the dark time is.",
    lab: "labs/manual-spans",
    labTitulo: "Manual spans",
    custo: "medium",
    destrava: ["What did our own code do inside that request?"],
    depende: [{ de: "auto", sem: "manual spans have no request span to hang from; teams hand-write what the agent gives for free" }],
  },
  {
    id: "amostragem",
    titulo: "Sample, and keep the errors",
    acao: "Decide what to keep — tail sampling in gateways routed by trace id — once volume is real.",
    lab: "labs/head-vs-tail-sampling",
    labTitulo: "Head vs tail sampling",
    custo: "high",
    destrava: ["Can we afford to keep this, and still keep every error?"],
    depende: [
      { de: "collector", sem: "sampling has to be done in every SDK, at the head, before anyone knows which traces fail" },
      { de: "contexto", sem: "a tail sampler cannot keep a whole trace that propagation split in two" },
    ],
  },
];

export const ORDEM_RECOMENDADA: readonly IdDaEtapa[] = ["collector", "auto", "contexto", "logs", "manual", "amostragem"];
/** O caminho comum de quem começa pelo código. */
export const ORDEM_CODIGO_PRIMEIRO: readonly IdDaEtapa[] = ["manual", "logs", "auto", "amostragem", "contexto", "collector"];

export interface PassoDoPlano {
  readonly etapa: Etapa;
  /** Os pré-requisitos que ainda não tinham sido feitos, com a consequência. */
  readonly faltando: readonly { readonly de: IdDaEtapa; readonly sem: string }[];
  /** Todas as perguntas respondíveis até aqui. */
  readonly respondidas: readonly string[];
}

export function planejar(ordem: readonly IdDaEtapa[]): PassoDoPlano[] {
  const feitas = new Set<IdDaEtapa>();
  const respondidas: string[] = [];
  return ordem.map((id) => {
    const etapa = ETAPAS.find((e) => e.id === id)!;
    const faltando = etapa.depende.filter((d) => !feitas.has(d.de));
    feitas.add(id);
    respondidas.push(...etapa.destrava);
    return { etapa, faltando, respondidas: [...respondidas] };
  });
}

export const riscos = (plano: readonly PassoDoPlano[]) => plano.reduce((n, p) => n + p.faltando.length, 0);
