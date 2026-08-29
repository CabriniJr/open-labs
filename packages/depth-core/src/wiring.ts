import { DROP } from "./model.js";
import type { Drop, PortId, Wire } from "./model.js";
import { entryLeaf, flowChildren } from "./tree.js";
import type { TreeIndex } from "./tree.js";

/**
 * Para onde vai o que sai de `(from, port)` — **todos** os destinos.
 *
 * Leque é nativo: `n` fios saindo da mesma porta entregam `n` cópias, cada uma
 * um item em trânsito com id próprio. `out:` conta uma emissão e cada destino
 * conta o seu `in:`; as duas contagens divergirem é o esperado, e é informação
 * — é quanto a saída se espalhou.
 *
 * Um fio declarado vence. Sem fio, o arquétipo decide: num `pipeline`, a saída
 * de um filho é a entrada do próximo — é isso que torna "a ordem importa" um
 * fato do modelo em vez de uma frase no texto. Esgotado o pipeline, a busca
 * sobe para o fio do pai.
 *
 * Linhas de controle são invisíveis daqui de propósito: elas carregam sinal, não
 * carga, e misturar as duas faria a pergunta "por onde a carga passa?" deixar de
 * ter resposta olhando o desenho.
 *
 * A subida usa `tree.parent`, que só existe por construção de `indexTree`
 * (sem ciclos): a cada chamada `from` sobe um nível, então a recursão termina
 * — no pior caso na raiz, onde `parent` é `undefined` e devolve `null` antes
 * de tentar subir mais, sem estourar a pilha.
 */
export function resolveTargets(
  tree: TreeIndex,
  wires: readonly Wire[],
  from: string,
  port: PortId,
): readonly (string | Drop)[] {
  const declarados: (string | Drop)[] = [];
  for (const wire of wires) {
    if ((wire.line ?? "data") !== "data") continue;
    if (wire.from !== from || wire.port !== port) continue;
    declarados.push(wire.to === DROP ? DROP : entryLeaf(tree, wire.to));
  }
  // Fio declarado vence: havendo qualquer um, o arquétipo não opina.
  if (declarados.length > 0) return declarados;

  const parent = tree.parent.get(from);
  if (parent === undefined) return [];

  if (tree.byId.get(parent)?.kind === "pipeline") {
    const kids = flowChildren(tree, parent);
    const here = kids.indexOf(from);
    const next = here >= 0 ? kids[here + 1] : undefined;
    if (next !== undefined) return [entryLeaf(tree, next)];
  }

  return resolveTargets(tree, wires, parent, "out");
}

/**
 * O primeiro destino, para quem só precisa saber se há caminho. Definido em
 * cima de `resolveTargets` de propósito: dois percursos independentes para a
 * mesma pergunta divergiriam no dia em que um deles mudasse.
 */
export function resolveTarget(
  tree: TreeIndex,
  wires: readonly Wire[],
  from: string,
  port: PortId,
): string | Drop | null {
  return resolveTargets(tree, wires, from, port)[0] ?? null;
}

/** Para onde vai um sinal que sai de `(from, port)`, e em que porta ele chega. */
export interface SignalTarget {
  readonly to: string;
  readonly toPort: PortId;
}

/**
 * Sinal em leque é a regra, não a exceção: um controle aciona vários. Por isso
 * esta devolve uma lista, ao contrário de `resolveTarget`, que percorre carga e
 * onde leque de dado é recusado na validação.
 *
 * Sinal também não atravessa contêiner nem sobe para o pai: o destinatário é
 * nomeado, e `validateWorld` já garantiu que ele age.
 */
export function resolveSignalTargets(
  wires: readonly Wire[],
  from: string,
  port: PortId,
): readonly SignalTarget[] {
  const out: SignalTarget[] = [];
  for (const wire of wires) {
    if ((wire.line ?? "data") !== "control") continue;
    if (wire.from !== from || wire.port !== port) continue;
    if (wire.to === DROP || wire.toPort === undefined) continue;
    out.push({ to: wire.to, toPort: wire.toPort });
  }
  return out;
}

/**
 * Abre os fios que entram por porta nomeada.
 *
 * Um fio para `bloco` na entrada `a` vira os fios concretos até quem, lá
 * dentro, recebe por `a` — ou um fio para o próprio bloco, quando ele tem
 * atalho e portanto é ele que age. Vale para carga e para sinal: uma linha de
 * controle que chega num bloco fechado precisa achar, lá dentro, quem obedece. Rodar essa conversão **uma vez, na entrada
 * do tick**, é o que faz o resto do motor (ordem topológica, acomodação,
 * livro-caixa) continuar vendo só fios entre coisas que agem.
 *
 * É a diferença entre um contêiner ser uma caixa fechada e ser uma caixa com
 * bornes: sem isto, um objeto com três entradas distintas não poderia ser
 * atalhado nem aberto sem trocar a fiação, e essa troca é justamente onde
 * apareceria uma diferença que ninguém veria.
 */
export function expandPorts(tree: TreeIndex, wires: readonly Wire[]): readonly Wire[] {
  return expandSaidas(tree, expandEntradas(tree, wires));
}

/** Bornes de saída: o fio parte de quem, lá dentro, emite por aquela porta. */
function expandSaidas(tree: TreeIndex, wires: readonly Wire[]): readonly Wire[] {
  const saida: Wire[] = [];
  let mudou = false;
  for (const wire of wires) {
    const origem = tree.byId.get(wire.from);
    const dentro = origem?.outlets?.[wire.port];
    // Com atalho, quem emite é o próprio contêiner: o fio fica como está.
    if (dentro === undefined || origem?.shortcut !== undefined) {
      saida.push(wire);
      continue;
    }
    mudou = true;
    for (const filho of dentro) saida.push({ ...wire, from: filho });
  }
  return mudou ? saida : wires;
}

function expandEntradas(tree: TreeIndex, wires: readonly Wire[]): readonly Wire[] {
  const precisa = wires.some((w) => w.toPort !== undefined);
  if (!precisa) return wires;

  const saida: Wire[] = [];
  for (const wire of wires) {
    const porta = wire.toPort;
    if (porta === undefined || wire.to === DROP) {
      saida.push(wire);
      continue;
    }
    const destino = tree.byId.get(wire.to);
    // Com atalho, quem age é o contêiner: a carga para NELE, com a marca da
    // entrada por onde chegou, senão o atalho não saberia qual parcela é qual.
    if (destino?.shortcut !== undefined) {
      saida.push(wire);
      continue;
    }
    const dentro = destino?.inlets?.[porta];
    // Sem borne declarado, o destino é quem age: o fio fica como está. É o caso
    // de toda linha de controle que chega direto numa folha.
    if (dentro === undefined) {
      saida.push(wire);
      continue;
    }
    for (const filho of dentro) {
      saida.push({ ...wire, to: entryLeaf(tree, filho) });
    }
  }
  return saida;
}
