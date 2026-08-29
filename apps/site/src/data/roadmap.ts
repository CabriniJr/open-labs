/**
 * Espaço de coordenadas do mapa. Os nós são posicionados em % sobre ele.
 *
 * Eram constantes do módulo, e o mapa só sabia desenhar o do OTel. Cada
 * handbook tem o seu — a anatomia é a mesma (roadmap · artigos · labs), o
 * caminho é que não é —, então elas viraram campos de um mapa que se passa ao
 * componente.
 */
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 870;
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

export const phases: readonly RoadmapPhase[] = [
  { number: 1, title: "The Problem", y: 44 },
  { number: 2, title: "The Model", y: 178 },
  { number: 3, title: "The Architecture", y: 368 },
  { number: 4, title: "Instrumentation", y: 502 },
  { number: 5, title: "Operating at Scale", y: 692 },
];

export const labs: readonly RoadmapLab[] = [
  { id: "three-pillars", title: "Three pillars, one blind spot", href: "#", status: "coming", side: "left", y: 110, phase: 1 },
  { id: "disconnected-signals", title: "The cost of disconnected signals", href: "#", status: "coming", side: "right", y: 110, phase: 1 },

  // "available" com href "#": o nó abria como link e não levava a lugar nenhum.
  // A Entrega 2 mudou de rumo e este lab nunca foi construído — então ele é
  // caminho declarado, como os outros, e é assim que tem que aparecer.
  { id: "anatomy-of-a-trace", title: "Anatomy of a Trace", href: "#", status: "coming", side: "left", y: 244, phase: 2 },
  { id: "hard-context-and-baggage", title: "Hard context and baggage", href: "#", status: "coming", side: "right", y: 244, phase: 2 },
  { id: "reading-an-otlp-payload", title: "Reading an OTLP payload", href: "#", status: "coming", side: "left", y: 300, phase: 2 },

  { id: "collector-pipeline", title: "The Collector pipeline", href: "#", status: "coming", side: "left", y: 434, phase: 3 },
  { id: "agent-or-gateway", title: "Agent or gateway", href: "#", status: "coming", side: "right", y: 434, phase: 3 },

  { id: "manual-spans", title: "Manual spans", href: "#", status: "coming", side: "left", y: 568, phase: 4 },
  { id: "zero-code-instrumentation", title: "Zero-code instrumentation", href: "#", status: "coming", side: "right", y: 568, phase: 4 },
  { id: "host-and-kubernetes-signals", title: "Host and Kubernetes signals", href: "#", status: "coming", side: "left", y: 624, phase: 4 },

  { id: "head-vs-tail-sampling", title: "Head vs tail sampling", href: "#", status: "coming", side: "left", y: 758, phase: 5 },
  { id: "backpressure-and-drops", title: "Backpressure and drops", href: "#", status: "coming", side: "right", y: 758, phase: 5 },
  { id: "the-rollout", title: "The rollout", href: "#", status: "coming", side: "left", y: 814, phase: 5 },
];

export const annexes: readonly RoadmapAnnex[] = [
  { id: "w3c-trace-context", title: "W3C Trace Context", y: 244, afterLab: "anatomy-of-a-trace" },
  { id: "otlp", title: "OTLP", y: 300, afterLab: "reading-an-otlp-payload" },
  { id: "grpc-http2", title: "gRPC over HTTP/2", y: 434, afterLab: "collector-pipeline" },
];

export const MAPA_OTEL: RoadmapMap = {
  // A chave antiga, de propósito: mudá-la apagaria o progresso de quem já leu.
  storageKey: "ovh:progress:v1",
  height: MAP_HEIGHT,
  spineTop: 31,
  spineBottom: 814,
  phases,
  labs,
  annexes,
  annexLegend: "The Wire · reference, not a step",
};
