/**
 * Espaço de coordenadas do mapa. Os nós são posicionados em % sobre ele.
 *
 * Eram constantes do módulo, e o mapa só sabia desenhar o do OTel. Cada
 * handbook tem o seu — a anatomia é a mesma (roadmap · artigos · labs), o
 * caminho é que não é —, então elas viraram campos de um mapa que se passa ao
 * componente.
 */
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 982;
export const SPINE_X = 500;
export const LEFT_X = 230;
export const RIGHT_X = 570;
export const NODE_W = 200;
export const NODE_H = 40;
export const PHASE_X = 415;
export const PHASE_W = 170;
export const ANNEX_X = 40;
export const ANNEX_W = 160;

/**
 * Um mapa de handbook: a espinha das fases, os labs pendurados nela, e os
 * anexos — referência que vários labs puxam, e que não é etapa.
 */
export interface RoadmapMap {
  /** Onde o progresso deste mapa é guardado. Um handbook não conta o do outro. */
  readonly storageKey: string;
  readonly height: number;
  /** A espinha vai daqui até ali, no espaço de coordenadas. */
  readonly spineTop: number;
  readonly spineBottom: number;
  readonly phases: readonly RoadmapPhase[];
  readonly labs: readonly RoadmapLab[];
  readonly annexes: readonly RoadmapAnnex[];
  /** O rótulo da trilha de anexos na legenda: cada handbook chama o seu. */
  readonly annexLegend: string;
}

export interface RoadmapPhase {
  readonly number: number;
  readonly title: string;
  readonly y: number;
}

export interface RoadmapLab {
  readonly id: string;
  readonly title: string;
  readonly href: string;
  /** "coming" = ainda não escrito: não é clicável nem marcável. */
  readonly status: "available" | "coming";
  readonly side: "left" | "right";
  readonly y: number;
  /** Número da fase (RoadmapPhase.number) a que este lab pertence, para ordenar a lista empilhada do mobile. */
  readonly phase: number;
}

/** Anexo do acervo The Wire: referência que vários labs puxam, não etapa. */
export interface RoadmapAnnex {
  readonly id: string;
  readonly title: string;
  readonly y: number;
  /** Id do lab logo após o qual este anexo deve ser listado na ordem de leitura (mobile). */
  readonly afterLab: string;
}

/**
 * A régua do mapa, e ela é aritmética para que ninguém precise adivinhar um `y`:
 *
 * - a primeira fileira de uma fase fica em `fase.y + 66`
 * - cada fileira seguinte, `+56` da anterior
 * - a fase seguinte começa `+68` depois da última fileira da anterior
 * - a altura do mapa é a última fileira `+56`
 *
 * Acrescentar um lab é escolher a fileira e recalcular para baixo. Sem a régua
 * escrita, o próximo nó entra num `y` plausível e o mapa passa a ter dois
 * espaçamentos diferentes — que é o tipo de defeito que ninguém vê e ninguém
 * conserta.
 */
export const phases: readonly RoadmapPhase[] = [
  { number: 1, title: "The Problem", y: 44 },
  { number: 2, title: "The Model", y: 178 },
  { number: 3, title: "The Architecture", y: 424 },
  { number: 4, title: "Instrumentation", y: 614 },
  { number: 5, title: "Operating at Scale", y: 804 },
];

/**
 * A trilha completa, e o motivo de ela aparecer inteira desde já está na spec do
 * handbook §3: **saber o que vem é parte de saber onde se está.** Nó por
 * escrever é visível e marcado, nunca escondido.
 *
 * A ordem dentro de uma fase é de pré-requisito, não de gosto: mesma fileira
 * significa paralelo, fileira abaixo significa depende do que está acima. É por
 * isso que `providers` está sozinho na primeira fileira da fase 3 — os dois nós
 * do Collector dependem de o leitor já saber quem decide o que sai do processo.
 */
