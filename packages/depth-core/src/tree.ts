import type { ObjectSpec } from "./model.js";

export interface TreeIndex {
  readonly byId: ReadonlyMap<string, ObjectSpec>;
  readonly parent: ReadonlyMap<string, string>;
  readonly rootId: string;
}

export function indexTree(root: ObjectSpec): TreeIndex {
  const byId = new Map<string, ObjectSpec>();
  const parent = new Map<string, string>();

  const walk = (node: ObjectSpec): void => {
    if (byId.has(node.id)) {
      throw new Error(`tree: id duplicado "${node.id}"`);
    }
    byId.set(node.id, node);
    for (const child of node.children ?? []) {
      parent.set(child.id, node.id);
      walk(child);
    }
  };
  walk(root);

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
  return (node.children?.length ?? 0) > 0;
}

/** Filhos que participam do fluxo. Estático é consultado, não atravessado. */
export function flowChildren(tree: TreeIndex, id: string): string[] {
  return (spec(tree, id).children ?? [])
    .filter((c) => c.kind !== "static")
    .map((c) => c.id);
}

function terminal(tree: TreeIndex, id: string, pick: "first" | "last"): string {
  const node = spec(tree, id);
  if (node.leaf === true || (node.children?.length ?? 0) === 0) return id;
  const kids = flowChildren(tree, id);
  const next = pick === "first" ? kids[0] : kids[kids.length - 1];
  if (next === undefined) {
    throw new Error(`tree: "${id}" não tem filho de fluxo`);
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
 * Qual filho do foco contém esta folha. `null` = é o próprio foco;
 * `"outside"` = está fora da subárvore do foco.
 *
 * É esta função que faz a vista agregada existir sem ser autorada.
 */
export function visibleChild(
  tree: TreeIndex,
  focusId: string,
  leafId: string,
): string | null | "outside" {
  if (leafId === focusId) return null;
  let cursor: string | undefined = leafId;
  while (cursor !== undefined) {
    const up: string | undefined = tree.parent.get(cursor);
    if (up === focusId) return cursor;
    cursor = up;
  }
  return "outside";
}
