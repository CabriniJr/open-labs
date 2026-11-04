import { filmeZeroCode } from "@ovh/otel-domain";
import { useMemo, useState } from "react";
import { ModosDoLab } from "./ModosDoLab";
import { VitrineLab } from "./VitrineLab";
import { ZeroCodeLab } from "./ZeroCodeLab";

/**
 * O showcase do zero-code: a pilha em andares, o agente acendendo as bordas, e
 * o tempo que o trace não explica. Um span manual refaz o filme.
 */
function Vitrine() {
  const [manual, setManual] = useState(false);
  const filme = useMemo(() => filmeZeroCode({ manual }), [manual]);
  return (
    <VitrineLab
      film={filme}
      testId="zerocode-showcase"
      niveis={["stack", "trace"]}
      label="A checkout request runs through an HTTP framework, business code and two libraries; the auto-instrumentation agent records spans for the framework and the libraries, and the business code shows up only as unexplained time."
      tituloDosPacotes="Spans"
      legenda={[
        { label: "auto span", tone: "kind-1" },
        { label: "manual span", tone: "kind-2" },
        { label: "no child span", tone: "live" },
      ]}
      controles={
        <label className="ctxlab-switch" htmlFor="zc-manual">
          <input id="zc-manual" type="checkbox" role="switch" checked={manual} onChange={(e) => setManual(e.target.checked)} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>Add one manual span around the discount rules</span>
        </label>
      }
    />
  );
}

export function ZeroCodeModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <ZeroCodeLab />} />;
}
