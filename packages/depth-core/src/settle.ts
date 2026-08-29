// packages/depth-core/src/settle.ts
import { DROP } from "./model.js";
import type { Emission, Message, PortId, WorldSpec } from "./model.js";
import { settleOrder } from "./settle-graph.js";

/** O que chegou a um ator: carga na caixa, sinal por porta, carga por entrada. */
export interface Delivery {
  readonly cargo: readonly Message[];
  readonly signals: Readonly<Record<PortId, readonly Message[]>>;
  readonly inlets: Readonly<Record<PortId, readonly Message[]>>;
}

export interface SettleResult {
  /** O que cada ator recebeu durante a acomodação. */
  readonly deliveries: ReadonlyMap<string, Delivery>;
  /**
   * Quantos subpassos a acomodação levou — a profundidade do caminho
   * combinacional que de fato propagou algo. É o que a tela mostra dentro do
   * tick, e é o que atraso de propagação significa.
   */
  readonly substeps: number;
  /** Contagens a somar no livro-caixa: chave -> quanto. */
  readonly ledger: ReadonlyMap<string, number>;
  /** Em que subpasso cada ator rodou. É a profundidade dele no caminho. */
  readonly depths: ReadonlyMap<string, number>;
}

/** Acumulador mutável de entregas, virado em `Delivery` no fim. */
interface Caixa {
  cargo: Message[];
  signals: Map<PortId, Message[]>;
  inlets: Map<PortId, Message[]>;
}

/**
 * A fase de acomodação de um tick.
 *
 * Percorre o subgrafo acomodado em ordem topológica — possível porque
 * `validateWorld` recusou laço combinacional — e por isso cada ator roda uma
 * vez só, com o conjunto completo do que chegou até ele. Nada aqui escreve
 * estado: o `state` que um comportamento devolve nesta fase é **descartado**,
 * exatamente como lógica combinacional não guarda.
 *
 * `runOne` é injetado por `scheduler.ts` porque quem sabe montar o contexto de
 * um ator (sorteio endereçável, `emit` com id determinístico, cobrança do
 * regime da porta) é ele. Assim esta função não conhece semente nem numeração.
 */
export function settle(
  spec: WorldSpec,
  clocked: ReadonlyMap<string, readonly Message[]>,
  clockedSignals: ReadonlyMap<string, ReadonlyMap<PortId, readonly Message[]>>,
  clockedInlets: ReadonlyMap<string, ReadonlyMap<PortId, readonly Message[]>>,
  runOne: (
    id: string,
    cargo: readonly Message[],
    signals: Readonly<Record<PortId, readonly Message[]>>,
    inlets: Readonly<Record<PortId, readonly Message[]>>,
  ) => readonly Emission[],
  /** Quem dirige a linha sem receber nada — o trilho de alimentação. */
  dirigeSempre: (id: string) => boolean = () => false,
): SettleResult {
  const ordem = settleOrder(spec.wires);
  const caixas = new Map<string, Caixa>();
  const ledger = new Map<string, number>();
  const depths = new Map<string, number>();
  let substeps = 0;

  const bump = (chave: string, quanto: number): void => {
    ledger.set(chave, (ledger.get(chave) ?? 0) + quanto);
  };

  const caixa = (id: string): Caixa => {
    const existente = caixas.get(id);
    if (existente !== undefined) return existente;
    const nova: Caixa = { cargo: [], signals: new Map(), inlets: new Map() };
    caixas.set(id, nova);
    return nova;
  };

  for (const { id, depth } of ordem) {
    const minha = caixas.get(id);
    const cargo = [...(clocked.get(id) ?? []), ...(minha?.cargo ?? [])];

    const signals: Record<PortId, readonly Message[]> = {};
    for (const [porta, msgs] of clockedSignals.get(id) ?? []) signals[porta] = [...msgs];
    for (const [porta, msgs] of minha?.signals ?? []) {
      signals[porta] = [...(signals[porta] ?? []), ...msgs];
    }

    const inlets: Record<PortId, readonly Message[]> = {};
    for (const [porta, msgs] of clockedInlets.get(id) ?? []) inlets[porta] = [...msgs];
    for (const [porta, msgs] of minha?.inlets ?? []) {
      inlets[porta] = [...(inlets[porta] ?? []), ...msgs];
    }

    // Nada chegou: não há o que propagar a partir daqui — a não ser que este
    // objeto seja um trilho, cujo trabalho é dirigir a linha sem depender de
    // entrada nenhuma. Sem esta ressalva, o trilho nunca agiria, e o circuito
    // ligado nele ficaria morto sem ninguém dizer por quê.
    if (!dirigeSempre(id) && cargo.length === 0 && Object.keys(signals).length === 0) continue;

    // Conta o nível de quem RECEBEU, e não o de quem emitiu: o último elo de um
    // caminho combinacional costuma ser um elemento de memória, que na
    // acomodação não emite nada — contar só emissores esconderia o nível em que
    // o valor de fato chegou, que é justamente o atraso que se quer mostrar.
    substeps = Math.max(substeps, depth + 1);
    depths.set(id, depth);

    const emissoes = runOne(id, cargo, signals, inlets);
    if (emissoes.length === 0) continue;

    for (const emissao of emissoes) {
      for (const wire of spec.wires) {
        if (wire.from !== id || wire.port !== emissao.port) continue;
        if ((wire.timing ?? "clocked") !== "settle") continue;
        if (wire.to === DROP) continue;

        const destino = caixa(wire.to);
        if ((wire.line ?? "data") === "control") {
          const porta = wire.toPort!;
          const lista = destino.signals.get(porta) ?? [];
          lista.push(emissao.message);
          destino.signals.set(porta, lista);
          bump(`sigin:${wire.to}.${porta}`, 1);
        } else {
          destino.cargo.push(emissao.message);
          if (wire.toPort !== undefined) {
            const lista = destino.inlets.get(wire.toPort) ?? [];
            lista.push(emissao.message);
            destino.inlets.set(wire.toPort, lista);
          }
          bump(`in:${wire.to}`, 1);
          bump(`in:${wire.to}.weight`, emissao.message.weight);
        }
      }
    }
  }

  const deliveries = new Map<string, Delivery>();
  for (const [id, c] of caixas) {
    const signals: Record<PortId, readonly Message[]> = {};
    for (const [porta, msgs] of c.signals) signals[porta] = msgs;
    const inlets: Record<PortId, readonly Message[]> = {};
    for (const [porta, msgs] of c.inlets) inlets[porta] = msgs;
    deliveries.set(id, { cargo: c.cargo, signals, inlets });
  }

  return { deliveries, substeps, ledger, depths };
}