export const labs: readonly RoadmapLab[] = [
  { id: "three-pillars", title: "Three pillars, one blind spot", href: "#", status: "coming", side: "left", y: 110, phase: 1 },
  { id: "disconnected-signals", title: "The cost of disconnected signals", href: "#", status: "coming", side: "right", y: 110, phase: 1 },

  // "available" com href "#": o nó abria como link e não levava a lugar nenhum.
  // A Entrega 2 mudou de rumo e este lab nunca foi construído — então ele é
  // caminho declarado, como os outros, e é assim que tem que aparecer.
  { id: "anatomy-of-a-trace", title: "Anatomy of a Trace", href: "#", status: "coming", side: "left", y: 244, phase: 2 },
  { id: "hard-context-and-baggage", title: "Hard context and baggage", href: "#", status: "coming", side: "right", y: 244, phase: 2 },
  { id: "reading-an-otlp-payload", title: "Reading an OTLP payload", href: "#", status: "coming", side: "left", y: 300, phase: 2 },
  // A fase 2 prometia "the shape the data has" e modelava um sinal só: três nós
  // de trace, zero de métrica, zero de log. A promessa da fase 1 é que os três
  // soltos não são observabilidade, e um currículo que só modela trace repete o
  // erro que o handbook existe para desfazer.
  { id: "the-shape-of-a-metric", title: "The shape of a metric", href: "#", status: "coming", side: "right", y: 300, phase: 2 },
  { id: "a-log-that-knows-its-trace", title: "A log that knows its trace", href: "#", status: "coming", side: "left", y: 356, phase: 2 },

  // `providers` sozinho na primeira fileira: é pré-requisito dos dois abaixo.
  // Quem não sabe o que um provider decide não tem como avaliar o que um
  // Collector muda depois.
  { id: "providers", title: "The three providers", href: "#", status: "coming", side: "left", y: 490, phase: 3 },
  { id: "collector-pipeline", title: "The Collector pipeline", href: "#", status: "coming", side: "left", y: 546, phase: 3 },
  { id: "agent-or-gateway", title: "Agent or gateway", href: "#", status: "coming", side: "right", y: 546, phase: 3 },

  { id: "manual-spans", title: "Manual spans", href: "#", status: "coming", side: "left", y: 680, phase: 4 },
  { id: "zero-code-instrumentation", title: "Zero-code instrumentation", href: "#", status: "coming", side: "right", y: 680, phase: 4 },
  // Contexto não atravessa fila sozinho, e é a lacuna que mais aparece em
  // produção: o trace morre no `send` e reaparece órfão no `consume`.
  { id: "propagating-through-a-queue", title: "Propagating through a queue", href: "#", status: "coming", side: "left", y: 736, phase: 4 },
  { id: "host-and-kubernetes-signals", title: "Host and Kubernetes signals", href: "#", status: "coming", side: "right", y: 736, phase: 4 },

  { id: "head-vs-tail-sampling", title: "Head vs tail sampling", href: "#", status: "coming", side: "left", y: 870, phase: 5 },
  { id: "backpressure-and-drops", title: "Backpressure and drops", href: "#", status: "coming", side: "right", y: 870, phase: 5 },
  // A fase 5 fala de custo desde a spec do handbook §3 e não tinha nó para ele.
  // Cardinalidade é onde o custo mora, e é decisão de atributo — coisa que se
  // toma na instrumentação e se paga na fatura, meses depois.
  { id: "cardinality-and-the-bill", title: "Cardinality and the bill", href: "#", status: "coming", side: "left", y: 926, phase: 5 },
  { id: "the-rollout", title: "The rollout", href: "#", status: "coming", side: "right", y: 926, phase: 5 },
];

/**
 * O acervo The Wire. Anexo **não é etapa**: é referência que vários labs puxam,
 * e por isso ele pendura por aresta tracejada em vez de entrar na espinha.
 *
 * `y` alinha com o lab da esquerda que o puxa primeiro, e `afterLab` dá a ordem
 * de leitura no mobile, onde não há coluna lateral para pendurar nada.
 */
export const annexes: readonly RoadmapAnnex[] = [
  { id: "w3c-trace-context", title: "W3C Trace Context", y: 244, afterLab: "anatomy-of-a-trace" },
  { id: "otlp", title: "OTLP", y: 300, afterLab: "reading-an-otlp-payload" },
  // O envelope e a codificação dele são duas perguntas: o que o campo significa,
  // e por que o `tcpdump` não mostra nenhum deles.
  { id: "protobuf-encoding", title: "Protobuf encoding", y: 356, afterLab: "a-log-that-knows-its-trace" },
  { id: "grpc-http2", title: "gRPC over HTTP/2", y: 546, afterLab: "collector-pipeline" },
  // Convenção semântica é anexo, e não etapa, por definição: é o vocabulário que
  // toda instrumentação tem de usar, e nenhum lab é "sobre" ele.
  { id: "semantic-conventions", title: "Semantic conventions", y: 680, afterLab: "manual-spans" },
];

export const MAPA_OTEL: RoadmapMap = {
  // A chave antiga, de propósito: mudá-la apagaria o progresso de quem já leu.
  storageKey: "ovh:progress:v1",
  height: MAP_HEIGHT,
  spineTop: 31,
  spineBottom: 926,
  phases,
  labs,
  annexes,
  annexLegend: "The Wire · reference, not a step",
};
