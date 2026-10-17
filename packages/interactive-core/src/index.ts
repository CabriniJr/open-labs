/**
 * Contrato de interação, não de fluxo. O domínio escolhe os eventos, o tempo
 * e a forma do estado. Não há árvore, porta, mensagem ou renderizador imposto.
 * Estados e eventos devem ser clonáveis; tempo e acaso precisam ser explícitos.
 */
export interface InteractiveModel<S, E> {
  readonly id: string;
  readonly initial: () => S;
  readonly transition: (state: Readonly<S>, event: E) => S;
}

/** Histórico de experimentos, compartilhável por interações de tipos distintos. */
export class InteractiveSession<S, E> {
  readonly #model: InteractiveModel<S, E>;
  readonly #limit: number;
  #states: S[];
  #events: E[] = [];
  #cursor = 0;

  constructor(model: InteractiveModel<S, E>, limit = 1000) {
    this.#model = model;
    this.#limit = limit;
    this.#states = [structuredClone(model.initial())];
  }

  get state(): Readonly<S> { return this.#states[this.#cursor]!; }
  get cursor(): number { return this.#cursor; }
  get length(): number { return this.#events.length; }

  dispatch(event: E): Readonly<S> {
    if (this.#cursor >= this.#limit) throw new Error("Experiment history is full. Rewind or reset to continue.");
    // Uma transição que falha não apaga o futuro; cópias isolam o histórico
    // inclusive de um adaptador que ainda não respeite imutabilidade.
    const recorded = structuredClone(event);
    const next = this.#model.transition(structuredClone(this.state), structuredClone(recorded));
    this.#events = [...this.#events.slice(0, this.#cursor), recorded];
    this.#states = [...this.#states.slice(0, this.#cursor + 1), structuredClone(next)];
    this.#cursor += 1;
    return this.state;
  }

  seek(cursor: number): Readonly<S> {
    if (!Number.isInteger(cursor) || cursor < 0 || cursor > this.length) throw new Error("History position is out of range.");
    this.#cursor = cursor;
    return this.state;
  }

  reset(): Readonly<S> {
    this.#states = [structuredClone(this.#model.initial())];
    this.#events = [];
    this.#cursor = 0;
    return this.state;
  }
}
