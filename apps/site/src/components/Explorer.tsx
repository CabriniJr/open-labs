import { useMemo, useState } from "react";
import { isOpenable } from "@ovh/depth-core";
import type { TreeIndex, Wire, WorldState } from "@ovh/depth-core";
import { Stage, autoView, pathTo } from "@ovh/depth-ui";
import type { View } from "@ovh/depth-ui";

/**
 * O palco com profundidade: clique duas vezes num objeto e você entra nele.
 *
 * As views desenhadas à mão dão o enquadramento bonito dos lugares que
 * importam; para todo o resto há a view montada sozinha. É isso que faz descer
 * ser sempre possível — sem ela, abrir um objeto que ninguém desenhou não
 * mostraria nada, e a profundidade seria promessa em vez de caminho.
 */

export interface ExplorerProps {
  readonly tree: TreeIndex;
  readonly wires: readonly Wire[];
  readonly state: WorldState;
  readonly previous?: WorldState | undefined;
  readonly edgeTicks?: number;
  readonly tickMs?: number;
  /** Views desenhadas à mão, por foco. A montada sozinha cobre o resto. */
  readonly views: readonly View[];
  readonly inicial?: string | undefined;
  readonly fills?: Readonly<Record<string, number>> | undefined;
  readonly readouts?: Readonly<Record<string, string>> | undefined;
  /** Quem está com a saída em alto. Só o domínio sabe ler o valor que saiu. */
  readonly altos?: ReadonlySet<string> | undefined;
}

export function Explorer({
  tree,
  wires,
  state,
  previous,
  edgeTicks,
  tickMs,
  views,
  inicial,
  fills,
  readouts,
  altos,
}: ExplorerProps) {
  const primeiro = inicial ?? views[0]?.focus ?? tree.rootId;
  const [foco, setFoco] = useState(primeiro);
  const [selecionado, setSelecionado] = useState<string | undefined>(undefined);

  const view = useMemo(
    () => views.find((v) => v.focus === foco) ?? autoView(tree, foco, wires),
    [views, foco, tree, wires],
  );
  const trilha = pathTo(tree, foco);

  const abrir = (id: string): void => {
    if (id !== foco && isOpenable(tree, id)) setFoco(id);
  };

  return (
    <div className="explorer">
      <nav className="explorer__trilha mono" aria-label="Onde você está">
        {trilha.map((id, i) => (
          <span key={id}>
            {i > 0 ? <span aria-hidden="true"> › </span> : null}
            <button
              type="button"
              onClick={() => setFoco(id)}
              aria-current={id === foco ? "true" : undefined}
              disabled={id === foco}
            >
              {tree.byId.get(id)?.label ?? id}
            </button>
          </span>
        ))}
        <span className="explorer__dica">
          {view.id.startsWith("auto:")
            ? "auto-laid view · double-click to enter"
            : "double-click to enter"}
        </span>
      </nav>

      <Stage
        tree={tree}
        wires={wires}
        view={view}
        state={state}
        previous={previous}
        {...(edgeTicks === undefined ? {} : { edgeTicks })}
        {...(tickMs === undefined ? {} : { tickMs })}
        fills={fills}
        readouts={readouts}
        altos={altos}
        selected={selecionado}
        onSelect={setSelecionado}
        onOpen={abrir}
      />
    </div>
  );
}
