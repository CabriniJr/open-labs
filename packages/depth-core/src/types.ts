/** Um nível de profundidade. O motor não sabe o que cada um significa. */
export type LevelId = "flow" | "mechanism" | "wire" | "payload";

export interface StepContext {
  /** Tick que está sendo calculado, começando em 1. */
  readonly tick: number;
  /** Aleatoriedade com seed. Determinística dentro de um replay. */
  readonly random: () => number;
  /** Valores dos controles expostos ao leitor. Constantes durante um replay. */
  readonly inputs: Readonly<Record<string, number | string | boolean>>;
}

export interface Scenario<S> {
  readonly id: string;
  readonly seed: number;
  /** Níveis que este cenário implementa. Nem todo cenário tem os quatro. */
  readonly levels: readonly LevelId[];
  readonly initialState: (inputs: StepContext["inputs"]) => S;
  /** Função pura: nunca muta `state`, sempre devolve um novo. */
  readonly step: (state: S, ctx: StepContext) => S;
}
