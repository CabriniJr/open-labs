// packages/depth-core/src/settle-graph.ts
import { DROP } from "./model.js";
import type { Wire } from "./model.js";

/**
 * O subgrafo de acomodação — as arestas que entregam dentro do próprio tick.
 *
 * Vive separado de quem executa porque é raciocínio de grafo puro: dá para
 * testá-lo sem mundo, sem estado e sem mensagem, e `validateWorld` precisa da
 * detecção de ciclo sem precisar da execução.
 *
 * A garantia que sustenta tudo: como `validateWorld` recusa laço combinacional,
 * este grafo é um DAG. Um DAG se percorre em ordem topológica, e aí cada ator
 * roda **uma vez só**, com o conjunto completo das entradas dele. Não há
 * iteração, não há teto de rodadas, e a ordem de visita não pode influir.
 */

export interface SettleNode {
  readonly id: string;
  /**
   * Quantas arestas de acomodação, no caminho mais longo, é preciso atravessar
   * até chegar aqui. **É o atraso de propagação**: o valor de um nó só está
   * pronto quando o mais lento dos caminhos que o alimentam chegou. Vira o
   * número de subpassos que a tela mostra dentro do tick.
   */
  readonly depth: number;
}

interface Aresta {
  readonly from: string;
  readonly to: string;
}

function settleEdges(wires: readonly Wire[]): Aresta[] {
  const out: Aresta[] = [];
  for (const wire of wires) {
    if ((wire.timing ?? "clocked") !== "settle") continue;
    // O descarte não continua para lugar nenhum, então não é aresta do grafo.
    if (wire.to === DROP) continue;
    out.push({ from: wire.from, to: wire.to });
  }
  return out;
}

function adjacencia(edges: readonly Aresta[]): {
  nodes: Set<string>;
  saida: Map<string, string[]>;
} {
  const nodes = new Set<string>();
  const saida = new Map<string, string[]>();
  for (const { from, to } of edges) {
    nodes.add(from);
    nodes.add(to);
    const lista = saida.get(from) ?? [];
    lista.push(to);
    saida.set(from, lista);
  }
  return { nodes, saida };
}

/**
 * Os objetos que participam da acomodação, em ordem topológica e com a
 * profundidade de cada um. Objeto sem nenhuma aresta acomodada não aparece —
 * ele só existe na fase de confronto, como sempre existiu.
 *
 * Lança se houver ciclo. Não deveria acontecer, porque `validateWorld` recusa o
 * mundo antes; se acontecer, é bug do motor e não de quem escreveu o modelo, e
 * a mensagem diz isso.
 */
export function settleOrder(wires: readonly Wire[]): readonly SettleNode[] {
  const edges = settleEdges(wires);
  const { nodes, saida } = adjacencia(edges);

  const grau = new Map<string, number>();
  for (const id of nodes) grau.set(id, 0);
  for (const { to } of edges) grau.set(to, (grau.get(to) ?? 0) + 1);

  // Kahn, com a profundidade subindo junto: cada nó recebe o máximo entre as
  // profundidades de quem o alimenta, mais um.
  const profundidade = new Map<string, number>();
  const fila: string[] = [];
  for (const id of nodes) {
    if (grau.get(id) === 0) {
      fila.push(id);
      profundidade.set(id, 0);
    }
  }

  const ordem: SettleNode[] = [];
  while (fila.length > 0) {
    const id = fila.shift()!;
    const aqui = profundidade.get(id) ?? 0;
    ordem.push({ id, depth: aqui });
    for (const destino of saida.get(id) ?? []) {
      profundidade.set(destino, Math.max(profundidade.get(destino) ?? 0, aqui + 1));
      const resta = (grau.get(destino) ?? 0) - 1;
      grau.set(destino, resta);
      if (resta === 0) fila.push(destino);
    }
  }

  if (ordem.length !== nodes.size) {
    const ciclo = findCombinationalCycle(wires);
    throw new Error(
      `settle-graph: laço combinacional${ciclo === null ? "" : ` em ${ciclo.join(" -> ")}`} — ` +
        `validateWorld deveria ter recusado este mundo`,
    );
  }

  return ordem;
}

/**
 * O caminho de um ciclo no subgrafo de acomodação, ou `null` se não houver.
 * Devolve o caminho fechado (o primeiro id reaparece no fim) para a mensagem de
 * erro poder mostrar a volta inteira — dizer só "há um laço" obriga o autor a
 * procurar.
 */
export function findCombinationalCycle(wires: readonly Wire[]): readonly string[] | null {
  const { nodes, saida } = adjacencia(settleEdges(wires));

  const VISITANDO = 1;
  const PRONTO = 2;
  const estado = new Map<string, number>();
  const pilha: string[] = [];

  const desce = (id: string): readonly string[] | null => {
    estado.set(id, VISITANDO);
    pilha.push(id);
    for (const destino of saida.get(id) ?? []) {
      const marca = estado.get(destino);
      if (marca === VISITANDO) {
        const inicio = pilha.indexOf(destino);
        return [...pilha.slice(inicio), destino];
      }
      if (marca === undefined) {
        const achado = desce(destino);
        if (achado !== null) return achado;
      }
    }
    pilha.pop();
    estado.set(id, PRONTO);
    return null;
  };

  for (const id of nodes) {
    if (estado.has(id)) continue;
    const achado = desce(id);
    if (achado !== null) return achado;
  }
  return null;
}
