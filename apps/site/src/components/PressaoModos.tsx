import { filmeDaPressao } from "@ovh/otel-domain";
import { useMemo, useState } from "react";
import { ModosDoLab } from "./ModosDoLab";
import { PressaoLab } from "./PressaoLab";
import { VitrineLab } from "./VitrineLab";

/**
 * O showcase do backpressure: o backend cai doze ticks, e o tamanho da fila e
 * o memory_limiter decidem onde os spans morrem. As duas escolhas refazem o filme.
 */
function Vitrine() {
  const [fila, setFila] = useState(4);
  const [limiter, setLimiter] = useState(true);
  const filme = useMemo(() => filmeDaPressao({ fila, limiter }), [fila, limiter]);
  return (
    <VitrineLab
      film={filme}
      testId="pressure-showcase"
      niveis={["pipeline", "counters"]}
      label="One batch a tick enters the Collector through the memory_limiter into the exporter's sending queue; the backend goes down for twelve ticks, and the film counts where every batch ends."
      tituloDosPacotes="Exports"
      legenda={[
        { label: "batch", tone: "kind-1" },
        { label: "queued", tone: "conduit" },
        { label: "over a limit / dropped", tone: "live" },
      ]}
      controles={
        <>
          <div className="deplab-modes" role="radiogroup" aria-label="queue_size">
            {[4, 15].map((q) => (
              <button key={q} type="button" role="radio" aria-checked={fila === q} onClick={() => setFila(q)}>
                queue_size {q}
              </button>
            ))}
          </div>
          <label className="ctxlab-switch" htmlFor="ps-limiter">
            <input id="ps-limiter" type="checkbox" role="switch" checked={limiter} onChange={(e) => setLimiter(e.target.checked)} />
            <span className="ctxlab-switch__track" aria-hidden="true">
              <span />
            </span>
            <span>memory_limiter in the pipeline</span>
          </label>
        </>
      }
    />
  );
}

export function PressaoModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <PressaoLab />} />;
}
