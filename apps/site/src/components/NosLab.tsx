import { enriquecer, metricasDosNos, type Associacao, type OndeEnriquece } from "@ovh/otel-domain";
import { useState } from "react";

/**
 * A simulação dos sinais do nó: onde o `k8sattributes` roda e como ele acha o
 * Pod. A tabela é `enriquecer` — o IP que foi perguntado e o que voltou —, e
 * ao lado o que os receivers do host e do kubelet trazem sozinhos.
 */
const ONDE: readonly { id: OndeEnriquece; rotulo: string }[] = [
  { id: "agent", rotulo: "in the agent" },
  { id: "gateway", rotulo: "in the gateway" },
  { id: "nenhum", rotulo: "nowhere" },
];

export function NosLab() {
  const [onde, setOnde] = useState<OndeEnriquece>("gateway");
  const [associacao, setAssociacao] = useState<Associacao>("conexao");
  const spans = enriquecer({ onde, associacao });
  const metricas = metricasDosNos();
  const casados = spans.filter((s) => s.casou).length;

  return (
    <div className="metlab" data-testid="nodes-lab">
      <div className="metlab__barra">
        <div className="deplab-modes" role="radiogroup" aria-label="Where k8sattributes runs">
          {ONDE.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={onde === o.id} onClick={() => setOnde(o.id)}>
              k8sattributes {o.rotulo}
            </button>
          ))}
        </div>
        <div className="deplab-modes" role="radiogroup" aria-label="pod_association">
          {(["conexao", "recurso"] as const).map((a) => (
            <button key={a} type="button" role="radio" aria-checked={associacao === a} disabled={onde === "nenhum"} onClick={() => setAssociacao(a)}>
              {a === "conexao" ? "by connection IP" : "by k8s.pod.ip"}
            </button>
          ))}
        </div>
      </div>
      <div className="metlab__corpo">
        <section className="metlab__cartao" aria-label="Spans and their Kubernetes attributes">
          <h3 className="mono">Spans · what k8sattributes added</h3>
          <table className="metlab__tabela mono">
            <thead>
              <tr>
                <th scope="col">from Pod</th>
                <th scope="col">IP asked</th>
                <th scope="col">k8s.pod.name</th>
                <th scope="col">k8s.node.name</th>
              </tr>
            </thead>
            <tbody>
              {spans.map((s) => (
                <tr key={s.pod.nome}>
                  <td className="loglab__corpo">
                    {s.pod.nome} <small>{s.pod.ip}</small>
                  </td>
                  <td>{s.ipPerguntado ?? "—"}</td>
                  <td data-ruim={s.casou ? undefined : ""}>{s.recurso["k8s.pod.name"] ?? "missing"}</td>
                  <td>{s.recurso["k8s.node.name"] ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="metlab__veredito" data-testid="nos-veredito">
            <b>
              {casados} / {spans.length}
            </b>{" "}
            spans can be grouped by Pod
          </p>
        </section>
        <section className="metlab__cartao" aria-label="Host and kubelet metrics">
          <h3 className="mono">Receivers that need no lookup</h3>
          <ol className="loglab__spans mono">
            {metricas.map((m, i) => (
              <li key={i} data-aberto="">
                {m.nome} <span>{m.receiver}</span>
                <small>{Object.values(m.recurso).join(" · ")}</small>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
