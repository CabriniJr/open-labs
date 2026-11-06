import { filmeDaVitrineDaAnatomia } from "@ovh/otel-domain";
import { useMemo, useState } from "react";
import { AnatomiaLab } from "./AnatomiaLab";
import { ModosDoLab } from "./ModosDoLab";
import { VitrineLab } from "./VitrineLab";

/**
 * O showcase da anatomia: uma requisição atravessa quatro processos, cada span
 * sai por conta própria, e o backend monta a árvore depois. As duas escolhas
 * são os dois erros do lab, e refazem o filme a partir do modelo.
 */
function Vitrine() {
  const [derrubar, setDerrubar] = useState(false);
  const [semSdk, setSemSdk] = useState(false);
  const filme = useMemo(() => filmeDaVitrineDaAnatomia({ derrubarCabecalho: derrubar, paymentsSemInstrumentacao: semSdk }), [derrubar, semSdk]);
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
      testId="anatomy-showcase"
      niveis={["request", "spans", "export", "tree"]}
      label="One request crosses four services; each exports its own span, and the backend assembles the trace tree from what arrived."
      tituloDosPacotes="What crossed the wire"
      legenda={[
        { label: "header", tone: "kind-1" },
        { label: derrubar ? "second trace" : "span export", tone: derrubar ? "kind-3" : "kind-1" },
        { label: "dropped", tone: "live" },
      ]}
      controles={
        <>
          {chave("an-proxy", "A proxy strips headers before payments", derrubar, setDerrubar)}
          {chave("an-sdk", "Payments has no SDK", semSdk, setSemSdk)}
        </>
      }
    />
  );
}

export function AnatomiaModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <AnatomiaLab />} />;
}
