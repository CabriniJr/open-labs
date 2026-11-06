import { filmeDoRollout, type OpcoesDoRollout } from "@ovh/otel-domain";
import { useMemo, useState } from "react";
import { ModosDoLab } from "./ModosDoLab";
import { RolloutLab } from "./RolloutLab";
import { VitrineLab } from "./VitrineLab";

/**
 * O showcase do rollout: a escada das seis etapas, cada uma com o lab que a
 * explica. A ordem refaz o filme.
 */
function Vitrine() {
  const [ordem, setOrdem] = useState<OpcoesDoRollout["ordem"]>("recomendada");
  const filme = useMemo(() => filmeDoRollout({ ordem }), [ordem]);
  return (
    <VitrineLab
      film={filme}
      testId="rollout-showcase"
      niveis={["foundation", "traces", "correlation", "scale"]}
      label="Six rollout steps climb a staircase — Collector, zero-code agent, propagation, log correlation, manual spans and sampling — each naming the lab that explains it and the questions it lets you answer."
      tituloDosPacotes="Steps"
      legenda={[
        { label: "in order", tone: "kind-1" },
        { label: "before its prerequisites", tone: "live" },
      ]}
      controles={
        <div className="deplab-modes" role="radiogroup" aria-label="Order">
          {(["recomendada", "codigo-primeiro"] as const).map((o) => (
            <button key={o} type="button" role="radio" aria-checked={ordem === o} onClick={() => setOrdem(o)}>
              {o === "recomendada" ? "Recommended order" : "Start from code"}
            </button>
          ))}
        </div>
      }
    />
  );
}

export function RolloutModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <RolloutLab />} />;
}
