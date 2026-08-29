import { familyOf, flowChildren, visibleChild } from "@ovh/depth-core";
import type { Family, TreeIndex } from "@ovh/depth-core";

/**
 * Uma **view** é a disposição inicial dos objetos para um foco: onde cada um
 * fica e de que tamanho é desenhado.
 *
 * O invariante, e é ele que impede a view de mentir:
 *
 * > Uma view decide **onde** e **como**, nunca **o que existe** nem **o que se
 * > liga a quê**.
 *
 * O que existe vem da árvore; o que se liga a quê vem dos fios. Por isso o
 * teste não é "parece certo", é **igualdade**: a view não pode inventar um
 * objeto que a árvore não tem, e não pode esconder um que ela tem — esconder só
 * vale declarando `collapsed`, que diz "os filhos existem e não estão
 * desenhados agora".
 *
 * Sem essa regra, um desenho bonito viraria a fonte da verdade, e o leitor
 * estudaria um sistema que não é o que roda.
 */

export interface NodePlacement {
  readonly id: string;
  /** Canto superior esquerdo, no espaço de coordenadas da view. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /**
   * Desenhado fechado: os filhos existem e não aparecem agora. É a única forma
   * legítima de um objeto com interior não mostrar o interior.
   */
  readonly collapsed?: true;
  /** Marca de canto — o que o modelo quiser dizer em dois glifos. */
  readonly badge?: string;
  /** Sobrescreve o rótulo da árvore quando o desenho pede um nome mais curto. */
  readonly label?: string;
}

export interface View {
  readonly id: string;
  /** O objeto que esta view enquadra. Tudo o que ela posiciona vive dentro dele. */
  readonly focus: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly places: readonly NodePlacement[];
}

/**
 * A primeira discordância entre a view e a árvore, ou `null`.
 *
 * Devolve texto e não booleano de propósito: "a view está errada" manda
 * procurar; dizer qual objeto sobrou ou faltou é o que faz o teste servir para
 * consertar.
 */
export function viewDisagreement(tree: TreeIndex, view: View): string | null {
  if (!tree.byId.has(view.focus)) {
    return `a view enquadra "${view.focus}", que não existe na árvore`;
  }

  const colocados = new Map<string, NodePlacement>();
  for (const place of view.places) {
    if (colocados.has(place.id)) {
      return `"${place.id}" aparece duas vezes na view: dois lugares para o mesmo objeto`;
    }
    colocados.set(place.id, place);

    if (!tree.byId.has(place.id)) {
      return `a view desenha "${place.id}", que não existe na árvore — view não inventa objeto`;
    }
    if (place.id !== view.focus && visibleChild(tree, view.focus, place.id).at === "outside") {
      return `a view desenha "${place.id}", que está fora de "${view.focus}"`;
    }
    if (place.w <= 0 || place.h <= 0) {
      return `"${place.id}" tem tamanho ${place.w}×${place.h}: um objeto de área zero é um objeto escondido sem dizer`;
    }
    if (place.x < 0 || place.y < 0 || place.x + place.w > view.width || place.y + place.h > view.height) {
      return `"${place.id}" sai da moldura da view (${view.width}×${view.height}): ficaria cortado, que é esconder pela metade`;
    }
  }

  // Não esconde: os filhos de fluxo de todo objeto desenhado aberto precisam
  // estar desenhados também. O foco conta como aberto — é ele que a view abre.
  const paraConferir = [view.focus, ...view.places.filter((p) => p.collapsed !== true).map((p) => p.id)];
  for (const id of paraConferir) {
    if (id !== view.focus && colocados.get(id)?.collapsed === true) continue;
    for (const filho of flowChildren(tree, id)) {
      if (!colocados.has(filho)) {
        return (
          `"${filho}" existe dentro de "${id}" e a view não o desenha — ` +
          `para não desenhar o interior, marque "${id}" como collapsed, que diz ` +
          `em voz alta que há mais lá dentro`
        );
      }
    }
  }

  return null;
}

/** A família de cada objeto desenhado. É ela que escolhe a forma e a animação. */
export function familiesOf(tree: TreeIndex, view: View): Readonly<Record<string, Family>> {
  const out: Record<string, Family> = {};
  for (const place of view.places) {
    const node = tree.byId.get(place.id);
    if (node !== undefined) out[place.id] = familyOf(node.kind);
  }
  return out;
}

/**
 * A primeira discordância entre uma caixa e o interior desenhado dentro dela,
 * ou `null`.
 *
 * O zoom contínuo desenha o interior de um objeto **dentro da caixa dele**, e
 * isso é uma afirmação estrutural: dizer que o que está ali dentro mora ali. Um
 * desenho que pusesse na caixa `x` a view focada em `y` estaria inventando uma
 * hierarquia — e seria justamente um desenho bonito afirmando o que o modelo
 * não disse.
 *
 * Vale junto com `viewDisagreement`, não no lugar dele: o interior continua
 * tendo que concordar com a árvore.
 */
export function interiorDisagreement(
  tree: TreeIndex,
  place: NodePlacement,
  interior: View,
): string | null {
  if (interior.focus !== place.id) {
    return `a caixa "${place.id}" mostra por dentro a view de "${interior.focus}" — desenhar um interior é dizer que ele mora ali`;
  }
  if (place.collapsed !== true) {
    return `"${place.id}" está desenhada aberta e ainda recebe um interior: os filhos apareceriam duas vezes`;
  }
  if ((tree.byId.get(place.id)?.children ?? []).length === 0) {
    return `"${place.id}" não tem filhos e recebe um interior: seria um dentro que a árvore não tem`;
  }
  return viewDisagreement(tree, interior);
}
