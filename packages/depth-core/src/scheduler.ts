import { randomAt } from "./rng.js";
import { DROP, familyOf } from "./model.js";
import type {
  Emission,
  InFlight,
  Message,
  ObjectSpec,
  StepContext,
  TickPhase,
  WireTiming,
  WorldSpec,
  WorldState,
} from "./model.js";
import { settle } from "./settle.js";
import { resolveSignalTargets, resolveTargets } from "./wiring.js";
import { shortcutOwner } from "./tree.js";
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
    if (familyOf(node.kind) === "plate") continue;
    if (acao(node) === undefined) continue;
    // Dentro de um atalho ninguém roda: quem responde pelo interior é o atalho.
    if (shortcutOwner(tree, node.id) !== undefined) continue;
    out.push(node);
  }
  return out;
}

/** O que este objeto executa: o atalho, se houver; senão o comportamento. */
function acao(node: ObjectSpec): ObjectSpec["behavior"] {
  return node.shortcut ?? node.behavior;
}

/**
 * O estado do tick 0. Só a árvore importa aqui: o estado inicial é a soma dos
 * `init` de quem age, e nada em `WorldSpec` participa disso — receber o spec
 * sem usá-lo só sugeriria uma dependência que não existe.
 *
 * `init` só é chamado em quem tem `behavior`, e é por isso que `validateWorld`
 * recusa `init` sem `behavior`: seria um estado construído que ninguém leria,
 * silêncio de novo em vez de erro.
 */
