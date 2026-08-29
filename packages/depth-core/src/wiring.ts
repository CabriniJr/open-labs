import { DROP } from "./model.js";
import type { Drop, PortId, Wire } from "./model.js";
import { entryLeaf, flowChildren } from "./tree.js";
import type { TreeIndex } from "./tree.js";

/**
 * Para onde vai o que sai de `(from, port)`.
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
export function resolveTarget(
  tree: TreeIndex,
  wires: readonly Wire[],
  from: string,
  port: PortId,
): string | Drop | null {
  for (const wire of wires) {
    if ((wire.line ?? "data") !== "data") continue;
    if (wire.from === from && wire.port === port) {
      return wire.to === DROP ? DROP : entryLeaf(tree, wire.to);
    }
  }

  const parent = tree.parent.get(from);
  if (parent === undefined) return null;

  if (tree.byId.get(parent)?.kind === "pipeline") {
    const kids = flowChildren(tree, parent);
    const here = kids.indexOf(from);
    const next = here >= 0 ? kids[here + 1] : undefined;
    if (next !== undefined) return entryLeaf(tree, next);
  }

  return resolveTarget(tree, wires, parent, "out");
}
