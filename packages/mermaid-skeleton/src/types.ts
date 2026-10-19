import type { Kind, Family, LineKind } from "@ovh/depth-core";

/**
 * O esqueleto do cenário depois de ler um `.mmd`.
 *
 * É de propósito **menos rico** que um `WorldSpec`: aqui vive só estrutura e
 * relações — nós, canais, subgrafos. Comportamento e estado ficam para o
 * runtime, que combina este esqueleto com os `behaviors` de cada `kind`
 * (`docs/superpowers/specs/2026-09-16-mermaid-como-esqueleto-design.md` §3).
 */
export interface Skeleton {
  readonly id: string;
  readonly title: string;
  /** Direção do layout como declarada no `flowchart LR`/`TB`. */
  readonly direction: "LR" | "TB" | "RL" | "BT";
  readonly nodes: readonly SkeletonNode[];
  readonly edges: readonly SkeletonEdge[];
  readonly subgraphs: readonly SkeletonSubgraph[];
  /**
   * Ids dos filhos diretos do grafo, na ordem em que foram declarados no
   * Mermaid. Mistura nós e subgrafos — o motor precisa dessa ordem para pôr o
   * `mid` entre `gen` e `out`, e não depois dos dois, quando a ordem no texto
   * é essa.
   */
  readonly topLevel: readonly string[];
  /** Tudo que sobrou do front-matter YAML, sem interpretação nossa. */
  readonly frontMatter: Readonly<Record<string, unknown>>;
}

export interface SkeletonNode {
  readonly id: string;
  readonly label: string;
  /** A forma do nó no Mermaid original — `rect`, `stadium`, `cylinder`, etc. */
  readonly shape: NodeShape;
  /** O `kind` do catálogo do motor, resolvido via `classDef`. */
  readonly kind: Kind | null;
  /** A família do catálogo, resolvida via `classDef`. */
  readonly family: Family | null;
  /** O nome do subgrafo dono, se houver. */
  readonly parent: string | null;
  /** Classes CSS aplicadas com `:::`. */
  readonly classes: readonly string[];
}

export type NodeShape =
  | "rect"        // [rect]
  | "round"       // (round)
  | "stadium"     // ([stadium])
  | "subroutine"  // [[subroutine]]
  | "cylinder"    // [(cylinder)]
  | "circle"      // ((circle))
  | "rhombus"     // {rhombus}
  | "hexagon";    // {{hexagon}}

export interface SkeletonEdge {
  readonly from: string;
  readonly to: string;
  /** Rótulo bruto do Mermaid (`"req"`, `"control:tick"`, `"req:pago"`). */
  readonly label: string | null;
  /** Traço no SVG. `solid` para `-->`, `dotted` para `-. .->`, `thick` para `==>`. */
  readonly stroke: "solid" | "dotted" | "thick";
  /**
   * Semântica: `data` ou `control`. Vem do prefixo `control:` no rótulo, e
   * **não** do traço (§Nota 1 do exemplo). Um rótulo `null` ou sem prefixo é
   * `data`. É a decisão que separa ênfase visual de semântica.
   */
  readonly line: LineKind;
  /** Nome da porta na origem, se o rótulo tem prefixo (`out:span` → `out`). */
  readonly fromPort: string | null;
  /** Nome da porta no destino — hoje sempre a padrão; espaço para o futuro. */
  readonly toPort: string | null;
  /** O `kind` da mensagem, extraído do rótulo depois do `:`. `null` se sem rótulo. */
  readonly messageKind: string | null;
}

export interface SkeletonSubgraph {
  readonly id: string;
  readonly label: string;
  readonly direction: "LR" | "TB" | "RL" | "BT" | null;
  readonly children: readonly string[];
  readonly parent: string | null;
}

export type ParseResult =
  | { readonly ok: true; readonly value: Skeleton }
  | { readonly ok: false; readonly errors: readonly string[] };
