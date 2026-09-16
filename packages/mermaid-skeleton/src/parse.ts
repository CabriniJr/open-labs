import { parse as parseYaml } from "yaml";
import type { Family, Kind, LineKind } from "@ovh/depth-core";
import type {
  NodeShape,
  ParseResult,
  Skeleton,
  SkeletonEdge,
  SkeletonNode,
  SkeletonSubgraph,
} from "./types.js";

/**
 * Um parser deliberadamente pequeno de um subconjunto do Mermaid.
 *
 * Só o que a §4 da spec `2026-09-16-mermaid-como-esqueleto-design.md` promete:
 * `flowchart LR|TB|RL|BT`, `subgraph`/`end`, `direction`, `classDef`, nós com
 * as sete formas mais comuns, e arestas sólidas/pontilhadas com rótulo entre
 * aspas. Se o autor escreveu Mermaid que este parser não reconhece, ele **fala
 * onde** — é a mesma escolha de `parseModelet` no `model-format`.
 *
 * Por que não `@mermaid-js/parser`? Porque a linguagem que a gente aceita é um
 * subconjunto pequeno e nomeado, e escrever o parser do zero é a maneira de
 * garantir que o subconjunto é preciso. Trocar por `@mermaid-js/parser` depois
 * é uma otimização; começar com ele é aceitar uma superfície maior do que a
 * gente sabe defender.
 */

const KINDS: readonly Kind[] = [
  "composite",
  "source",
  "router",
  "switch",
  "pipeline",
  "buffer",
  "store",
  "sink",
  "sequencer",
  "channel",
  "static",
];
const FAMILIES: readonly Family[] = ["container", "processor", "conduit", "controller", "plate"];

interface ClassDef {
  readonly kind: Kind | null;
  readonly family: Family | null;
}

interface Ctx {
  readonly errors: string[];
  readonly nodes: Map<string, MutNode>;
  readonly edges: SkeletonEdge[];
  readonly subgraphs: Map<string, MutSubgraph>;
  readonly classes: Map<string, ClassDef>;
  readonly subgraphStack: string[];
  /** Ordem de declaração dos filhos do grafo raiz. */
  readonly topLevel: string[];
  direction: Skeleton["direction"];
}

interface MutNode {
  id: string;
  label: string;
  shape: NodeShape;
  classes: string[];
  parent: string | null;
  /** Declarado explicitamente (com `id[label]`) ou nasceu implícito numa aresta? */
  explicit: boolean;
}

interface MutSubgraph {
  id: string;
  label: string;
  direction: SkeletonSubgraph["direction"];
  children: string[];
  parent: string | null;
}

