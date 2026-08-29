// motor composicional (novo)
export { World } from "./world.js";
export { initialWorld, stepWorld } from "./scheduler.js";
export {
  entryLeaf,
  exitLeaf,
  flowChildren,
  indexTree,
  isOpenable,
  visibleChild,
} from "./tree.js";
export type { TreeIndex } from "./tree.js";
export { resolveSignalTargets, resolveTarget } from "./wiring.js";
export type { SignalTarget } from "./wiring.js";
// A ordem de acomodação e a detecção de laço são grafo puro, e quem monta um
// mundo à mão pode querer conferi-las. `settle.ts` NÃO sai: a fase é mecanismo
// interno, e expô-la convidaria alguém a rodar meia fase.
export { findCombinationalCycle, settleOrder } from "./settle-graph.js";
export type { SettleNode } from "./settle-graph.js";
// quem monta um mundo à mão, sem passar por `World`, valida com esta.
export { validateWorld } from "./validate.js";
export {
  boundaryCrossings,
  inCount,
  inWeight,
  portCount,
  portWeight,
} from "./meters.js";
export type { Crossing } from "./meters.js";
export { DROP, familyOf } from "./model.js";
export type {
  AnyObject,
  Behavior,
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

// modelo antigo — andaime até a S5 migrar a landing. NÃO usar em código novo.
export { Engine } from "./engine.js";
export type { LevelId, Scenario } from "./types.js";
