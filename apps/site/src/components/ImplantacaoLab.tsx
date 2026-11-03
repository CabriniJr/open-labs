import { filmeDaImplantacao, MODOS, type DetalheDaImplantacao, type Entrega, type LinhaDaTabela, type Modo } from "@ovh/otel-domain";
import { MotionPlayer, type MotionView } from "@ovh/motion/react";
import { lazy, Suspense, useMemo, useState } from "react";

const IsoStage = lazy(() => import("@ovh/stage3d").then((m) => ({ default: m.IsoStage })));

/**
 * O lab "Agent or gateway": quatro implantações do Collector, o mesmo
 * cluster, e o filme recalculado a cada escolha. A tabela ao lado é o custo de
 * cada implantação, lida do modelo — e a linha que o capítulo discute acende.
 */
const VISTAS: readonly MotionView<DetalheDaImplantacao>[] = [
  {
    id: "iso",
    label: "Iso",
    render: ({ film, t, frame, label }) => (
      <Suspense fallback={<div className="iso-stage" aria-busy="true" />}>
        <IsoStage film={film} t={t} frame={frame} label={label} />
      </Suspense>
    ),
  },
];

function Tabela({ entrega, destaque }: { entrega: Entrega; destaque: LinhaDaTabela | null }) {
  const tail =
    entrega.decisores.length === 0
      ? "impossible: no Collector in the path"
      : entrega.traceInteiro.T1 && entrega.traceInteiro.T2
        ? "works: each trace lands whole on one replica"
        : "broken: every Collector sees fragments";
  const linhas: readonly [LinhaDaTabela, string, string][] = [
    ["connections", "Backend connections", String(entrega.conexoesComBackend)],
    ["credentials", "Backend credentials live in", entrega.credenciais],
    ["enrichment", "k8sattributes sees the Pod IP in", entrega.enriquecimento],
    ["tail", "Tail sampling", tail],
    ["queue", "If the backend is down, spans wait", entrega.fila],
  ];
  return (
    <div className="deplab-table">
      <p className="deplab-h mono">What this deployment costs</p>
      <dl>
        {linhas.map(([id, nome, valor]) => (
          <div key={id} data-on={destaque === id ? "" : undefined} data-tone={id === "tail" ? (tail.startsWith("works") ? "conduit" : "live") : undefined}>
            <dt>{nome}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ImplantacaoLab() {
  const [modo, setModo] = useState<Modo>("gateway");
  const [rotear, setRotear] = useState(false);
  const { filme, entrega } = useMemo(() => filmeDaImplantacao({ modo, rotearPorTrace: rotear }), [modo, rotear]);
  return (
    <div className="deplab" data-testid="deployment-lab">
      <MotionPlayer
        film={filme}
        views={VISTAS}
        flatLabel="Topology"
        label="Two Kubernetes nodes with six application Pods; spans travel through the chosen Collector deployment to the backend."
        controls={
          <>
            <div className="deplab-modes" role="radiogroup" aria-label="Collector deployment">
              {MODOS.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={modo === m.id} onClick={() => setModo(m.id)}>
                  {m.nome}
                </button>
              ))}
            </div>
            <label className="ctxlab-switch" htmlFor="dep-route" data-disabled={modo !== "agent-gateway" ? "" : undefined}>
              <input id="dep-route" type="checkbox" role="switch" checked={rotear} disabled={modo !== "agent-gateway"} onChange={(e) => setRotear(e.target.checked)} />
              <span className="ctxlab-switch__track" aria-hidden="true">
                <span />
              </span>
              <span>Route by trace ID (loadbalancing exporter)</span>
            </label>
          </>
        }
        renderDetail={(frame) => <Tabela entrega={entrega} destaque={frame.detail?.destaque ?? null} />}
      />
    </div>
  );
}
