/** Um nó no diagrama de fluxo. Sem domínio: só rótulo e posição. */
export interface FlowNodeView {
  readonly id: string;
  readonly label: string;
  readonly sublabel?: string;
  readonly x: number;
  readonly y: number;
  readonly state: "idle" | "active" | "error";
}

/** Uma aresta com um pacote opcional viajando por ela (0 = origem, 1 = destino). */
export interface FlowEdgeView {
  readonly from: string;
  readonly to: string;
  readonly progress?: number;
  readonly dropped?: boolean;
}

export interface FlowView {
  readonly nodes: readonly FlowNodeView[];
  readonly edges: readonly FlowEdgeView[];
}
