import type { WorldSpec, WorldState } from "./model.js";
import { initialWorld, stepWorld } from "./scheduler.js";
import { indexTree } from "./tree.js";
import type { TreeIndex } from "./tree.js";
import { validateWorld } from "./validate.js";

interface ParamEvent {
  readonly tick: number;
  readonly name: string;
  readonly value: number;
}

/**
 * Roda um mundo composicional e guarda o histórico desde o tick 0, o que faz
 * `seek` ser exato: rebobinar é reler, não reestimar.
 *
 * Parâmetro é **evento no tempo**, não um reset. Mudar um valor mantém o tick
 * e o estado acumulado — o mundo reage de onde está. Um lab que recomeça a
 * cada arrasto de slider apaga o que o leitor acabou de construir e esconde a
 * transição entre dois regimes, que é justamente onde está o aprendizado.
 */
export class World {
  readonly #spec: WorldSpec;
  readonly #tree: TreeIndex;
  #events: ParamEvent[] = [];
  #history: WorldState[];
  #tick = 0;

  constructor(spec: WorldSpec) {
    this.#spec = spec;
    this.#tree = indexTree(spec.root, spec.channels);
    // Antes de qualquer tick: um mundo mal fiado precisa falhar aqui, alto, e
    // não rodar em silêncio perdendo mensagens pelo caminho.
    validateWorld(spec, this.#tree);
    this.#history = [initialWorld(spec, this.#tree)];
  }

  get tree(): TreeIndex {
    return this.#tree;
  }

  get tick(): number {
    return this.#tick;
  }

  get state(): WorldState {
    return this.#at(this.#tick);
  }

  get previousState(): WorldState | undefined {
    return this.#tick === 0 ? undefined : this.#at(this.#tick - 1);
  }

  /** Parâmetros vigentes num tick: os eventos dobrados até ali. */
  paramsAt(tick: number): Readonly<Record<string, number>> {
    const params: Record<string, number> = { ...this.#spec.params };
    for (const event of this.#events) {
      if (event.tick <= tick) params[event.name] = event.value;
    }
    return params;
  }

  get params(): Readonly<Record<string, number>> {
    return this.paramsAt(this.#tick);
  }

  advance(n = 1): void {
    this.seek(this.#tick + n);
  }

  seek(tick: number): void {
    const target = Math.max(0, Math.trunc(tick));
    this.#ensure(target);
    this.#tick = target;
  }

  /**
   * Grava a mudança no tick atual. O histórico à frente (se houver) é
   * descartado porque foi calculado com o valor antigo; o passado continua
   * válido, então `seek` para trás segue exato.
   */
  setParam(name: string, value: number): void {
    // Rebobinar e mexer num parâmetro abandona o futuro que existia: os estados
    // dali para a frente foram calculados com o valor antigo, e os eventos
    // marcados lá também pertencem àquela linha do tempo. Descartar só os
    // estados e guardar os eventos faria o mundo recalcular o passado com uma
    // decisão que o leitor nunca tomou nesta linha.
    this.#events = this.#events.filter((e) => e.tick <= this.#tick);
    this.#events.push({ tick: this.#tick, name, value });
    this.#history = this.#history.slice(0, this.#tick + 1);
  }

  #at(tick: number): WorldState {
    const state = this.#history[tick];
    if (state === undefined) {
      throw new Error(`World: tick ${tick} ainda não foi computado`);
    }
    return state;
  }

  #ensure(tick: number): void {
    while (this.#history.length <= tick) {
      const next = this.#history.length;
      this.#history.push(
        stepWorld(this.#spec, this.#tree, this.#at(next - 1), this.paramsAt(next)),
      );
    }
  }
}