export function parseSkeleton(source: string): ParseResult {
  const ctx: Ctx = {
    errors: [],
    nodes: new Map(),
    edges: [],
    subgraphs: new Map(),
    classes: new Map(),
    subgraphStack: [],
    topLevel: [],
    direction: "LR",
  };

  const { frontMatter, body } = splitFrontMatter(source, ctx);
  const lines = stripMermaidFence(body).split(/\r?\n/);

  let sawFlowchart = false;
  for (const [idx, raw] of lines.entries()) {
    const line = raw.trim();
    if (line === "" || line.startsWith("%%")) continue;

    if (!sawFlowchart) {
      const m = /^flowchart\s+(LR|TB|RL|BT|TD)\b/.exec(line);
      if (m) {
        ctx.direction = m[1] === "TD" ? "TB" : (m[1] as Skeleton["direction"]);
        sawFlowchart = true;
        continue;
      }
      // Antes do `flowchart` só se tolera comentário e linha vazia.
      ctx.errors.push(`linha ${idx + 1}: esperava "flowchart LR|TB|RL|BT", achei ${JSON.stringify(line)}`);
      continue;
    }

    if (line === "end") {
      const top = ctx.subgraphStack.pop();
      if (top === undefined) ctx.errors.push(`linha ${idx + 1}: "end" sem "subgraph" aberto`);
      continue;
    }

    const subM = /^subgraph\s+([A-Za-z_][A-Za-z0-9_-]*)(?:\s*\[([^\]]+)\]|\s*"([^"]+)")?\s*$/.exec(line);
    if (subM) {
      const [, id, bracketLabel, quotedLabel] = subM;
      openSubgraph(ctx, id, bracketLabel ?? quotedLabel ?? id);
      continue;
    }

    if (ctx.subgraphStack.length > 0) {
      const dirM = /^direction\s+(LR|TB|RL|BT|TD)\b/.exec(line);
      if (dirM) {
        const top = ctx.subgraphs.get(ctx.subgraphStack[ctx.subgraphStack.length - 1]!)!;
        top.direction = dirM[1] === "TD" ? "TB" : (dirM[1] as MutSubgraph["direction"]);
        continue;
      }
    }

    const classM = /^classDef\s+([A-Za-z_][A-Za-z0-9_-]*)\s+(.+)$/.exec(line);
    if (classM) {
      registerClassDef(ctx, classM[1]!, classM[2]!, idx + 1);
      continue;
    }

    // Aresta — precisa ser tentada antes de nó, porque uma linha de aresta contém
    // dois nós declarados como parte dela.
    if (tryEdge(ctx, line)) continue;

    // Nó solto: `id`, `id[label]`, `id([label])`, ..., opcionalmente com `:::class`.
    if (tryNodeDecl(ctx, line, idx + 1)) continue;

    ctx.errors.push(`linha ${idx + 1}: não reconheci ${JSON.stringify(line)}`);
  }

  if (!sawFlowchart) ctx.errors.push("faltou a diretiva flowchart");
  if (ctx.subgraphStack.length > 0) {
    ctx.errors.push(`subgraph aberto sem "end": ${ctx.subgraphStack.join(", ")}`);
  }

  if (ctx.errors.length > 0) return { ok: false, errors: ctx.errors };

  const front = frontMatter as Readonly<Record<string, unknown>>;
  const id = typeof front["id"] === "string" ? (front["id"] as string) : "";
  const title = typeof front["title"] === "string" ? (front["title"] as string) : id;
  if (id === "") {
    return { ok: false, errors: ["front-matter precisa declarar id"] };
  }

  const nodes: SkeletonNode[] = [];
  for (const n of ctx.nodes.values()) {
    const resolved = resolveClasses(ctx, n.classes);
    nodes.push({
      id: n.id,
      label: n.label,
      shape: n.shape,
      kind: resolved.kind,
      family: resolved.family,
      parent: n.parent,
      classes: [...n.classes],
    });
  }

  const subgraphs: SkeletonSubgraph[] = [];
  for (const g of ctx.subgraphs.values()) {
    subgraphs.push({
      id: g.id,
      label: g.label,
      direction: g.direction,
      children: [...g.children],
      parent: g.parent,
    });
  }

  return {
    ok: true,
    value: {
      id,
      title,
      direction: ctx.direction,
      nodes,
      edges: ctx.edges,
      subgraphs,
      topLevel: [...ctx.topLevel],
      frontMatter: front,
    },
  };
}

function splitFrontMatter(
  source: string,
  ctx: Ctx,
): { readonly frontMatter: unknown; readonly body: string } {
  const m = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/.exec(source);
  if (!m) return { frontMatter: {}, body: source };
  try {
    const parsed = parseYaml(m[1]!);
    if (parsed !== null && typeof parsed !== "object") {
      ctx.errors.push("front-matter precisa ser um mapa YAML");
      return { frontMatter: {}, body: m[2]! };
    }
    return { frontMatter: parsed ?? {}, body: m[2]! };
  } catch (err) {
    ctx.errors.push(`front-matter YAML inválido: ${(err as Error).message}`);
    return { frontMatter: {}, body: m[2]! };
  }
}

function stripMermaidFence(body: string): string {
  const m = /^```mermaid\s*\r?\n([\s\S]*?)\r?\n```\s*$/.exec(body.trim());
  return m ? m[1]! : body;
}

function openSubgraph(ctx: Ctx, id: string, label: string): void {
  if (ctx.subgraphs.has(id) || ctx.nodes.has(id)) {
    ctx.errors.push(`subgraph "${id}" colide com outro id já usado`);
    return;
  }
  const parent = ctx.subgraphStack[ctx.subgraphStack.length - 1] ?? null;
  ctx.subgraphs.set(id, { id, label, direction: null, children: [], parent });
  if (parent !== null) ctx.subgraphs.get(parent)!.children.push(id);
  else ctx.topLevel.push(id);
  ctx.subgraphStack.push(id);
}

