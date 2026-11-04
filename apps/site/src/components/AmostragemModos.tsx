import { filmeDaVitrineDaAmostragem, type ModoDaAmostragem } from "@ovh/otel-domain";
import { useMemo, useState } from "react";
import { AmostragemLab } from "./AmostragemLab";
import { ModosDoLab } from "./ModosDoLab";
import { VitrineLab } from "./VitrineLab";

const MODOS: readonly { id: ModoDaAmostragem; rotulo: string }[] = [
  { id: "head", rotulo: "Head" },
  { id: "tail-roteado", rotulo: "Tail, routed by trace" },
  { id: "tail-espalhado", rotulo: "Tail, spread" },
];

/**
 * O showcase da amostragem: o mesmo erro, decidido cedo (head) ou tarde
 * (tail), com o trace inteiro num gateway ou espalhado. O modo refaz o filme.
 */
function Vitrine() {
  const [modo, setModo] = useState<ModoDaAmostragem>("head");
  const filme = useMemo(() => filmeDaVitrineDaAmostragem({ modo }), [modo]);
  return (
    <VitrineLab
      film={filme}
      testId="sampling-showcase"
      niveis={["apps", "routing", "window", "backend"]}
      label="Eight traces cross checkout and payments, one fails; head sampling decides at the root, tail sampling decides at the gateways after seeing the spans it was given."
      tituloDosPacotes="Spans"
      legenda={[
        { label: "trace", tone: "kind-1" },
        { label: "the failing trace", tone: "live" },
        { label: "held for the decision", tone: "kind-4" },
      ]}
      controles={
        <div className="deplab-modes" role="radiogroup" aria-label="Sampling">
          {MODOS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={modo === m.id} onClick={() => setModo(m.id)}>
              {m.rotulo}
            </button>
          ))}
        </div>
      }
    />
  );
}

export function AmostragemModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <AmostragemLab />} />;
}
