import { initialWorld, stepWorld } from "./scheduler.js";
import { indexTree, visibleChild } from "./tree.js";
import type { TreeIndex } from "./tree.js";
import type { AnyObject, WorldSpec, WorldState } from "./model.js";

/**
 * Um atalho é uma promessa: "rodar isto dá o mesmo que rodar os filhos". Este
 * arquivo é o que cobra a promessa.
 *
 * O que se compara **não** é o interior — ele é diferente por construção, e é
 * essa a graça. Compara-se o que o mundo de fora enxerga: o estado e o
 * livro-caixa de quem está fora da subárvore. Ids de mensagem também ficam de
 * fora, porque os emissores são outros; exigir id igual reprovaria um atalho
 * correto, o que é tão ruim quanto aprovar um errado.
 */

/** O eixo e o objeto de uma chave do livro-caixa: "out:no.porta" -> "no". */
function noDaChave(chave: string): string | undefined {
  const doisPontos = chave.indexOf(":");
  if (doisPontos < 0) return undefined;
  const resto = chave.slice(doisPontos + 1);
  const ponto = resto.indexOf(".");
  return ponto < 0 ? resto : resto.slice(0, ponto);
}

export interface BoundaryProjection {
  readonly nodes: Readonly<Record<string, unknown>>;
  readonly ledger: Readonly<Record<string, number>>;
}

/** O que o mundo FORA de `id` enxerga deste estado. */
export function boundaryProjection(
  tree: TreeIndex,
  state: WorldState,
  id: string,
): BoundaryProjection {
  const foraDaSubarvore = (outro: string): boolean =>
    outro !== id && visibleChild(tree, id, outro).at === "outside";

  const nodes: Record<string, unknown> = {};
  for (const [no, valor] of Object.entries(state.nodes)) {
    if (foraDaSubarvore(no)) nodes[no] = valor;
  }

  const ledger: Record<string, number> = {};
  for (const [chave, valor] of Object.entries(state.ledger)) {
    const no = noDaChave(chave);
    if (no !== undefined && foraDaSubarvore(no)) ledger[chave] = valor;
  }

  return { nodes, ledger };
}

/** O mesmo objeto sem o atalho: é ele que roda a composição de verdade. */
function semAtalho(node: AnyObject, id: string): AnyObject {
  if (node.id === id) {
    const { shortcut: _ignorado, ...resto } = node;
    return resto;
  }
  if (node.children === undefined) return node;
  return { ...node, children: node.children.map((filho) => semAtalho(filho, id)) };
}

/**
 * Roda o mundo duas vezes — com o atalho e com a composição — e devolve a
 * primeira divergência de fronteira, ou `null` se os dois concordam.
 *
 * Devolve texto e não booleano de propósito: "discordam" manda o autor procurar;
 * dizer em que tick e em que chave é o que faz o teste servir para consertar.
 */
export function shortcutDisagreement(
  spec: WorldSpec,
  id: string,
  ticks: number,
  params: Readonly<Record<string, number>> = spec.params,
): string | null {
  const comAtalho = indexTree(spec.root, spec.channels);
  if (comAtalho.byId.get(id)?.shortcut === undefined) {
    return `"${id}" não declara shortcut: não há o que provar`;
  }
  const especCompleta: WorldSpec = { ...spec, root: semAtalho(spec.root, id) };
  const composto = indexTree(especCompleta.root, especCompleta.channels);

  let a = initialWorld(comAtalho);
  let b = initialWorld(composto);

  for (let tick = 1; tick <= ticks; tick += 1) {
    a = stepWorld(spec, comAtalho, a, params);
    b = stepWorld(especCompleta, composto, b, params);

    const va = boundaryProjection(comAtalho, a, id);
    const vb = boundaryProjection(composto, b, id);

    for (const [no, valor] of Object.entries(va.nodes)) {
      const outro = vb.nodes[no];
      if (JSON.stringify(valor) !== JSON.stringify(outro)) {
        return (
          `tick ${tick}: o estado de "${no}" difere — atalho ${JSON.stringify(valor)}, ` +
          `composição ${JSON.stringify(outro)}`
        );
      }
    }

    const chaves = new Set([...Object.keys(va.ledger), ...Object.keys(vb.ledger)]);
    for (const chave of chaves) {
      const x = va.ledger[chave] ?? 0;
      const y = vb.ledger[chave] ?? 0;
      if (x !== y) {
        return `tick ${tick}: "${chave}" vale ${x} com atalho e ${y} na composição`;
      }
    }
  }

  return null;
}