function registerClassDef(ctx: Ctx, name: string, body: string, line: number): void {
  const props = new Map<string, string>();
  for (const part of body.split(",").map((s) => s.trim()).filter((s) => s !== "")) {
    const kv = /^([A-Za-z_-]+)\s*:\s*(.+)$/.exec(part);
    if (!kv) {
      ctx.errors.push(`linha ${line}: classDef "${name}" tem par malformado ${JSON.stringify(part)}`);
      continue;
    }
    props.set(kv[1]!, kv[2]!.trim());
  }
  const kindStr = props.get("kind");
  const familyStr = props.get("family");
  const kind = kindStr === undefined ? null : (KINDS.includes(kindStr as Kind) ? (kindStr as Kind) : (ctx.errors.push(`linha ${line}: kind "${kindStr}" não é do catálogo`), null));
  const family = familyStr === undefined ? null : (FAMILIES.includes(familyStr as Family) ? (familyStr as Family) : (ctx.errors.push(`linha ${line}: family "${familyStr}" não é do catálogo`), null));
  ctx.classes.set(name, { kind, family });
}

function resolveClasses(ctx: Ctx, classes: readonly string[]): ClassDef {
  let kind: Kind | null = null;
  let family: Family | null = null;
  for (const c of classes) {
    const def = ctx.classes.get(c);
    if (def === undefined) continue;
    if (def.kind !== null) kind = def.kind;
    if (def.family !== null) family = def.family;
  }
  return { kind, family };
}

/**
 * As sete formas do Mermaid, cada uma com o par de delimitadores que a fecha.
 * A ordem importa: `[[` casa antes de `[`, `([` antes de `(`, `[(` antes de `[`.
 */
const SHAPES: ReadonlyArray<{ open: string; close: string; shape: NodeShape }> = [
  { open: "[[", close: "]]", shape: "subroutine" },
  { open: "[(", close: ")]", shape: "cylinder" },
  { open: "([", close: "])", shape: "stadium" },
  { open: "((", close: "))", shape: "circle" },
  { open: "{{", close: "}}", shape: "hexagon" },
  { open: "[", close: "]", shape: "rect" },
  { open: "(", close: ")", shape: "round" },
  { open: "{", close: "}", shape: "rhombus" },
];

interface NodeMatch {
  readonly id: string;
  readonly label: string;
  readonly shape: NodeShape;
  readonly classes: readonly string[];
  readonly end: number;
}

/**
 * Tenta ler um nó começando em `line[start]`. Devolve o fim (índice depois do
 * último caractere do nó) ou `null` se aqui não é um nó.
 */
function matchNode(line: string, start: number): NodeMatch | null {
  const idMatch = /^([A-Za-z_][A-Za-z0-9_-]*)/.exec(line.slice(start));
  if (!idMatch) return null;
  const id = idMatch[1]!;
  let cursor = start + id.length;
  let label = id;
  let shape: NodeShape = "rect";

  for (const s of SHAPES) {
    if (line.startsWith(s.open, cursor)) {
      const bodyStart = cursor + s.open.length;
      const closeAt = line.indexOf(s.close, bodyStart);
      if (closeAt === -1) return null;
      let inner = line.slice(bodyStart, closeAt);
      // Rótulo entre aspas: `["Serviços"]`.
      const quoted = /^"([^"]*)"$/.exec(inner);
      if (quoted) inner = quoted[1]!;
      label = inner;
      shape = s.shape;
      cursor = closeAt + s.close.length;
      break;
    }
  }

  const classes: string[] = [];
  while (line.startsWith(":::", cursor)) {
    const rest = line.slice(cursor + 3);
    const cm = /^([A-Za-z_][A-Za-z0-9_-]*)/.exec(rest);
    if (!cm) break;
    classes.push(cm[1]!);
    cursor += 3 + cm[1]!.length;
  }

  return { id, label, shape, classes, end: cursor };
}

function tryNodeDecl(ctx: Ctx, line: string, lineNo: number): boolean {
  const m = matchNode(line, 0);
  if (!m || m.end !== line.length) return false;
  ensureNode(ctx, m.id, { label: m.label, shape: m.shape, classes: m.classes, explicit: true }, lineNo);
  return true;
}

interface NodeOverrides {
  readonly label?: string;
  readonly shape?: NodeShape;
  readonly classes?: readonly string[];
  readonly explicit?: boolean;
}

