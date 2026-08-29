import { randomAt } from "./rng.js";
import { DROP } from "./model.js";
import type {
  InFlight,
  Message,
  ObjectSpec,
  WorldSpec,
  WorldState,
} from "./model.js";
import { resolveTarget } from "./wiring.js";
import type { TreeIndex } from "./tree.js";

const DEFAULT_EDGE_TICKS = 4;

/**
 * Objetos que agem: folha (ou dinâmico) com comportamento. `indexTree` já
 * recusa um composto com `behavior` e filhos de fluxo — não repetimos a
 * checagem aqui porque um `TreeIndex` válido nunca contém essa combinação.
 */
function actors(tree: TreeIndex): ObjectSpec[] {
  const out: ObjectSpec[] = [];
  for (const node of tree.byId.values()) {
    if (node.kind === "static") continue;
    if (node.behavior === undefined) continue;
    out.push(node);
  }
  return out;
}

export function initialWorld(spec: WorldSpec, tree: TreeIndex): WorldState {
  const nodes: Record<string, unknown> = {};
  for (const node of actors(tree)) {
    nodes[node.id] = node.init === undefined ? {} : node.init();
  }
  return { tick: 0, nodes, flight: [], ledger: {} };
}

/**
 * Um tick: entrega o que chegou, roda cada folha, coleta as emissões e põe as
 * mensagens novas em trânsito.
 *
 * Função pura de (estado, parâmetros) — é isso que faz `seek` ser exato e o
 * comportamento ser testável sem pixel nenhum.
 */
export function stepWorld(
  spec: WorldSpec,
  tree: TreeIndex,
  state: WorldState,
  params: Readonly<Record<string, number>>,
): WorldState {
  const tick = state.tick + 1;
  const edgeTicks = spec.edgeTicks ?? DEFAULT_EDGE_TICKS;

  const inbox = new Map<string, Message[]>();
  const stillFlying: InFlight[] = [];
  for (const item of state.flight) {
    if (tick - item.sent < edgeTicks) {
      stillFlying.push(item);
      continue;
    }
    if (item.to === DROP) continue;
    const box = inbox.get(item.to) ?? [];
    box.push(item.message);
    inbox.set(item.to, box);
  }

  const nodes: Record<string, unknown> = { ...state.nodes };
  const ledger: Record<string, number> = { ...state.ledger };
  const launched: InFlight[] = [];

  const bump = (key: string, by: number): void => {
    ledger[key] = (ledger[key] ?? 0) + by;
  };

  for (const node of actors(tree)) {
    const box = inbox.get(node.id) ?? [];
    if (box.length > 0) {
      bump(`${node.id}.in`, box.length);
      for (const message of box) bump(`${node.id}.in.weight`, message.weight);
    }

    let seq = 0;
    const ctx = {
      tick,
      random: (salt = "") => randomAt(spec.seed, tick, `${node.id}:${salt}`),
      params,
      emit: (
        kind: string,
        weight = 1,
        data: Record<string, unknown> = {},
      ): Message => {
        // id derivado de (tick, nó, ordem): replay reproduz exatamente os mesmos
        const id = `${tick}:${node.id}:${seq}`;
        seq += 1;
        return { id, kind, weight, data };
      },
    };

    const behavior = node.behavior;
    if (behavior === undefined) continue;
    const result = behavior(nodes[node.id], box, ctx);
    nodes[node.id] = result.state;

    for (const emission of result.out) {
      bump(`${node.id}.${emission.port}`, 1);
      bump(`${node.id}.${emission.port}.weight`, emission.message.weight);
      const to = resolveTarget(tree, spec.wires, node.id, emission.port);
      if (to === null) {
        // Sem fio declarado e sem descarte: não é uma decisão do modelo, é um
        // buraco na autoria. Fica contado numa chave própria para que o modo autor
        // possa acusá-lo, em vez de virar o mesmo silêncio de um descarte.
        bump(`${node.id}.${emission.port}.unwired`, 1);
        continue;
      }
      launched.push({
        id: `${tick}:${node.id}:${emission.port}:${launched.length}`,
        message: emission.message,
        from: node.id,
        to,
        sent: tick,
      });
    }
  }

  return { tick, nodes, flight: [...stillFlying, ...launched], ledger };
}