export function initialWorld(tree: TreeIndex): WorldState {
  const nodes: Record<string, unknown> = {};
  for (const node of actors(tree)) {
    nodes[node.id] = node.init === undefined ? {} : node.init();
  }
  return { tick: 0, nodes, flight: [], ledger: {}, substeps: 0, substepOf: {} };
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

  const nodes: Record<string, unknown> = { ...state.nodes };
  const ledger: Record<string, number> = { ...state.ledger };
  const launched: InFlight[] = [];

  const bump = (key: string, by: number): void => {
    ledger[key] = (ledger[key] ?? 0) + by;
  };

  // O que venceu no voo. Sinal e carga vão para caixas diferentes: sinal
  // modifica o que o ator faz, e nunca é carga.
  const inbox = new Map<string, Message[]>();
  const sinais = new Map<string, Map<string, Message[]>>();
  const stillFlying: InFlight[] = [];
  for (const item of state.flight) {
    if (tick - item.sent < edgeTicks) {
      stillFlying.push(item);
      continue;
    }
    if (item.to === DROP) continue;
    if (item.signalPort !== undefined) {
      const porPorta = sinais.get(item.to) ?? new Map<string, Message[]>();
      const lista = porPorta.get(item.signalPort) ?? [];
      lista.push(item.message);
      porPorta.set(item.signalPort, lista);
      sinais.set(item.to, porPorta);
      bump(`sigin:${item.to}.${item.signalPort}`, 1);
      continue;
    }
    const box = inbox.get(item.to) ?? [];
    box.push(item.message);
    inbox.set(item.to, box);
  }

  const atores = actors(tree);
  // Uma entrega para quem não age é bug do motor, não do autor: `validateWorld`
  // já recusou esse mundo na construção. Se chegar aqui, a caixa morreria com o
  // Map local e a mensagem sumiria sem aparecer no livro-caixa.
  const ehAtor = new Set(atores.map((n) => n.id));
  for (const destino of inbox.keys()) {
    if (!ehAtor.has(destino)) {
      throw new Error(
        `scheduler: entrega para "${destino}", que não age — ` +
          `validateWorld deveria ter recusado este mundo`,
      );
    }
  }

  // Qual regime cada porta tem. `validateWorld` já garantiu que uma porta não
  // mistura os dois, então a primeira aresta que casa decide.
  const tempoDaPorta = new Map<string, WireTiming>();
  for (const wire of spec.wires) {
    const chave = `${wire.from}\u0000${wire.port}`;
    if (!tempoDaPorta.has(chave)) tempoDaPorta.set(chave, wire.timing ?? "clocked");
  }

  const porId = new Map(atores.map((n) => [n.id, n]));
  const seqPorNo = new Map<string, number>();

  const contexto = (
    node: ObjectSpec,
    phase: TickPhase,
    signals: Readonly<Record<string, readonly Message[]>>,
  ): StepContext => ({
    tick,
    phase,
    signals,
    params,
    random: (salt = "") => randomAt(spec.seed, tick, `${node.id}:${salt}`),
    emit: (kind: string, weight = 1, data: Record<string, unknown> = {}): Message => {
      const seq = seqPorNo.get(node.id) ?? 0;
      seqPorNo.set(node.id, seq + 1);
      // O id carrega a fase: sem isso, a mesma folha emitindo nas duas fases do
      // mesmo tick geraria dois ids iguais, e o replay deixaria de ser exato.
      const marca = phase === "settle" ? "s" : "c";
      return { id: `${tick}:${node.id}:${marca}${seq}`, kind, weight, data };
    },
  });

  /** Roda um ator numa fase, contando as saídas e cobrando o regime da porta. */
  const rodar = (
    id: string,
    phase: TickPhase,
    cargo: readonly Message[],
    signals: Readonly<Record<string, readonly Message[]>>,
  ): readonly Emission[] => {
    const node = porId.get(id);
    const executar = node === undefined ? undefined : acao(node);
    if (node === undefined || executar === undefined) return [];

    const resultado = executar(nodes[id], cargo, contexto(node, phase, signals));
    // Só o confronto escreve estado. Quem acomoda não guarda — é o que separa
    // lógica combinacional de elemento de memória, e aqui é estrutural: o
    // `state` devolvido na acomodação nem chega a ser lido.
    if (phase === "commit") nodes[id] = resultado.state;

    for (const emissao of resultado.out) {
      const regime = tempoDaPorta.get(`${id}\u0000${emissao.port}`) ?? "clocked";
      if (regime === "settle" && phase === "commit") {
        throw new Error(
          `scheduler: a porta "${emissao.port}" de "${id}" entrega na acomodação, e o ` +
            `comportamento emitiu nela durante o confronto — a mensagem chegaria tarde ` +
            `demais para o caminho combinacional deste tick. Emita nela quando ` +
            `ctx.phase for "settle"`,
        );
      }
      if (regime === "clocked" && phase === "settle") {
        throw new Error(
          `scheduler: a porta "${emissao.port}" de "${id}" entrega por relógio, e o ` +
            `comportamento emitiu nela durante a acomodação. Emita nela quando ` +
            `ctx.phase for "commit"`,
        );
      }
      bump(`out:${id}.${emissao.port}`, 1);
      bump(`out:${id}.${emissao.port}.weight`, emissao.message.weight);
    }
    return resultado.out;
  };

  // FASE 1 — acomodação. Propaga dentro do tick e não escreve estado.
  const acomodado = settle(spec, inbox, sinais, (id, cargo, sinaisDele) =>
    rodar(id, "settle", cargo, sinaisDele),
  );
  for (const [chave, quanto] of acomodado.ledger) bump(chave, quanto);

  // FASE 2 — confronto. Onde o estado muda e onde nascem as mensagens que
  // custam tick.
  for (const node of atores) {
    const cronometrado = inbox.get(node.id) ?? [];
    if (cronometrado.length > 0) {
      bump(`in:${node.id}`, cronometrado.length);
      for (const message of cronometrado) bump(`in:${node.id}.weight`, message.weight);
    }

    const entregue = acomodado.deliveries.get(node.id);
    const cargo = [...cronometrado, ...(entregue?.cargo ?? [])];

    const sinaisDaqui: Record<string, readonly Message[]> = { ...(entregue?.signals ?? {}) };
    for (const [porta, msgs] of sinais.get(node.id) ?? []) {
      sinaisDaqui[porta] = [...(sinaisDaqui[porta] ?? []), ...msgs];
    }

    for (const emissao of rodar(node.id, "commit", cargo, sinaisDaqui)) {
      const alvosDeSinal = resolveSignalTargets(spec.wires, node.id, emissao.port);
      for (const alvo of alvosDeSinal) {
        launched.push({
          id: `${tick}:${node.id}:${emissao.port}:sig${launched.length}`,
          message: emissao.message,
          from: node.id,
          to: alvo.to,
          sent: tick,
          signalPort: alvo.toPort,
        });
      }

      // Leque é nativo: cada fio que sai desta porta leva uma cópia, com item
      // em trânsito próprio. `out:` já contou UMA emissão acima; quem conta o
      // espalhamento é o `in:` de cada destino.
      const destinos = resolveTargets(tree, spec.wires, node.id, emissao.port);
      if (destinos.length === 0) {
        // Sem fio de dado e sem descarte. Se havia sinal, não é buraco de
        // autoria: a porta é de controle e já entregou acima.
        if (alvosDeSinal.length === 0) {
          bump(`out:${node.id}.${emissao.port}.unwired`, 1);
        }
        continue;
      }
      for (const to of destinos) {
        launched.push({
          id: `${tick}:${node.id}:${emissao.port}:${launched.length}`,
          message: emissao.message,
          from: node.id,
          to,
          sent: tick,
        });
      }
    }
  }

  const substepOf: Record<string, number> = {};
  for (const [id, depth] of acomodado.depths) substepOf[id] = depth;

  return {
    tick,
    nodes,
    flight: [...stillFlying, ...launched],
    ledger,
    substeps: acomodado.substeps,
    substepOf,
  };
}
