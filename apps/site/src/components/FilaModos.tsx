import { filmeDaFila } from "@ovh/otel-domain";
import { useMemo, useState } from "react";
import { FilaLab } from "./FilaLab";
import { ModosDoLab } from "./ModosDoLab";
import { VitrineLab } from "./VitrineLab";

/**
 * O showcase da fila: o contexto dentro da mensagem, o silo que guarda, e pai
 * ou link do outro lado. Injeção e modo de consumo refazem o filme.
 */
function Vitrine() {
  const [injetar, setInjetar] = useState(true);
  const [modo, setModo] = useState<"um" | "lote">("um");
  const filme = useMemo(() => filmeDaFila({ injetar, modo }), [injetar, modo]);
  return (
    <VitrineLab
      film={filme}
      testId="queue-showcase"
      niveis={["publish", "queue", "consume", "backend"]}
      label="Checkout publishes three orders to a queue, each carrying its trace context in the message headers; fulfillment consumes them one by one or as a batch, and the backend shows the traces that result."
      tituloDosPacotes="Messages"
      legenda={[
        { label: "order 1", tone: "kind-1" },
        { label: "order 2", tone: "kind-3" },
        { label: "order 3", tone: "kind-5" },
        { label: injetar ? "batch" : "orphan", tone: injetar ? "kind-4" : "live" },
      ]}
      controles={
        <>
          <div className="deplab-modes" role="radiogroup" aria-label="Consumer">
            {(["um", "lote"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={modo === m} onClick={() => setModo(m)}>
                {m === "um" ? "One at a time" : "As a batch"}
              </button>
            ))}
          </div>
          <label className="ctxlab-switch" htmlFor="fl-injetar">
            <input id="fl-injetar" type="checkbox" role="switch" checked={injetar} onChange={(e) => setInjetar(e.target.checked)} />
            <span className="ctxlab-switch__track" aria-hidden="true">
              <span />
            </span>
            <span>Inject traceparent into the message</span>
          </label>
        </>
      }
    />
  );
}

export function FilaModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <FilaLab />} />;
}
