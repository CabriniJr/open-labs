import { DROP } from "./model.js";
import type { InFlight, PortId, WorldState } from "./model.js";
import { visibleChild } from "./tree.js";
import type { TreeIndex } from "./tree.js";

/**
 * Um medidor é função pura sobre o tráfego de PORTA. Nunca espia o estado
 * interno de um objeto. É o que o mantém honesto: ele mede o que o leitor vê
 * acontecer, e por isso pode vir de graça junto com o arquétipo.
 *
 * A assinatura recebe `WorldState` e devolve número — não há caminho para
 * `state.nodes` a partir daqui.
 */
export function portCount(state: WorldState, node: string, port: PortId): number {
  return state.ledger[`${node}.${port}`] ?? 0;
}

export function portWeight(state: WorldState, node: string, port: PortId): number {
  return state.ledger[`${node}.${port}.weight`] ?? 0;
}

export interface Crossing {
  readonly item: InFlight;
  /** Filho do foco de onde a mensagem sai, o próprio foco, ou "outside". */
  readonly fromVisible: string;
  /** Filho do foco onde ela entra, o próprio foco, "outside", ou "@drop". */
  readonly toVisible: string;
}

/**
 * As mensagens que cruzam a fronteira de dois objetos visíveis a partir deste
 * foco. É isto que a vista agregada desenha — e é por isso que ela não precisa
 * ser autorada: o L0 é uma projeção do mesmo run que o interior mostra em
 * detalhe, e não tem como divergir dele.
 *
 * O filtro é por NOME resolvido, não pelo par de loci: origem e destino que
 * resolvem para o mesmo rótulo visível — os dois "outside", os dois dentro do
 * mesmo filho, ou (caso um objeto dinâmico rotule para si mesmo) os dois
 * "self" — não são travessia de fronteira nenhuma, são o mesmo lugar visto
 * duas vezes.
 */
export function boundaryCrossings(
  tree: TreeIndex,
  state: WorldState,
  focusId: string,
): Crossing[] {
  const name = (loc: ReturnType<typeof visibleChild> | { readonly at: "drop" }): string => {
    switch (loc.at) {
      case "child":
        return loc.id;
      case "self":
        return focusId;
      case "drop":
        return DROP;
      case "outside":
        return "outside";
    }
  };

  const out: Crossing[] = [];

  for (const item of state.flight) {
    const from = visibleChild(tree, focusId, item.from);
    const to = item.to === DROP ? ({ at: "drop" } as const) : visibleChild(tree, focusId, item.to);

    const fromVisible = name(from);
    const toVisible = name(to);
    // mesmo rótulo dos dois lados: não é fronteira, é o mesmo lugar visto de
    // dentro e de fora (inclui "outside"/"outside" e "child a"/"child a")
    if (fromVisible === toVisible) continue;

    out.push({ item, fromVisible, toVisible });
  }

  return out;
}
