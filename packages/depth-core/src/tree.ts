import type { AnyObject, Locus, ObjectSpec } from "./model.js";

export interface TreeIndex {
  readonly byId: ReadonlyMap<string, ObjectSpec>;
  readonly parent: ReadonlyMap<string, string>;
  readonly rootId: string;
}

export function indexTree(
  root: AnyObject,
  channels: readonly AnyObject[] = [],
): TreeIndex {
  const byId = new Map<string, ObjectSpec>();
  const parent = new Map<string, string>();

  const walk = (node: AnyObject): void => {
    if (byId.has(node.id)) {
      throw new Error(`tree: id duplicado "${node.id}"`);
    }
    byId.set(node.id, node);
    if (node.behavior !== undefined && node.leaf !== true && node.dynamic !== true) {
      const flow = (node.children ?? []).filter((c) => c.kind !== "static");
      if (flow.length > 0) {
        throw new Error(
          `tree: "${node.id}" é composto e tem behavior — o que um composto faz ` +
            `é o resultado de rodar os filhos. Marque leaf: true ou remova o behavior.`,
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

function spec(tree: TreeIndex, id: string): ObjectSpec {
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
    .filter((c) => c.kind !== "static")
    .map((c) => c.id);
}

function terminal(tree: TreeIndex, id: string, pick: "first" | "last"): string {
  const node = spec(tree, id);
  if (node.leaf === true || node.dynamic === true) return id;
  if ((node.children?.length ?? 0) === 0) return id;

  const declared = pick === "first" ? node.entry : node.exit;
  if (declared !== undefined) {
    spec(tree, declared);
    return terminal(tree, declared, pick);
  }

  const kids = flowChildren(tree, id);
  const next = pick === "first" ? kids[0] : kids[kids.length - 1];
  if (next === undefined) {
    throw new Error(
      `tree: "${id}" tem filhos, mas nenhum de fluxo — só objetos consultados`,
    );
  }
  return terminal(tree, next, pick);
}

export function entryLeaf(tree: TreeIndex, id: string): string {
  return terminal(tree, id, "first");
}

export function exitLeaf(tree: TreeIndex, id: string): string {
  return terminal(tree, id, "last");
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
