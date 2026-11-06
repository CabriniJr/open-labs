import { filmeManual } from "@ovh/otel-domain";
import { useMemo, useState } from "react";
import { ManualLab } from "./ManualLab";
import { ModosDoLab } from "./ModosDoLab";
import { VitrineLab } from "./VitrineLab";

/**
 * O showcase dos spans à mão: o código rodando linha a linha, a memória do SDK
 * e o backend. Esquecer o end() e pôr o id no nome refazem o filme.
 */
function Vitrine() {
  const [esquecerEnd, setEsquecerEnd] = useState(false);
  const [nomeComId, setNomeComId] = useState(false);
  const filme = useMemo(() => filmeManual({ esquecerEnd, nomeComId }), [esquecerEnd, nomeComId]);
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
      testId="manual-showcase"
      niveis={["code", "backend"]}
      label="A checkout handler starts, annotates and ends two spans by hand; the SDK keeps them in memory until they end, and the backend receives only what ended."
      tituloDosPacotes="Exported spans"
      legenda={[
        { label: "span", tone: "kind-1" },
        { label: "lost or orphaned", tone: "live" },
      ]}
      controles={
        <>
          {chave("mn-end", "Comment out span.end()", esquecerEnd, setEsquecerEnd)}
          {chave("mn-id", "Put the order id in the span name", nomeComId, setNomeComId)}
        </>
      }
    />
  );
}

export function ManualModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <ManualLab />} />;
}
