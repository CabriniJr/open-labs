import { filmeDosPilares } from "@ovh/otel-domain";
import { useMemo, useState } from "react";
import { ModosDoLab } from "./ModosDoLab";
import { PilaresLab } from "./PilaresLab";
import { VitrineLab } from "./VitrineLab";

/**
 * O showcase dos pilares: um incidente, o log, a métrica e o trace de cada
 * requisição, e o que os liga. A correlação refaz o filme.
 */
function Vitrine() {
  const [correlacao, setCorrelacao] = useState(false);
  const filme = useMemo(() => filmeDosPilares({ correlacao }), [correlacao]);
  return (
    <VitrineLab
      film={filme}
      testId="pillars-showcase"
      niveis={["incident", "log", "metric", "trace"]}
      label="Six requests reach checkout and one fails; a logger, a meter and a tracer each record their part of every request, and the film shows what joins them."
      tituloDosPacotes="Requests"
      legenda={[
        { label: "log", tone: "kind-2" },
        { label: "metric", tone: "kind-4" },
        { label: "trace", tone: "kind-1" },
        { label: "the failure", tone: "live" },
      ]}
      controles={
        <label className="ctxlab-switch" htmlFor="pl-corr">
          <input id="pl-corr" type="checkbox" role="switch" checked={correlacao} onChange={(e) => setCorrelacao(e.target.checked)} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>trace_id in logs, exemplars in metrics</span>
        </label>
      }
    />
  );
}

export function PilaresModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <PilaresLab />} />;
}
