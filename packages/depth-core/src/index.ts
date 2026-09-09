// motor composicional (novo)
export { World } from "./world.js";
export { initialWorld, stepWorld } from "./scheduler.js";
export {
  entryLeaf,
  exitLeaf,
  flowChildren,
  indexTree,
  isOpenable,
  shortcutOwner,
  visibleChild,
} from "./tree.js";
export type { TreeIndex } from "./tree.js";
export { emissoesPorPorta } from "./emissoes.js";
export type { EmissaoDaPorta } from "./emissoes.js";
export { expandPorts, resolveSignalTargets, resolveTarget, resolveTargets } from "./wiring.js";
export type { SignalTarget } from "./wiring.js";
// A ordem de acomodação e a detecção de laço são grafo puro, e quem monta um
// mundo à mão pode querer conferi-las. `settle.ts` NÃO sai: a fase é mecanismo
// interno, e expô-la convidaria alguém a rodar meia fase.
export { findCombinationalCycle, settleOrder } from "./settle-graph.js";
export type { SettleNode } from "./settle-graph.js";
// quem monta um mundo à mão, sem passar por `World`, valida com esta.
export { validateWorld } from "./validate.js";
// Um atalho só é legítimo se um teste provar que ele concorda com a composição.
// Estas duas SÃO esse teste, e por isso são superfície pública.
export { boundaryProjection, shortcutDisagreement } from "./shortcut.js";
export type { BoundaryProjection } from "./shortcut.js";
export {
  boundaryCrossings,
  inCount,
  inWeight,
  portCount,
  portWeight,
} from "./meters.js";
export type { Crossing } from "./meters.js";
export { borneNode, bornePort, DROP, familyOf } from "./model.js";
export type {
  AnyObject,
  Behavior,
  Borne,
  BorneInterno,
  Drop,
  Emission,
  Family,
  InFlight,
  Kind,
  LineKind,
  Locus,
  Message,
  ObjectSpec,
  PortId,
  Role,
  StepContext,
  TickPhase,
  Wire,
  WireTiming,
  WorldSpec,
  WorldState,
} from "./model.js";

// utilitários compartilhados
export { diffStates } from "./diff.js";
export { createRandom } from "./random.js";

/**
 * Seguir um item: o trajeto de UMA coisa, e o que cada parada mudou nela.
 *
 * Mora no motor porque identidade e trajeto são conceito do motor: o motor dá
 * id novo a cada emissão — e está certo, cada salto é uma mensagem nova —, e
 * quem sabe que duas mensagens são a mesma coisa é o domínio, pelo `LeitorDaCarga`.
 * O desenho disso é a `Trilha`, no `depth-ui`.
 */
export { PARADAS_NO_PAINEL, seguir } from "./seguir.js";
export type { LeitorDaCarga, Parada } from "./seguir.js";

/*
  O modelo antigo: níveis FIXOS (L0 Flow, L1 Mechanism, L2 Wire, L3 Payload) em
  vez da árvore de composição.

  Sem consumidor desde que a landing migrou (Entrega 15). Fica de propósito, e
  não por esquecimento: a escada fixa descreve bem um assunto em que descer é
  descer de verdade — uma CPU até o fio —, e o dia em que um handbook quiser
  exatamente isso, ela está aqui. O que ela não descreve é um trace, que não tem
  *dentro*. Ver `DECISIONS.md` §9.

  NÃO usar em código novo sem essa conversa.
*/
export { Engine } from "./engine.js";
export type { LevelId, Scenario } from "./types.js";
