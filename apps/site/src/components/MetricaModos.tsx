import { filmeDaMetrica, type Temporalidade } from "@ovh/otel-domain";
import { useMemo, useState } from "react";
import { MetricaLab } from "./MetricaLab";
import { ModosDoLab } from "./ModosDoLab";
import { VitrineLab } from "./VitrineLab";

/**
 * O showcase da métrica: medições que ficam no processo, um reader que puxa, e
 * o que o backend conclui de cada ponto. Temporalidade e reinício refazem o
 * filme a partir do redutor.
 */
function Vitrine() {
  const [temporalidade, setTemporalidade] = useState<Temporalidade>("cumulative");
  const [reinicio, setReinicio] = useState(false);
  const filme = useMemo(() => filmeDaMetrica({ temporalidade, reinicio }), [temporalidade, reinicio]);
  return (
    <VitrineLab
      film={filme}
      testId="metric-showcase"
      niveis={["process", "export", "backend", "histogram"]}
      label="Latency measurements fold into the SDK aggregator; a periodic reader pulls one point per interval to the backend, which concludes requests per interval from them."
      tituloDosPacotes="Points on the wire"
      legenda={[
        { label: "measurement", tone: "kind-1" },
        { label: "point", tone: "container" },
        { label: "reset", tone: "live" },
      ]}
      controles={
        <>
          <div className="deplab-modes" role="radiogroup" aria-label="Temporality">
            {(["cumulative", "delta"] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={temporalidade === t} onClick={() => setTemporalidade(t)}>
                {t}
              </button>
            ))}
          </div>
          <label className="ctxlab-switch" htmlFor="met-reinicio">
            <input id="met-reinicio" type="checkbox" role="switch" checked={reinicio} onChange={(e) => setReinicio(e.target.checked)} />
            <span className="ctxlab-switch__track" aria-hidden="true">
              <span />
            </span>
            <span>The process restarts mid-interval</span>
          </label>
        </>
      }
    />
  );
}

export function MetricaModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <MetricaLab />} />;
}
