import { createRandom } from "./random.js";
import type { LevelId, Scenario, StepContext } from "./types.js";

/**
 * Executa um cenário. Mantém o histórico completo desde o tick 0, o que torna
 * `seek` exato: rebobinar é reler o histórico, não recalcular por aproximação.
 */
export class Engine<S> {
  readonly levels: readonly LevelId[];

  #scenario: Scenario<S>;
  #inputs: StepContext["inputs"];
  #history: S[];
  #tick = 0;

  constructor(scenario: Scenario<S>, inputs: StepContext["inputs"] = {}) {
    this.#scenario = scenario;
    this.#inputs = inputs;
    this.levels = scenario.levels;
    this.#history = [scenario.initialState(inputs)];
  }

  get tick(): number {
    return this.#tick;
  }

  get state(): Readonly<S> {
    return this.#at(this.#tick);
  }

  /** Estado em um tick já computado. Lança se o tick ainda não existe. */
  #at(tick: number): Readonly<S> {
    const s = this.#history[tick];
    if (s === undefined) {
      throw new Error(`Engine: tick ${tick} ainda não foi computado`);
    }
    return s;
  }

  /** Garante que o histórico chega até `tick`, computando o que faltar. */
  #ensure(tick: number): void {
    while (this.#history.length <= tick) {
      const nextTick = this.#history.length;
      const previous = this.#at(nextTick - 1);
      // Recria o RNG a cada tick para que o valor sorteado dependa só da seed e
      // do número do tick — nunca da ordem em que o leitor navegou pela linha
      // do tempo.
      const random = createRandom(this.#scenario.seed + nextTick);
      this.#history.push(
        this.#scenario.step(previous, {
          tick: nextTick,
          random,
          inputs: this.#inputs,
        }),
      );
    }
  }

  advance(n = 1): void {
    this.seek(this.#tick + n);
  }

  seek(tick: number): void {
    const target = Math.max(0, Math.trunc(tick));
    this.#ensure(target);
    this.#tick = target;
  }

  /** Trocar inputs invalida o histórico: a simulação recomeça do tick 0. */
  setInputs(inputs: StepContext["inputs"]): void {
    this.#inputs = inputs;
    this.#history = [this.#scenario.initialState(inputs)];
    this.#tick = 0;
  }

  /** Estado imediatamente anterior ao tick atual, ou `undefined` no tick 0. */
  get previousState(): Readonly<S> | undefined {
    return this.#tick === 0 ? undefined : this.#at(this.#tick - 1);
  }
}