function ensureNode(ctx: Ctx, id: string, ov: NodeOverrides, lineNo: number): void {
  const existing = ctx.nodes.get(id);
  if (existing !== undefined) {
    if (ov.label !== undefined && ov.label !== id) existing.label = ov.label;
    if (ov.shape !== undefined && ov.shape !== "rect") existing.shape = ov.shape;
    if (ov.classes && ov.classes.length > 0) existing.classes = [...ov.classes];
    if (ov.explicit === true) existing.explicit = true;
    return;
  }
  if (ctx.subgraphs.has(id)) {
    ctx.errors.push(`linha ${lineNo}: id "${id}" já é subgraph`);
    return;
  }
  const parent = ctx.subgraphStack[ctx.subgraphStack.length - 1] ?? null;
  const node: MutNode = {
    id,
    label: ov.label ?? id,
    shape: ov.shape ?? "rect",
    classes: ov.classes ? [...ov.classes] : [],
    parent,
    explicit: ov.explicit ?? false,
  };
  ctx.nodes.set(id, node);
  if (parent !== null) ctx.subgraphs.get(parent)!.children.push(id);
  else ctx.topLevel.push(id);
}

interface EdgeSyntax {
  readonly stroke: "solid" | "dotted" | "thick";
  /** Regex do conector; grupo 1 é o rótulo, quando presente. */
  readonly pattern: RegExp;
}

/** As três pontes que a §4 admite. Cada uma com e sem rótulo. */
const EDGE_PATTERNS: readonly EdgeSyntax[] = [
  { stroke: "dotted", pattern: /^-\.\s*"([^"]*)"\s*\.->/ },
  { stroke: "dotted", pattern: /^-\.->/ },
  { stroke: "thick", pattern: /^==\s*"([^"]*)"\s*==>/ },
  { stroke: "thick", pattern: /^==>/ },
  { stroke: "solid", pattern: /^--\s*"([^"]*)"\s*-->/ },
  { stroke: "solid", pattern: /^-->/ },
];

function tryEdge(ctx: Ctx, line: string): boolean {
  const from = matchNode(line, 0);
  if (from === null) return false;
  // Pula espaços.
  let cursor = from.end;
  while (line[cursor] === " " || line[cursor] === "\t") cursor++;

  const slice = line.slice(cursor);
  let picked: EdgeSyntax | null = null;
  let label: string | null = null;
  let consumed = 0;
  for (const p of EDGE_PATTERNS) {
    const m = p.pattern.exec(slice);
    if (m) {
      picked = p;
      label = m[1] ?? null;
      consumed = m[0].length;
      break;
    }
  }
  if (picked === null) return false;
  cursor += consumed;
  while (line[cursor] === " " || line[cursor] === "\t") cursor++;

  const to = matchNode(line, cursor);
  if (to === null) return false;
  // Aresta bem-formada tem que consumir a linha inteira (ou só sobrar espaço).
  if (line.slice(to.end).trim() !== "") return false;

  ensureNode(ctx, from.id, { label: from.label, shape: from.shape, classes: from.classes }, 0);
  ensureNode(ctx, to.id, { label: to.label, shape: to.shape, classes: to.classes }, 0);

  const { line: lineKind, fromPort, toPort, messageKind } = interpretLabel(label);
  ctx.edges.push({
    from: from.id,
    to: to.id,
    label,
    stroke: picked.stroke,
    line: lineKind,
    fromPort,
    toPort,
    messageKind,
  });
  return true;
}

function interpretLabel(label: string | null): {
  readonly line: LineKind;
  readonly fromPort: string | null;
  readonly toPort: string | null;
  readonly messageKind: string | null;
} {
  if (label === null || label === "") {
    return { line: "data", fromPort: null, toPort: null, messageKind: null };
  }
  const idx = label.indexOf(":");
  if (idx === -1) return { line: "data", fromPort: null, toPort: null, messageKind: label };
  const prefix = label.slice(0, idx);
  const suffix = label.slice(idx + 1);
  if (prefix === "control") {
    return { line: "control", fromPort: null, toPort: null, messageKind: suffix === "" ? null : suffix };
  }
  // Convenção da §4.3: `porta:kind`. Uma porta nomeada na origem, a de destino
  // fica padrão até um lab pedir mais.
  return { line: "data", fromPort: prefix, toPort: null, messageKind: suffix === "" ? null : suffix };
}
