import type { FlowView } from "./types.js";

export interface FlowDiagramProps {
  readonly view: FlowView;
  readonly onSelectNode?: (id: string) => void;
  readonly selectedNodeId?: string;
}

/** L0: a vista externa. Desenhada à mão em SVG, sem biblioteca de ícones. */
export function FlowDiagram({ view, onSelectNode, selectedNodeId }: FlowDiagramProps) {
  const byId = new Map(view.nodes.map((n) => [n.id, n]));

  return (
    <svg className="dui-flow" viewBox="0 0 400 160" role="img" aria-label="Service flow">
      {view.edges.map((edge) => {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        if (!from || !to) return null;
        const key = `${edge.from}-${edge.to}`;
        return (
          <g key={key}>
            <line
              className="dui-flow__wire"
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            />
            {edge.progress !== undefined ? (
              <circle
                className="dui-flow__packet"
                data-dropped={edge.dropped === true ? "true" : undefined}
                r={5}
                cx={from.x + (to.x - from.x) * edge.progress}
                cy={from.y + (to.y - from.y) * edge.progress}
              />
            ) : null}
          </g>
        );
      })}

      {view.nodes.map((node) => (
        <g
          key={node.id}
          className="dui-flow__node"
          data-state={node.state}
          data-selected={node.id === selectedNodeId ? "true" : undefined}
          onClick={onSelectNode ? () => onSelectNode(node.id) : undefined}
        >
          <rect x={node.x - 38} y={node.y - 18} width={76} height={36} rx={0} />
          <text x={node.x} y={node.y + 1} textAnchor="middle">
            {node.label}
          </text>
          {node.sublabel ? (
            <text className="dui-flow__sublabel" x={node.x} y={node.y + 13} textAnchor="middle">
              {node.sublabel}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
