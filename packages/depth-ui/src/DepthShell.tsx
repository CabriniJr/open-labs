import type { LevelId } from "@ovh/depth-core";
import type { ReactNode } from "react";

export interface DepthShellProps {
  readonly levels: readonly LevelId[];
  readonly activeLevel: LevelId;
  readonly onChangeLevel: (level: LevelId) => void;
  readonly labels: Readonly<Record<LevelId, string>>;
  readonly children: ReactNode;
  readonly context?: ReactNode;
}

/**
 * O invólucro da descida. Mantém o nível de cima visível na periferia, em vez
 * de abrir um modal: o leitor desce, nunca sai e volta.
 */
export function DepthShell({
  levels,
  activeLevel,
  onChangeLevel,
  labels,
  children,
  context,
}: DepthShellProps) {
  return (
    <div className="dui-depth" data-level={activeLevel}>
      <nav className="dui-depth__rail" aria-label="Depth">
        {levels.map((level, index) => (
          <button
            key={level}
            type="button"
            className="dui-depth__step"
            aria-current={level === activeLevel ? "step" : undefined}
            onClick={() => onChangeLevel(level)}
          >
            <span className="dui-depth__index mono">L{index}</span>
            <span className="dui-depth__name">{labels[level]}</span>
          </button>
        ))}
      </nav>
      <div className="dui-depth__stage">{children}</div>
      {context ? <aside className="dui-depth__context">{context}</aside> : null}
    </div>
  );
}
