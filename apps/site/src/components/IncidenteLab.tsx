import { investigar, MINUTOS_PARA_DETECTAR, MINUTOS_POR_CANDIDATO } from "@ovh/otel-domain";
import { useState } from "react";

/**
 * A simulação do incidente: a busca. O leitor escolhe o tráfego e se o log
 * carrega `trace_id`; a lista é o que a busca devolve, e o relógio é o modelo
 * de `investigar`, com a premissa escrita ao lado.
 */
const TRAFEGOS = [5, 20, 80] as const;
const min = (m: number) => `${m.toFixed(m % 1 === 0 ? 0 : 1)} min`;

export function IncidenteLab() {
  const [rps, setRps] = useState<number>(20);
  const [contexto, setContexto] = useState(false);
  const inc = investigar({ rps, contexto });
  const consulta = contexto ? `trace_id = ${inc.log.traceId!.slice(0, 16)}…` : `time in [12:00:0${inc.log.segundo}, 12:00:0${inc.log.segundo + 1})`;

  return (
    <div className="metlab" data-testid="incident-lab">
      <div className="metlab__barra">
        <div className="deplab-modes" role="radiogroup" aria-label="Traffic">
          {TRAFEGOS.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={rps === t} onClick={() => setRps(t)}>
              {t} req/s
            </button>
          ))}
        </div>
        <label className="ctxlab-switch" htmlFor="inc-ctx">
          <input id="inc-ctx" type="checkbox" role="switch" checked={contexto} onChange={(e) => setContexto(e.target.checked)} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>trace_id on the log line</span>
        </label>
      </div>
      <div className="metlab__corpo">
        <section className="metlab__cartao" aria-label="The error log and the search">
          <h3 className="mono">The error log</h3>
          <p className="mono inclab__linha">
            12:00:0{inc.log.segundo} ERROR payment declined{inc.log.traceId === undefined ? "" : ` trace_id=${inc.log.traceId}`}
          </p>
          <h3 className="mono manlab__h">The search</h3>
          <p className="mono inclab__consulta">{consulta}</p>
          <p className="metlab__veredito" data-testid="inc-veredito">
            <b>{inc.busca.candidatos.length}</b> candidate {inc.busca.candidatos.length === 1 ? "trace" : "traces"} · MTTR on this model <b>{min(inc.busca.minutos)}</b>
          </p>
          <p className="metlab__vazio">
            Model: {MINUTOS_LEGENDA} — an assumption to make the arithmetic visible, not an industry figure.
          </p>
        </section>
        <section className="metlab__cartao" aria-label="Candidate traces">
          <h3 className="mono">Candidates to rule out</h3>
          <ol className="inclab__lista mono">
            {inc.busca.candidatos.slice(0, 40).map((r) => (
              <li key={r.n} data-erro={r.erro ? "" : undefined}>
                {r.traceId.slice(0, 12)}… <span>{r.fim - r.inicio} ms</span>
              </li>
            ))}
            {inc.busca.candidatos.length > 40 ? <li className="inclab__mais">… and {inc.busca.candidatos.length - 40} more</li> : null}
          </ol>
        </section>
      </div>
    </div>
  );
}

const MINUTOS_LEGENDA = `${MINUTOS_PARA_DETECTAR} min to detect and open the log, ${MINUTOS_POR_CANDIDATO} min to rule out each candidate`;
