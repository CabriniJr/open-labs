import { filmeDaVitrineDosProviders } from "@ovh/otel-domain";
import { useMemo, useState } from "react";
import { ModosDoLab } from "./ModosDoLab";
import { ProvidersLab } from "./ProvidersLab";
import { VitrineLab } from "./VitrineLab";

/**
 * O showcase dos providers: as mesmas chamadas de API, e o que cada provider
 * faz com elas. SDK e taxa do sampler refazem o filme.
 */
function Vitrine() {
  const [sdk, setSdk] = useState(true);
  const [taxa, setTaxa] = useState(1);
  const filme = useMemo(() => filmeDaVitrineDosProviders({ sdk, taxa }), [sdk, taxa]);
  return (
    <VitrineLab
      film={filme}
      testId="providers-showcase"
      niveis={["API", "traces", "metrics", "logs"]}
      label="Application code calls the tracer, meter and logger APIs; the TracerProvider samples and batches, the MeterProvider aggregates and is pulled by a reader, and the LoggerProvider batches — or, without an SDK, nothing happens."
      tituloDosPacotes="Exports"
      legenda={[
        { label: "traces", tone: "kind-1" },
        { label: "metrics", tone: "kind-4" },
        { label: "logs", tone: "kind-2" },
      ]}
      controles={
        <>
          <label className="ctxlab-switch" htmlFor="pv-sdk">
            <input id="pv-sdk" type="checkbox" role="switch" checked={sdk} onChange={(e) => setSdk(e.target.checked)} />
            <span className="ctxlab-switch__track" aria-hidden="true">
              <span />
            </span>
            <span>SDK installed</span>
          </label>
          <div className="deplab-modes" role="radiogroup" aria-label="Sampler ratio">
            {[1, 0.5].map((t) => (
              <button key={t} type="button" role="radio" aria-checked={taxa === t} disabled={!sdk} onClick={() => setTaxa(t)}>
                sample {t * 100}%
              </button>
            ))}
          </div>
        </>
      }
    />
  );
}

export function ProvidersModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <ProvidersLab />} />;
}
