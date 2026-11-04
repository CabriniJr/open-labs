import { filmeDoLog } from "@ovh/otel-domain";
import { useMemo, useState } from "react";
import { LogLab } from "./LogLab";
import { ModosDoLab } from "./ModosDoLab";
import { VitrineLab } from "./VitrineLab";

/**
 * O showcase do log: o contexto ativo em cada thread, a ponte que o lê, e o
 * backend ligando log a span só pelo campo. Ponte e propagação refazem o filme.
 */
function Vitrine() {
  const [ponte, setPonte] = useState(true);
  const [propagar, setPropagar] = useState(true);
  const filme = useMemo(() => filmeDoLog({ ponte, propagar }), [ponte, propagar]);
  const chave = (id: string, rotulo: string, ligado: boolean, mudar: (v: boolean) => void) => (
    <label className="ctxlab-switch" htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={ligado} onChange={(e) => mudar(e.target.checked)} />
      <span className="ctxlab-switch__track" aria-hidden="true">
        <span />
      </span>
      <span>{rotulo}</span>
    </label>
  );
  return (
    <VitrineLab
      film={filme}
      testId="log-showcase"
      niveis={["process", "backend"]}
      label="A checkout handler logs from inside spans and threads; the log bridge stamps the active context on each record, and the backend links logs to spans by those fields."
      tituloDosPacotes="Records on the wire"
      legenda={[
        { label: "log call", tone: "kind-2" },
        { label: "with trace fields", tone: "kind-1" },
        { label: "without", tone: "live" },
      ]}
      controles={
        <>
          {chave("lg-ponte", "Log bridge installed", ponte, setPonte)}
          {chave("lg-propagar", "Hand the context to the worker thread", propagar, setPropagar)}
        </>
      }
    />
  );
}

export function LogModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <LogLab />} />;
}
