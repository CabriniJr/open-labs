import { filmeDosNos, type OndeEnriquece } from "@ovh/otel-domain";
import { useMemo, useState } from "react";
import { ModosDoLab } from "./ModosDoLab";
import { NosLab } from "./NosLab";
import { VitrineLab } from "./VitrineLab";

/**
 * O showcase dos sinais do nó: os agents colhendo host e kubelet, os spans
 * chegando por IP, e o k8sattributes perguntando ao API server. Onde ele roda
 * refaz o filme.
 */
function Vitrine() {
  const [onde, setOnde] = useState<OndeEnriquece>("agent");
  const filme = useMemo(() => filmeDosNos({ onde }), [onde]);
  return (
    <VitrineLab
      film={filme}
      testId="nodes-showcase"
      niveis={["agents", "spans", "lookup", "backend"]}
      label="Two Kubernetes nodes, each with an agent Collector reading the host and the kubelet; spans travel from Pods through the agents to a gateway, and k8sattributes asks the API server which Pod owns the IP it saw."
      tituloDosPacotes="Signals"
      legenda={[
        { label: "span", tone: "kind-1" },
        { label: "host / kubelet", tone: "controller" },
        { label: "no pod match", tone: "live" },
      ]}
      controles={
        <div className="deplab-modes" role="radiogroup" aria-label="Where k8sattributes runs">
          {(["agent", "gateway", "nenhum"] as const).map((o) => (
            <button key={o} type="button" role="radio" aria-checked={onde === o} onClick={() => setOnde(o)}>
              {o === "agent" ? "k8sattributes in the agent" : o === "gateway" ? "in the gateway" : "nowhere"}
            </button>
          ))}
        </div>
      }
    />
  );
}

export function NosModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <NosLab />} />;
}
