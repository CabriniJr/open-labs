import { familyOf } from "./model.js";
import type { AnyObject, Locus } from "./model.js";

export interface TreeIndex {
  readonly byId: ReadonlyMap<string, AnyObject>;
  readonly parent: ReadonlyMap<string, string>;
  readonly rootId: string;
}

export function indexTree(
  root: AnyObject,
  channels: readonly AnyObject[] = [],
): TreeIndex {
  const byId = new Map<string, AnyObject>();
  const parent = new Map<string, string>();

  const walk = (node: AnyObject): void => {
    if (byId.has(node.id)) {
      throw new Error(`tree: id duplicado "${node.id}"`);
    }
    // O livro-caixa monta as chaves dele juntando eixo, id e porta com ":" e
    // ".". Um id que carregue um desses caracteres escreveria no balde de
    // outro, e a contagem perdida não daria erro nenhum.
    if (node.id.includes(".") || node.id.includes(":")) {
      throw new Error(
        `tree: o id "${node.id}" usa "." ou ":", que separam campos no ` +
          `livro-caixa — escolha um id sem esses caracteres.`,
      );
    }
    byId.set(node.id, node);
    if (node.behavior !== undefined && familyOf(node.kind) === "plate") {
      throw new Error(
        `tree: "${node.id}" é placa e tem behavior — placa é consultada, nunca ` +
          `atravessada. Troque o kind ou remova o behavior.`,
      );
    }
    if (node.behavior !== undefined && node.leaf !== true && node.dynamic !== true) {
      const flow = (node.children ?? []).filter((c) => familyOf(c.kind) !== "plate");
      if (flow.length > 0) {
        throw new Error(
          `tree: "${node.id}" é composto e tem behavior — o que um composto faz ` +
            `é o resultado de rodar os filhos. Marque leaf: true ou remova o behavior.`,
        );
      }
    }
    // A fronteira declarada é validada aqui, e não em quem percorre: assim
    // nenhum TreeIndex chega a existir com uma fronteira que aponta para fora.
    const flowIds = (node.children ?? [])
      .filter((c) => familyOf(c.kind) !== "plate")
      .map((c) => c.id);
    for (const [campo, declarado] of [
      ["entry", node.entry],
      ["exit", node.exit],
    ] as const) {
      if (declarado === undefined) continue;
      if (!flowIds.includes(declarado)) {
        throw new Error(
          `tree: "${node.id}" declara ${campo}: "${declarado}", que não é filho de ` +
            `fluxo dele — a fronteira de um contêiner mora dentro dele. ` +
            `Filhos de fluxo: ${flowIds.length > 0 ? flowIds.join(", ") : "nenhum"}.`,
        );
      }
    }
    for (const child of node.children ?? []) {
      parent.set(child.id, node.id);
      walk(child);
    }
  };

  walk(root);
  for (const channel of channels) walk(channel);

  return { byId, parent, rootId: root.id };
}

function spec(tree: TreeIndex, id: string): AnyObject {
  const node = tree.byId.get(id);
  if (node === undefined) throw new Error(`tree: objeto desconhecido "${id}"`);
  return node;
}

/**
 * Um objeto é abrível se os filhos dele trocam mensagens que dá para ver — ou
 * se o interior dele É o conteúdo (`dynamic`). `leaf` é a válvula do autor.
 */
export function isOpenable(tree: TreeIndex, id: string): boolean {
  const node = spec(tree, id);
  if (node.leaf === true) return false;
  if (node.dynamic === true) return true;
  // filhos que só são consultados não constituem tráfego para ver
  return flowChildren(tree, id).length > 0;
}

/** Filhos que participam do fluxo. Estático é consultado, não atravessado. */
export function flowChildren(tree: TreeIndex, id: string): string[] {
  return (spec(tree, id).children ?? [])
    .filter((c) => familyOf(c.kind) !== "plate")
    .map((c) => c.id);
}

function terminal(tree: TreeIndex, id: string, pick: "first" | "last"): string {
  const node = spec(tree, id);
  // um objeto que não abre É a folha: leaf, dynamic (conteúdo de runtime) ou
  // contêiner sem tráfego para ver. O mesmo predicado dos dois lados garante
  // que quem desenha e quem percorre nunca discordem sobre o mesmo nó.
  // Um contêiner com atalho é folha para a fiação e abrível para quem lê: são
  // perguntas diferentes. Quem entrega uma mensagem para dentro dele entrega a
  // ELE, porque é ele que age.
  if (node.shortcut !== undefined) return id;
  if (node.leaf === true || node.dynamic === true || !isOpenable(tree, id)) return id;

  const declared = pick === "first" ? node.entry : node.exit;
  // indexTree já garantiu que `declared` é filho de fluxo deste nó
  if (declared !== undefined) return terminal(tree, declared, pick);

  const kids = flowChildren(tree, id);
  const next = pick === "first" ? kids[0] : kids[kids.length - 1];
  // abrível implica ao menos um filho de fluxo; o ramo `undefined` é
  // inalcançável, existe só porque o índice não prova isso ao compilador
  return next === undefined ? id : terminal(tree, next, pick);
}

export function entryLeaf(tree: TreeIndex, id: string): string {
  return terminal(tree, id, "first");
}

export function exitLeaf(tree: TreeIndex, id: string): string {
  return terminal(tree, id, "last");
}

/**
 * O contêiner com atalho mais próximo acima deste objeto, se houver.
 *
 * É o que exclui a subárvore de um atalho da execução: rodar os filhos *e* o
 * atalho contaria tudo duas vezes, e nada acusaria.
 */
export function shortcutOwner(tree: TreeIndex, id: string): string | undefined {
  let cursor = tree.parent.get(id);
  while (cursor !== undefined) {
    if (tree.byId.get(cursor)?.shortcut !== undefined) return cursor;
    cursor = tree.parent.get(cursor);
  }
  return undefined;
}

/**
 * Qual filho do foco contém esta folha, ou se ela é o próprio foco, ou se está
 * fora da subárvore dele.
 *
 * É esta função que faz a vista agregada existir sem ser autorada.
 */
export function visibleChild(
  tree: TreeIndex,
  focusId: string,
  leafId: string,
): Locus {
  spec(tree, focusId);
  spec(tree, leafId);
  if (leafId === focusId) return { at: "self" };
  let cursor: string | undefined = leafId;
  // `parent` vem sempre de indexTree, que rejeita id duplicado e por isso não
  // produz ciclo. Um TreeIndex montado à mão é responsabilidade de quem monta.
  while (cursor !== undefined) {
    const up: string | undefined = tree.parent.get(cursor);
    if (up === focusId) return { at: "child", id: cursor };
    cursor = up;
  }
  return { at: "outside" };
}
