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
export { resolveTarget } from "./wiring.js";
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
  Wire,
  WorldSpec,
  WorldState,
} from "./model.js";

// utilitários compartilhados
export { diffStates } from "./diff.js";
export { createRandom } from "./random.js";

// modelo antigo — andaime até a S5 migrar a landing. NÃO usar em código novo.
export { Engine } from "./engine.js";
export type { LevelId, Scenario } from "./types.js";
