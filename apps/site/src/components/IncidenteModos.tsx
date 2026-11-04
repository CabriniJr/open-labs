import { filmeDoIncidente } from "@ovh/otel-domain";
import { useMemo, useState } from "react";
import { IncidenteLab } from "./IncidenteLab";
import { ModosDoLab } from "./ModosDoLab";
import { VitrineLab } from "./VitrineLab";

/**
 * O showcase do incidente: o tráfego em raias, o log com o segundo, e a busca
 * que acende todo mundo daquele segundo — ou um só. O trace_id refaz o filme.
 */
function Vitrine() {
  const [contexto, setContexto] = useState(false);
  const filme = useMemo(() => filmeDoIncidente({ rps: 20, contexto }), [contexto]);
  return (
    <VitrineLab
      film={filme}
      testId="incident-showcase"
      niveis={["traffic", "error", "search", "cost"]}
      label="Twenty requests a second overlap on a timeline; one fails, and the error log either carries only the second or also the trace_id, and the search lights every candidate it returns."
      tituloDosPacotes="Search"
      legenda={[
        { label: "request", tone: "kind-1" },
        { label: "the failure / the error second", tone: "live" },
      ]}
      controles={
        <label className="ctxlab-switch" htmlFor="ic-ctx">
          <input id="ic-ctx" type="checkbox" role="switch" checked={contexto} onChange={(e) => setContexto(e.target.checked)} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>trace_id on the log line</span>
        </label>
      }
    />
  );
}

export function IncidenteModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <IncidenteLab />} />;
}
